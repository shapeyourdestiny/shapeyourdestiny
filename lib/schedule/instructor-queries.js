import { createClient } from "@/lib/supabase/server";
import { getSessionsForClass, getClassProgress, getNextDayOff } from "./sessions.js";
import { formatDateDisplay } from "./occurrences.js";

/**
 * Format a date as YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Generate a consistent color for a school based on its ID.
 */
function getSchoolColor(schoolId) {
  const palette = [
    "#3E8FA0", // teal
    "#6FCB55", // green
    "#9B59B6", // purple
    "#F2A65E", // orange
    "#E74C3C", // red
    "#3498DB", // blue
    "#1ABC9C", // turquoise
    "#E91E63", // pink
  ];

  let hash = 0;
  for (let i = 0; i < schoolId.length; i++) {
    hash += schoolId.charCodeAt(i);
  }

  return palette[hash % palette.length];
}

/**
 * Get all sessions for an instructor within a date range.
 * Properly accounts for holidays, program off days, and session changes (absences/subs).
 * - Excludes sessions where the instructor is marked as absent
 * - Includes sessions where the instructor is subbing for someone else
 *
 * @param {string} profileId - The instructor's profile ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of session objects
 */
export async function getInstructorSessions(profileId, startDate, endDate) {
  const supabase = await createClient();

  // Get all class assignments for this instructor
  const { data: assignments, error: assignmentsError } = await supabase
    .from("class_assignments")
    .select(`
      id,
      class_id,
      slot_type,
      classes:class_id (
        id,
        days,
        time,
        is_review_day,
        start_date,
        target_sessions,
        program,
        schools:school_id (
          id,
          name,
          address,
          districts:district_id (
            id,
            name,
            color
          )
        )
      )
    `)
    .eq("profile_id", profileId)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  if (assignmentsError) {
    console.error("Error fetching instructor assignments:", assignmentsError);
    return [];
  }

  if (!assignments || assignments.length === 0) {
    return [];
  }

  // Get class IDs to find co-teachers
  const classIds = assignments.map((a) => a.class_id);

  // Fetch all assignments for these classes to find co-teachers
  const { data: allAssignments } = await supabase
    .from("class_assignments")
    .select(`
      class_id,
      slot_type,
      profile_id,
      profiles:profile_id (
        id,
        full_name
      )
    `)
    .in("class_id", classIds)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  // Build a map of class_id -> co-teacher
  const coTeacherMap = {};
  (allAssignments || []).forEach((a) => {
    if (a.profile_id !== profileId && a.profiles) {
      coTeacherMap[a.class_id] = {
        id: a.profiles.id,
        name: a.profiles.full_name,
      };
    }
  });

  // Fetch session changes within the date range for this instructor
  // 1. Sessions where they are absent (exclude these)
  // 2. Sessions where they are subbing (include these)
  const { data: sessionChanges } = await supabase
    .from("session_changes_instructor_view")
    .select(`
      id,
      class_id,
      session_date,
      slot_type,
      absent_profile_id,
      sub_profile_id,
      absence_group_id
    `)
    .gte("session_date", startDate)
    .lte("session_date", endDate)
    .or(`absent_profile_id.eq.${profileId},sub_profile_id.eq.${profileId}`);

  // Index absences and sub sessions
  const absencesByClassDate = new Map();
  const subSessions = [];

  (sessionChanges || []).forEach((sc) => {
    if (sc.absent_profile_id === profileId) {
      // This instructor is absent for this session
      absencesByClassDate.set(`${sc.class_id}|${sc.session_date}`, sc);
    }
    if (sc.sub_profile_id === profileId) {
      // This instructor is subbing
      subSessions.push(sc);
    }
  });

  // Fetch class info for sub sessions (classes they don't regularly teach)
  const subClassIds = [...new Set(subSessions.map((sc) => sc.class_id))];
  let subClassesMap = {};

  if (subClassIds.length > 0) {
    const { data: subClasses } = await supabase
      .from("classes")
      .select(`
        id,
        days,
        time,
        program,
        start_date,
        is_review_day,
        schools!inner (
          id,
          name,
          address,
          districts (
            id,
            name,
            color
          )
        )
      `)
      .in("id", subClassIds);

    (subClasses || []).forEach((cls) => {
      subClassesMap[cls.id] = cls;
    });

    // Also fetch who the absent instructor is for each sub session
    const absentProfileIds = [...new Set(subSessions.map((sc) => sc.absent_profile_id))];
    if (absentProfileIds.length > 0) {
      const { data: absentProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", absentProfileIds);

      const absentProfilesMap = {};
      (absentProfiles || []).forEach((p) => {
        absentProfilesMap[p.id] = p;
      });

      // Attach absent profile info to sub sessions
      subSessions.forEach((sc) => {
        sc.absentProfile = absentProfilesMap[sc.absent_profile_id] || null;
      });
    }
  }

  // Generate sessions for each class
  const sessions = [];

  for (const assignment of assignments) {
    const cls = assignment.classes;
    if (!cls || !cls.days || !cls.schools) continue;

    const school = cls.schools;
    const district = school.districts;

    // Get sessions using the proper calendar logic
    const result = await getSessionsForClass(
      {
        startDate: cls.start_date,
        days: cls.days,
        targetSessions: cls.target_sessions,
        program: cls.program || "wellness",
        districtId: district?.id,
        schoolId: school.id,
      },
      startDate,
      endDate
    );

    // Convert occurrences to session objects
    for (const occurrence of result.occurrences) {
      // Skip if instructor is absent for this session
      const absenceKey = `${cls.id}|${occurrence.date}`;
      if (absencesByClassDate.has(absenceKey)) {
        continue;
      }

      sessions.push({
        id: `${cls.id}-${occurrence.date}`,
        classId: cls.id,
        date: occurrence.date,
        dayName: occurrence.weekday,
        time: cls.time,
        isReviewDay: cls.is_review_day,
        program: cls.program || "wellness",
        school: {
          id: school.id,
          name: school.name,
          address: school.address,
          color: getSchoolColor(school.id),
        },
        district: district
          ? {
              id: district.id,
              name: district.name,
              color: district.color,
            }
          : null,
        coTeacher: coTeacherMap[cls.id] || null,
        isCovering: false,
      });
    }
  }

  // Add sub sessions (where this instructor is filling in)
  for (const sc of subSessions) {
    const cls = subClassesMap[sc.class_id];
    if (!cls) continue;

    const school = cls.schools;
    const district = school.districts;

    sessions.push({
      id: `${sc.class_id}-${sc.session_date}-sub`,
      classId: sc.class_id,
      date: sc.session_date,
      dayName: new Date(sc.session_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }),
      time: cls.time,
      isReviewDay: cls.is_review_day,
      program: cls.program || "wellness",
      school: {
        id: school.id,
        name: school.name,
        address: school.address,
        color: getSchoolColor(school.id),
      },
      district: district
        ? {
            id: district.id,
            name: district.name,
            color: district.color,
          }
        : null,
      coTeacher: null, // Could be enhanced to include co-teacher
      isCovering: true,
      coveringFor: sc.absentProfile
        ? {
            id: sc.absentProfile.id,
            name: sc.absentProfile.full_name,
          }
        : null,
    });
  }

  // Sort by date, then time
  sessions.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.time.localeCompare(b.time);
  });

  return sessions;
}

/**
 * Get holidays within a date range.
 *
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of holiday objects
 */
export async function getHolidaysInRange(startDate, endDate) {
  const supabase = await createClient();

  const { data: holidays, error } = await supabase
    .from("holidays")
    .select("id, date, name, district_id, school_id, time_period")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) {
    console.error("Error fetching holidays:", error);
    return [];
  }

  return holidays || [];
}

/**
 * Get the next upcoming session for an instructor.
 *
 * @param {string} profileId - The instructor's profile ID
 * @returns {Promise<Object|null>} Next session or null if none scheduled
 */
export async function getNextSession(profileId) {
  const today = formatDate(new Date());

  // Look ahead 90 days for the next session
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 90);
  const endDate = formatDate(futureDate);

  const sessions = await getInstructorSessions(profileId, today, endDate);

  if (sessions.length === 0) {
    return null;
  }

  // Find the first session from today onwards
  const now = new Date();
  const todayStr = formatDate(now);

  for (const session of sessions) {
    if (session.date >= todayStr) {
      // Calculate days until session
      const sessionDate = new Date(session.date + "T00:00:00");
      const diffTime = sessionDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...session,
        daysUntil: diffDays,
      };
    }
  }

  return null;
}

/**
 * Get all classes an instructor is assigned to with full details.
 * Used for the "My Classes" roster on the schedule page.
 *
 * @param {string} profileId - The instructor's profile ID
 * @returns {Promise<Array>} Array of class objects with school, schedule, and duration info
 */
export async function getInstructorClasses(profileId) {
  const supabase = await createClient();

  // Get all class assignments for this instructor
  const { data: assignments, error } = await supabase
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
        target_sessions,
        program,
        schools:school_id (
          id,
          name,
          address,
          instructions,
          office_contact,
          office_phone,
          districts:district_id (
            id,
            name
          )
        )
      )
    `)
    .eq("profile_id", profileId)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  if (error) {
    console.error("Error fetching instructor classes:", error);
    return [];
  }

  if (!assignments || assignments.length === 0) {
    return [];
  }

  // Get co-teachers with phone and avatar
  const classIds = assignments.map((a) => a.class_id);
  const { data: allAssignments } = await supabase
    .from("class_assignments")
    .select(`
      class_id,
      profile_id,
      profiles:profile_id (
        id,
        full_name,
        phone,
        avatar_url
      )
    `)
    .in("class_id", classIds)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  const coTeacherMap = {};
  (allAssignments || []).forEach((a) => {
    if (a.profile_id !== profileId && a.profiles) {
      coTeacherMap[a.class_id] = {
        id: a.profiles.id,
        name: a.profiles.full_name,
        phone: a.profiles.phone || null,
        avatarUrl: a.profiles.avatar_url || null,
      };
    }
  });

  const today = formatDate(new Date());
  const classes = [];

  for (const assignment of assignments) {
    const cls = assignment.classes;
    if (!cls || !cls.schools) continue;

    const school = cls.schools;
    const district = school.districts;

    const classData = {
      startDate: cls.start_date,
      days: cls.days || [],
      targetSessions: cls.target_sessions,
      program: cls.program || "wellness",
      districtId: district?.id,
      schoolId: school.id,
    };

    // Get progress (sessions done / total)
    const progress = await getClassProgress(classData);

    // Get next day off
    const nextDayOff = await getNextDayOff(classData, today);

    // Build upcoming dates
    const upcoming = buildUpcomingDates(
      progress.allOccurrences || [],
      progress.skipped || [],
      cls.target_sessions,
      cls.time,
      today
    );

    // Format days display
    const daysDisplay = cls.days?.join(" & ") || "";

    // Build duration text
    let durationText = "Ongoing";
    if (cls.start_date && progress.endDate) {
      durationText = `${formatDateDisplay(cls.start_date)} – ${formatDateDisplay(progress.endDate)}`;
    } else if (cls.start_date) {
      durationText = `Started ${formatDateDisplay(cls.start_date)} · ongoing`;
    }

    classes.push({
      id: cls.id,
      program: cls.program || "wellness",
      school: {
        id: school.id,
        name: school.name,
        address: school.address,
        instructions: school.instructions || null,
        officeContact: school.office_contact || null,
        officePhone: school.office_phone || null,
        color: getSchoolColor(school.id),
      },
      district: district ? { id: district.id, name: district.name } : null,
      days: cls.days || [],
      daysDisplay,
      time: cls.time,
      startDate: cls.start_date,
      endDate: progress.endDate,
      durationText,
      targetSessions: cls.target_sessions,
      sessionsDone: progress.sessionsDone,
      totalSessions: progress.totalSessions,
      coTeacher: coTeacherMap[cls.id] || null,
      nextDayOff,
      upcoming,
    });
  }

  // Sort by school name, then time
  classes.sort((a, b) => {
    if (a.school.name !== b.school.name) {
      return a.school.name.localeCompare(b.school.name);
    }
    return (a.time || "").localeCompare(b.time || "");
  });

  return classes;
}

/**
 * Build the upcoming dates array for a class.
 * Merges sessions and skipped (off) days, sorted by date.
 *
 * @param {Array} allOccurrences - All session occurrences
 * @param {Array} skipped - Skipped dates (holidays/off days)
 * @param {number|null} targetSessions - Target sessions per weekday, or null for ongoing
 * @param {string} time - Class time
 * @param {string} today - Today's date (YYYY-MM-DD)
 * @returns {Array} Upcoming dates array
 */
function buildUpcomingDates(allOccurrences, skipped, targetSessions, time, today) {
  // Filter to only future dates
  const futureOccurrences = allOccurrences.filter((o) => o.date >= today);
  const futureSkipped = skipped.filter((s) => s.date >= today);

  // For ongoing classes, limit to next 8 weeks
  let maxDate = null;
  if (!targetSessions) {
    const eightWeeksOut = new Date();
    eightWeeksOut.setDate(eightWeeksOut.getDate() + 56);
    maxDate = formatDate(eightWeeksOut);
  }

  // Build combined array
  const items = [];
  let sessionNumber = allOccurrences.filter((o) => o.date < today).length;

  for (const occ of futureOccurrences) {
    if (maxDate && occ.date > maxDate) break;
    sessionNumber++;
    items.push({
      date: occ.date,
      type: "session",
      sessionNumber,
      reason: null,
      time,
    });
  }

  for (const skip of futureSkipped) {
    if (maxDate && skip.date > maxDate) continue;
    items.push({
      date: skip.date,
      type: "off",
      sessionNumber: null,
      reason: skip.reason,
      time: null,
    });
  }

  // Sort by date
  items.sort((a, b) => a.date.localeCompare(b.date));

  // Mark first as isNext, last session as isLast
  const lastSessionDate = futureOccurrences.length > 0 ? futureOccurrences[futureOccurrences.length - 1].date : null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.isNext = i === 0 && item.type === "session";
    item.isLast = item.type === "session" && item.date === lastSessionDate && targetSessions;
    item.totalSessions = targetSessions ? allOccurrences.length : null;
  }

  // Handle case where first item is an off day - find first session
  if (items.length > 0 && items[0].type === "off") {
    for (const item of items) {
      if (item.type === "session") {
        item.isNext = true;
        break;
      }
    }
  }

  return items;
}
