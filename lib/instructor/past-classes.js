/**
 * Past Classes v2 Data Fetching
 * ==============================
 * Provides session data for the instructor Past Classes page,
 * focused on gratitude and feedback rather than payroll.
 */

import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  formatDate,
  parseDate,
  getTodayLA,
} from "@/lib/payroll/schedule.js";
import { getHolidaysForSchool, getProgramOffDays } from "@/lib/schedule/sessions.js";
import { getClassNotes } from "./class-notes.js";

/**
 * Get past sessions for an instructor, going back a specified number of weeks.
 * Each session includes co-teacher info, sub info, thank-you status, and note status.
 *
 * @param {string} profileId - Instructor profile ID
 * @param {number} weeksBack - Number of weeks to look back (default 4)
 * @param {string} today - Today's date (YYYY-MM-DD)
 * @returns {Promise<Object>} { sessions, lastClass, shoutOutsSent }
 */
export async function getPastSessions(profileId, weeksBack = 4, today = null) {
  if (!today) {
    today = getTodayLA();
  }

  const supabase = await createClient();

  // Calculate date range
  const endDate = today;
  const startDate = addDays(today, -(weeksBack * 7));

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
    return { sessions: [], lastClass: null, shoutOutsSent: [] };
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
      absentProfile:absent_profile_id (id, full_name, avatar_url),
      subProfile:sub_profile_id (id, full_name, avatar_url)
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

  // Get all assignments for these classes (to find co-teachers)
  const { data: allAssignments } = await supabase
    .from("class_assignments")
    .select(`
      class_id,
      profile_id,
      slot_type,
      profiles:profile_id (id, full_name, avatar_url)
    `)
    .in("class_id", classIds)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  // Build co-teacher map
  const coTeacherMap = {};
  (allAssignments || []).forEach((a) => {
    if (a.profile_id !== profileId && a.profiles) {
      coTeacherMap[a.class_id] = a.profiles;
    }
  });

  // Get shout-outs sent by this instructor in the date range
  const { data: shoutOutsSent } = await supabase
    .from("shout_outs")
    .select("id, to_profile_id, context_class_id, context_date, status")
    .eq("from_profile_id", profileId)
    .gte("created_at", startDate + "T00:00:00")
    .lte("created_at", endDate + "T23:59:59");

  // Build shout-out lookup
  const shoutOutsByClassDate = new Map();
  (shoutOutsSent || []).forEach((so) => {
    if (so.context_class_id && so.context_date) {
      const key = `${so.context_class_id}|${so.context_date}|${so.to_profile_id}`;
      shoutOutsByClassDate.set(key, so);
    }
  });

  // Get class notes for this instructor
  const classNotes = await getClassNotes(profileId, startDate, endDate);
  const notesByClassDate = new Map();
  (classNotes || []).forEach((note) => {
    const key = `${note.class_id}|${note.session_date}`;
    notesByClassDate.set(key, note);
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
    const programOffDates = new Set(programOffDays.map((d) => d.date));

    // Generate dates for this class
    const classDates = generateClassDates(cls, startDate, endDate);

    for (const date of classDates) {
      // Skip future dates
      if (date > today) continue;

      // Skip holidays and program off days (don't show at all per spec)
      if (holidayDates.has(date) || programOffDates.has(date)) {
        continue;
      }

      const key = `${cls.id}|${date}`;
      const absence = absencesByClassDate.get(key);
      const coTeacher = coTeacherMap[cls.id] || null;
      const note = notesByClassDate.get(key);

      // Check if instructor was out
      if (absence) {
        // Check if thanked the sub
        let thankedSub = false;
        if (absence.subProfile) {
          const thankKey = `${cls.id}|${date}|${absence.subProfile.id}`;
          thankedSub = shoutOutsByClassDate.has(thankKey);
        }

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
          sub: absence.subProfile || null,
          coTeacher,
          note: null, // Can't add note when out
          canAddNote: false,
          canThank: !!absence.subProfile,
          thankRecipient: absence.subProfile || null,
          thanked: thankedSub,
        });
        continue;
      }

      // Check if thanked co-teacher
      let thankedCoTeacher = false;
      if (coTeacher) {
        const thankKey = `${cls.id}|${date}|${coTeacher.id}`;
        thankedCoTeacher = shoutOutsByClassDate.has(thankKey);
      }

      // Normal session - taught
      sessions.push({
        id: `${cls.id}-${date}`,
        classId: cls.id,
        date,
        type: "taught",
        schoolName: school.name,
        schoolId: school.id,
        program: cls.program || "wellness",
        time: cls.time,
        coTeacher,
        note: note || null,
        canAddNote: true,
        canThank: !!coTeacher,
        thankRecipient: coTeacher,
        thanked: thankedCoTeacher,
      });
    }
  }

  // Add subbed sessions (where this instructor filled in for someone else)
  for (const [, sc] of subSessionsByClassDate) {
    // Skip if this is one of their own classes
    if (classIds.includes(sc.class_id)) continue;

    // Skip future dates
    if (sc.session_date > today) continue;

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

    const key = `${sc.class_id}|${sc.session_date}`;
    const note = notesByClassDate.get(key);

    sessions.push({
      id: `${sc.class_id}-${sc.session_date}-sub`,
      classId: sc.class_id,
      date: sc.session_date,
      type: "subbed",
      schoolName: cls.schools.name,
      schoolId: cls.schools.id,
      program: cls.program || "wellness",
      time: cls.time,
      coveredFor: sc.absentProfile || null,
      note: note || null,
      canAddNote: true,
      canThank: false, // Don't show thank button for subbed sessions per spec
      thankRecipient: null,
      thanked: false,
    });
  }

  // Sort by date descending (most recent first)
  sessions.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.time || "").localeCompare(b.time || "");
  });

  // Find the last class (most recent taught/subbed session)
  const lastClass = sessions.find((s) => s.type === "taught" || s.type === "subbed") || null;

  return {
    sessions,
    lastClass,
    shoutOutsSent: shoutOutsSent || [],
  };
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
 * Group sessions by week.
 * Returns array of { label: "Week of Mon D", sessions: [...] }
 */
export function groupSessionsByWeek(sessions) {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const groups = new Map();

  for (const session of sessions) {
    const date = parseDate(session.date);
    // Find Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);

    const label = `Week of ${MONTHS[monday.getMonth()]} ${monday.getDate()}`;
    const key = formatDate(monday);

    if (!groups.has(key)) {
      groups.set(key, { label, sessions: [] });
    }
    groups.get(key).sessions.push(session);
  }

  // Convert to array, sorted by date descending
  return Array.from(groups.values()).sort((a, b) => {
    const aDate = a.sessions[0]?.date || "";
    const bDate = b.sessions[0]?.date || "";
    return bDate.localeCompare(aDate);
  });
}
