/**
 * Day-off impact preview helper.
 * Computes the effect of adding or removing a holiday/off day on existing classes.
 */

import { createClient } from "@/lib/supabase/server";
import { getTimePeriod } from "./occurrences.js";
import { getPeriodForDate, getTodayLA } from "@/lib/payroll/schedule.js";

/**
 * Preview the impact of adding a day off (holiday, school closure, or program off day).
 *
 * @param {Object} params
 * @param {string} params.date - The date (YYYY-MM-DD)
 * @param {string} params.scope - 'global', 'district', 'school', or 'program'
 * @param {string} params.timePeriod - 'all_day', 'am', or 'pm'
 * @param {string} [params.districtId] - For district-scoped off days
 * @param {string} [params.schoolId] - For school-scoped off days
 * @param {string} [params.program] - For program-scoped off days
 * @param {string} [params.name] - Name/reason for the off day
 * @returns {Promise<Object>} Impact preview
 */
export async function previewDayOffImpact({
  date,
  scope,
  timePeriod = "all_day",
  districtId,
  schoolId,
  program,
  name,
}) {
  const supabase = await createClient();
  const today = getTodayLA();

  // Determine which classes are affected based on scope
  let classQuery = supabase
    .from("classes")
    .select(`
      id,
      days,
      time,
      start_date,
      end_date,
      target_sessions,
      program,
      hours_per_day,
      schools:school_id (
        id,
        name,
        district_id,
        districts:district_id (
          id,
          name
        )
      )
    `);

  // Filter by scope
  if (scope === "school" && schoolId) {
    classQuery = classQuery.eq("school_id", schoolId);
  } else if (scope === "district" && districtId) {
    classQuery = classQuery.eq("schools.district_id", districtId);
  } else if (scope === "program" && program) {
    classQuery = classQuery.eq("program", program);
  }
  // For global, no filter needed

  const { data: classes } = await classQuery;

  if (!classes || classes.length === 0) {
    return {
      affectedSessions: [],
      sessionChanges: [],
      isInPast: date < today,
      payrollStatus: null,
      classesWithEndDate: [],
    };
  }

  // Find which classes run on this date
  const dayName = getDayName(date);
  const affectedSessions = [];

  for (const cls of classes) {
    if (!cls.days || !cls.schools) continue;

    // Check if class runs on this weekday
    if (!cls.days.includes(dayName)) continue;

    // Check if date is within class range
    if (cls.start_date && date < cls.start_date) continue;
    if (cls.end_date && date > cls.end_date) continue;

    // Check time period match
    if (timePeriod !== "all_day") {
      const classTimePeriod = getTimePeriod(cls.time);
      if (classTimePeriod !== timePeriod) continue;
    }

    // Check program match for program-specific off days
    if (scope === "program" && program && cls.program !== program) continue;

    affectedSessions.push({
      classId: cls.id,
      date,
      time: cls.time,
      program: cls.program,
      schoolId: cls.schools.id,
      schoolName: cls.schools.name,
      districtId: cls.schools.districts?.id,
      districtName: cls.schools.districts?.name,
      hasEndDate: !!cls.end_date,
      endDate: cls.end_date,
      targetSessions: cls.target_sessions,
    });
  }

  // Get class assignments to find who teaches each class
  const classIds = affectedSessions.map((s) => s.classId);
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      class_id,
      slot_type,
      profiles:profile_id (
        id,
        full_name
      )
    `)
    .in("class_id", classIds)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  // Build instructor map
  const instructorMap = new Map();
  (assignments || []).forEach((a) => {
    if (!instructorMap.has(a.class_id)) {
      instructorMap.set(a.class_id, []);
    }
    if (a.profiles) {
      instructorMap.get(a.class_id).push({
        id: a.profiles.id,
        name: a.profiles.full_name,
        slotType: a.slot_type,
      });
    }
  });

  // Add instructor info to affected sessions
  for (const session of affectedSessions) {
    session.instructors = instructorMap.get(session.classId) || [];
  }

  // Get any existing session_changes on this date
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
      absentProfile:profiles!session_changes_absent_profile_id_fkey (id, full_name),
      subProfile:profiles!session_changes_sub_profile_id_fkey (id, full_name)
    `)
    .eq("session_date", date)
    .in("class_id", classIds);

  // Check payroll status
  let payrollStatus = null;
  try {
    const periodInfo = getPeriodForDate(date);
    if (periodInfo) {
      const { data: period } = await supabase
        .from("payroll_periods")
        .select("status")
        .eq("start_date", periodInfo.startDate)
        .single();

      if (period) {
        payrollStatus = {
          periodStart: periodInfo.startDate,
          periodEnd: periodInfo.endDate,
          status: period.status,
          isApproved: period.status === "approved" || period.status === "paid",
        };
      }
    }
  } catch {
    // Payroll tables may not exist yet
  }

  // Identify classes with end_date that would lose a session
  const classesWithEndDate = affectedSessions
    .filter((s) => s.hasEndDate && s.targetSessions)
    .map((s) => ({
      classId: s.classId,
      schoolName: s.schoolName,
      program: s.program,
      currentEndDate: s.endDate,
      targetSessions: s.targetSessions,
    }));

  return {
    affectedSessions,
    sessionChanges: sessionChanges || [],
    isInPast: date < today,
    payrollStatus,
    classesWithEndDate,
    holidayName: name,
  };
}

/**
 * Get day name from date string.
 */
function getDayName(dateStr) {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const d = new Date(dateStr + "T12:00:00");
  return dayNames[d.getDay()];
}

/**
 * Get all instructors who need to be notified about a cancelled class.
 * Includes regular instructors, subs, and anyone marked out.
 */
export function getInstructorsToNotify(affectedSessions, sessionChanges) {
  const instructorIds = new Set();
  const notifications = [];

  // Regular instructors
  for (const session of affectedSessions) {
    for (const instructor of session.instructors || []) {
      if (!instructorIds.has(instructor.id)) {
        instructorIds.add(instructor.id);
        notifications.push({
          profileId: instructor.id,
          name: instructor.name,
          reason: "regular",
          schoolName: session.schoolName,
          date: session.date,
        });
      }
    }
  }

  // Subs and absent instructors from session_changes
  for (const change of sessionChanges || []) {
    if (change.sub_profile_id && !instructorIds.has(change.sub_profile_id)) {
      instructorIds.add(change.sub_profile_id);
      notifications.push({
        profileId: change.sub_profile_id,
        name: change.subProfile?.full_name,
        reason: "sub",
        schoolName: affectedSessions.find((s) => s.classId === change.class_id)?.schoolName,
        date: change.session_date,
      });
    }

    if (change.absent_profile_id && !instructorIds.has(change.absent_profile_id)) {
      instructorIds.add(change.absent_profile_id);
      notifications.push({
        profileId: change.absent_profile_id,
        name: change.absentProfile?.full_name,
        reason: "absent",
        schoolName: affectedSessions.find((s) => s.classId === change.class_id)?.schoolName,
        date: change.session_date,
      });
    }
  }

  return notifications;
}

/**
 * Compute the next valid class date for extending an end_date.
 */
export async function computeNextValidDate(classId, afterDate) {
  const supabase = await createClient();

  // Get class info
  const { data: cls } = await supabase
    .from("classes")
    .select(`
      days,
      time,
      program,
      schools:school_id (
        id,
        district_id
      )
    `)
    .eq("id", classId)
    .single();

  if (!cls || !cls.days) return null;

  // Get holidays after this date
  const lookAhead = new Date(afterDate);
  lookAhead.setMonth(lookAhead.getMonth() + 3);
  const lookAheadStr = formatDate(lookAhead);

  const { data: holidays } = await supabase
    .from("holidays")
    .select("date, time_period")
    .gte("date", afterDate)
    .lte("date", lookAheadStr);

  const { data: programOffDays } = await supabase
    .from("program_off_days")
    .select("date, time_period")
    .eq("program", cls.program)
    .gte("date", afterDate)
    .lte("date", lookAheadStr);

  // Build set of off dates
  const offDates = new Set();
  const classTimePeriod = getTimePeriod(cls.time);

  (holidays || []).forEach((h) => {
    if (h.time_period === "all_day" || h.time_period === classTimePeriod) {
      offDates.add(h.date);
    }
  });

  (programOffDays || []).forEach((od) => {
    if (od.time_period === "all_day" || od.time_period === classTimePeriod) {
      offDates.add(od.date);
    }
  });

  // Find next valid date
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const validDays = new Set(cls.days);

  let current = new Date(afterDate + "T12:00:00");
  current.setDate(current.getDate() + 1);

  for (let i = 0; i < 90; i++) {
    const dateStr = formatDate(current);
    const dayName = dayNames[current.getDay()];

    if (validDays.has(dayName) && !offDates.has(dateStr)) {
      return dateStr;
    }

    current.setDate(current.getDate() + 1);
  }

  return null;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
