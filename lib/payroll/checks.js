/**
 * Payroll Checks
 * ==============
 * Business logic for instructor class confirmation before payroll.
 *
 * NOTES FOR THE PAYROLL BUILD:
 * ----------------------------
 * 1. NO CLASSES MEANS NOTHING TO APPROVE
 *    Payroll should treat `no_classes` status as "nothing to pay" and never
 *    block approval on it. A period where nobody had classes should be marked
 *    "Nothing to pay" automatically, with no reminder emails to admins.
 *
 * 2. OPEN ISSUES SHOULD WARN BEFORE APPROVING
 *    Approving payroll with open issues should show a warning, not a hard block.
 *    Let admins decide whether to proceed or resolve issues first.
 *
 * 3. "NO REPLY" MEANS "WENT WITH WHAT'S LISTED"
 *    If an instructor doesn't respond by the deadline, we use the sessions
 *    we have on record. This is not an error state - it's expected behavior.
 */

import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDate,
  parseDate,
  getTodayLA,
} from "./schedule.js";
import { getHolidaysForSchool, getProgramOffDays } from "@/lib/schedule/sessions.js";

/**
 * Get payroll check settings from the database.
 */
export async function getCheckSettings() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payroll_check_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return {
      confirmOffsetDays: 3,
      reminderEnabled: true,
    };
  }

  return {
    confirmOffsetDays: data.confirm_offset_days,
    reminderEnabled: data.reminder_enabled,
  };
}

/**
 * Get the check deadline for a period.
 * Deadline = period end + confirm_offset_days
 */
export async function getCheckDeadline(periodEnd) {
  const settings = await getCheckSettings();
  return addDays(periodEnd, settings.confirmOffsetDays);
}

/**
 * Get all sessions in a period for an instructor.
 * Each session is marked as: taught, subbed, off, holiday, or upcoming.
 *
 * @param {string} profileId - Instructor profile ID
 * @param {Object} period - Period object with startDate and endDate
 * @param {string} today - Today's date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of session objects
 */
export async function getPeriodSessions(profileId, period, today = null) {
  if (!today) {
    today = getTodayLA();
  }

  const supabase = await createClient();
  const { startDate, endDate } = period;

  // Get instructor's class assignments
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      id,
      class_id,
      slot_type,
      classes:class_id (
        id,
        days,
        time,
        start_date,
        end_date,
        target_sessions,
        program,
        schools:school_id (
          id,
          name,
          districts:district_id (id)
        )
      )
    `)
    .eq("profile_id", profileId)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  if (!assignments || assignments.length === 0) {
    return [];
  }

  // Get session changes for this instructor in this period
  const { data: sessionChanges } = await supabase
    .from("session_changes")
    .select(`
      id,
      class_id,
      session_date,
      slot_type,
      absent_profile_id,
      sub_profile_id,
      reason,
      absentProfile:absent_profile_id (id, full_name),
      subProfile:sub_profile_id (id, full_name)
    `)
    .gte("session_date", startDate)
    .lte("session_date", endDate)
    .or(`absent_profile_id.eq.${profileId},sub_profile_id.eq.${profileId}`);

  // Build indexes
  const absencesByClassDate = new Map();
  const subSessionsByClassDate = new Map();

  (sessionChanges || []).forEach((sc) => {
    const key = `${sc.class_id}|${sc.session_date}`;
    if (sc.absent_profile_id === profileId) {
      absencesByClassDate.set(key, sc);
    }
    if (sc.sub_profile_id === profileId) {
      subSessionsByClassDate.set(key, sc);
    }
  });

  const sessions = [];
  const classIds = assignments.map((a) => a.class_id);

  // Get co-teachers
  const { data: allAssignments } = await supabase
    .from("class_assignments")
    .select(`
      class_id,
      profile_id,
      profiles:profile_id (id, full_name)
    `)
    .in("class_id", classIds)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  const coTeacherMap = {};
  (allAssignments || []).forEach((a) => {
    if (a.profile_id !== profileId && a.profiles) {
      coTeacherMap[a.class_id] = a.profiles;
    }
  });

  // Process each class assignment
  for (const assignment of assignments) {
    const cls = assignment.classes;
    if (!cls || !cls.days || !cls.schools) continue;

    const school = cls.schools;
    const districtId = school.districts?.id;

    // Get holidays and program off days
    const [holidays, programOffDays] = await Promise.all([
      getHolidaysForSchool(districtId, school.id, startDate, endDate),
      getProgramOffDays(cls.program || "wellness", startDate, endDate),
    ]);

    const holidayDates = new Set(holidays.map((h) => h.date));
    const holidayNames = {};
    holidays.forEach((h) => {
      holidayNames[h.date] = h.name;
    });

    const programOffDates = new Set(programOffDays.map((d) => d.date));

    // Generate dates for this class
    const classDates = generateClassDates(cls, startDate, endDate);

    for (const date of classDates) {
      const key = `${cls.id}|${date}`;
      const absence = absencesByClassDate.get(key);

      // Check if holiday or program off day
      if (holidayDates.has(date) || programOffDates.has(date)) {
        const holidayName = holidayNames[date] || programOffDays.find((d) => d.date === date)?.reason || "Day off";
        sessions.push({
          id: `${cls.id}-${date}-holiday`,
          classId: cls.id,
          date,
          type: "holiday",
          schoolName: school.name,
          schoolId: school.id,
          program: cls.program || "wellness",
          time: cls.time,
          holidayName,
          coTeacher: coTeacherMap[cls.id] || null,
        });
        continue;
      }

      // Check if instructor was out
      if (absence) {
        sessions.push({
          id: `${cls.id}-${date}-off`,
          classId: cls.id,
          date,
          type: "off",
          schoolName: school.name,
          schoolId: school.id,
          program: cls.program || "wellness",
          time: cls.time,
          reason: absence.reason || "Day off",
          subName: absence.subProfile?.full_name?.split(" ")[0] || null,
          subId: absence.subProfile?.id || null,
          coTeacher: coTeacherMap[cls.id] || null,
        });
        continue;
      }

      // Normal session - taught or upcoming
      const isUpcoming = date > today;
      sessions.push({
        id: `${cls.id}-${date}`,
        classId: cls.id,
        date,
        type: isUpcoming ? "upcoming" : "taught",
        schoolName: school.name,
        schoolId: school.id,
        program: cls.program || "wellness",
        time: cls.time,
        coTeacher: coTeacherMap[cls.id] || null,
      });
    }
  }

  // Add subbed sessions (where this instructor filled in for someone else)
  for (const [, sc] of subSessionsByClassDate) {
    // Skip if this is one of their own classes
    if (classIds.includes(sc.class_id)) continue;

    // Get class info
    const { data: cls } = await supabase
      .from("classes")
      .select(`
        id,
        time,
        program,
        schools:school_id (id, name)
      `)
      .eq("id", sc.class_id)
      .single();

    if (!cls || !cls.schools) continue;

    const isUpcoming = sc.session_date > today;
    sessions.push({
      id: `${sc.class_id}-${sc.session_date}-sub`,
      classId: sc.class_id,
      date: sc.session_date,
      type: isUpcoming ? "upcoming" : "subbed",
      schoolName: cls.schools.name,
      schoolId: cls.schools.id,
      program: cls.program || "wellness",
      time: cls.time,
      coveredFor: sc.absentProfile?.full_name?.split(" ")[0] || null,
      coveredForId: sc.absentProfile?.id || null,
    });
  }

  // Sort by date, then time
  sessions.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.time || "").localeCompare(b.time || "");
  });

  return sessions;
}

/**
 * Generate all dates a class would meet between startDate and endDate.
 */
function generateClassDates(cls, rangeStart, rangeEnd) {
  const dates = [];
  const days = cls.days || [];
  if (days.length === 0) return dates;

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const targetDays = days.map((d) => dayMap[d]).filter((d) => d !== undefined);

  const classStart = cls.start_date || rangeStart;
  const classEnd = cls.end_date || rangeEnd;

  const start = parseDate(rangeStart > classStart ? rangeStart : classStart);
  const end = parseDate(rangeEnd < classEnd ? rangeEnd : classEnd);

  const current = new Date(start);
  while (current <= end) {
    if (targetDays.includes(current.getDay())) {
      dates.push(formatDate(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Check if an instructor needs to confirm their classes for a period.
 *
 * Returns true only when ALL of:
 * 1. The period has ended
 * 2. Today is on or before the deadline
 * 3. They have at least one taught or subbed session
 * 4. There's no payroll_checks row yet
 */
export async function needsCheck(profileId, period, today = null) {
  if (!today) {
    today = getTodayLA();
  }

  // 1. Period must have ended
  if (period.endDate >= today) {
    return false;
  }

  // 2. Today must be on or before deadline
  const deadline = await getCheckDeadline(period.endDate);
  if (today > deadline) {
    return false;
  }

  // 3. Must have at least one taught or subbed session
  const sessions = await getPeriodSessions(profileId, period, today);
  const hasWork = sessions.some((s) => s.type === "taught" || s.type === "subbed");
  if (!hasWork) {
    return false;
  }

  // 4. No existing check
  const supabase = await createClient();
  const { data: existingCheck } = await supabase
    .from("payroll_checks")
    .select("id")
    .eq("profile_id", profileId)
    .eq("period_start", period.startDate)
    .single();

  if (existingCheck) {
    return false;
  }

  return true;
}

/**
 * Get the check status for all active instructors in a period.
 * Admin only.
 *
 * @returns {Promise<Array>} Array of { profileId, fullName, avatarUrl, status, issueCount }
 */
export async function getCheckStatus(period, today = null) {
  if (!today) {
    today = getTodayLA();
  }

  const supabase = await createClient();
  const isPeriodEnded = period.endDate < today;

  // Get all active instructors
  const { data: instructors } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("role", "instructor")
    .eq("status", "active")
    .order("full_name");

  if (!instructors || instructors.length === 0) {
    return [];
  }

  // Get existing checks for this period
  const { data: checks } = await supabase
    .from("payroll_checks")
    .select(`
      id,
      profile_id,
      status,
      payroll_check_issues (id, status)
    `)
    .eq("period_start", period.startDate);

  const checksMap = new Map();
  (checks || []).forEach((c) => {
    const openIssues = (c.payroll_check_issues || []).filter((i) => i.status === "open").length;
    checksMap.set(c.profile_id, { status: c.status, openIssues });
  });

  const results = [];

  for (const instructor of instructors) {
    const check = checksMap.get(instructor.id);

    if (check) {
      results.push({
        profileId: instructor.id,
        fullName: instructor.full_name,
        avatarUrl: instructor.avatar_url,
        status: check.status,
        issueCount: check.openIssues,
      });
      continue;
    }

    // No check - determine if they had classes
    const sessions = await getPeriodSessions(instructor.id, period, today);
    const hasWork = sessions.some((s) => s.type === "taught" || s.type === "subbed");

    if (!hasWork) {
      results.push({
        profileId: instructor.id,
        fullName: instructor.full_name,
        avatarUrl: instructor.avatar_url,
        status: "no_classes",
        issueCount: 0,
      });
      continue;
    }

    // Had classes but no check
    if (isPeriodEnded) {
      results.push({
        profileId: instructor.id,
        fullName: instructor.full_name,
        avatarUrl: instructor.avatar_url,
        status: "no_reply",
        issueCount: 0,
      });
    }
  }

  return results;
}

/**
 * Get the payroll check for an instructor and period.
 */
export async function getPayrollCheck(profileId, periodStart) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payroll_checks")
    .select(`
      *,
      issues:payroll_check_issues (*)
    `)
    .eq("profile_id", profileId)
    .eq("period_start", periodStart)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get the admin note for a pay period.
 */
export async function getPeriodNote(periodStart) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payroll_period_notes")
    .select("note")
    .eq("period_start", periodStart)
    .single();

  return data?.note || null;
}

/**
 * Get break info for a period based on holidays and program off days.
 * Returns the break name if one covers at least half the period's weekdays.
 */
export async function getBreakInfo(profileId, period) {
  const supabase = await createClient();

  // Get instructor's schools and programs
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      classes:class_id (
        program,
        schools:school_id (
          id,
          districts:district_id (id)
        )
      )
    `)
    .eq("profile_id", profileId)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  if (!assignments || assignments.length === 0) {
    return { breakName: null };
  }

  // Collect all unique school/district/program combos
  const schools = new Set();
  const districts = new Set();
  const programs = new Set();

  assignments.forEach((a) => {
    if (a.classes?.schools?.id) schools.add(a.classes.schools.id);
    if (a.classes?.schools?.districts?.id) districts.add(a.classes.schools.districts.id);
    if (a.classes?.program) programs.add(a.classes.program);
  });

  // Count weekdays in period
  const start = parseDate(period.startDate);
  const end = parseDate(period.endDate);
  let weekdays = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) weekdays++;
    current.setDate(current.getDate() + 1);
  }

  // Get holidays in this period
  const { data: holidays } = await supabase
    .from("holidays")
    .select("date, name, district_id, school_id")
    .gte("date", period.startDate)
    .lte("date", period.endDate);

  // Get program off days
  const { data: programOffDays } = await supabase
    .from("program_off_days")
    .select("date, reason, program")
    .gte("date", period.startDate)
    .lte("date", period.endDate);

  // Count days by name
  const nameCounts = {};

  (holidays || []).forEach((h) => {
    // Check if applies to instructor's schools
    const applies =
      (h.district_id === null && h.school_id === null) ||
      (h.district_id && districts.has(h.district_id)) ||
      (h.school_id && schools.has(h.school_id));

    if (applies && h.name) {
      nameCounts[h.name] = (nameCounts[h.name] || 0) + 1;
    }
  });

  (programOffDays || []).forEach((d) => {
    if (programs.has(d.program) && d.reason) {
      nameCounts[d.reason] = (nameCounts[d.reason] || 0) + 1;
    }
  });

  // Find if any name covers at least half the weekdays
  const halfWeekdays = Math.ceil(weekdays / 2);
  for (const [name, count] of Object.entries(nameCounts)) {
    if (count >= halfWeekdays) {
      return { breakName: name };
    }
  }

  return { breakName: null };
}

/**
 * Get instructor's first class date.
 */
export async function getFirstClassDate(profileId) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("class_assignments")
    .select(`
      classes:class_id (start_date)
    `)
    .eq("profile_id", profileId)
    .in("slot_type", ["instructor_1", "instructor_2"])
    .order("classes(start_date)", { ascending: true })
    .limit(1);

  if (!data || data.length === 0 || !data[0].classes?.start_date) {
    return null;
  }

  return data[0].classes.start_date;
}

/**
 * Get instructor's next scheduled session after a date.
 */
export async function getNextScheduledSession(profileId, afterDate) {
  const endDate = addDays(afterDate, 120); // Look ahead 4 months

  const sessions = await getPeriodSessions(
    profileId,
    { startDate: afterDate, endDate },
    afterDate
  );

  const upcoming = sessions.find(
    (s) => s.date > afterDate && (s.type === "upcoming" || s.type === "taught")
  );

  return upcoming || null;
}

/**
 * Get open issues for admin inbox.
 */
export async function getOpenPayrollIssues() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payroll_check_issues")
    .select(`
      *,
      check:check_id (
        profile_id,
        period_start,
        period_end,
        profile:profile_id (
          id,
          full_name,
          avatar_url
        )
      ),
      school:school_id (name)
    `)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching open payroll issues:", error);
    return [];
  }

  return data || [];
}

/**
 * Get instructor's schools for the "Something's off" form.
 */
export async function getInstructorSchools(profileId) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("class_assignments")
    .select(`
      classes:class_id (
        schools:school_id (id, name)
      )
    `)
    .eq("profile_id", profileId)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  const schoolsMap = new Map();
  (data || []).forEach((a) => {
    if (a.classes?.schools) {
      schoolsMap.set(a.classes.schools.id, a.classes.schools.name);
    }
  });

  return Array.from(schoolsMap.entries()).map(([id, name]) => ({ id, name }));
}

/**
 * Get all schools for the "Other" option.
 */
export async function getAllSchools() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("schools")
    .select("id, name")
    .order("name");

  return data || [];
}
