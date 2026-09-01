import { createClient } from "@/lib/supabase/server";

/**
 * Map day names to JS Date getDay() values (0 = Sunday)
 */
const DAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

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
 * Get day name from date (Mon, Tue, etc.)
 */
function getDayName(date) {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[date.getDay()];
}

/**
 * Generate a consistent color for a school based on its ID.
 * Uses a hash of the UUID to pick from a preset palette.
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

  // Simple hash: sum char codes
  let hash = 0;
  for (let i = 0; i < schoolId.length; i++) {
    hash += schoolId.charCodeAt(i);
  }

  return palette[hash % palette.length];
}

/**
 * Get all sessions for an instructor within a date range.
 * Expands recurring class days into actual calendar dates.
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
        num_weeks,
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
  const { data: allAssignments, error: coTeacherError } = await supabase
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

  if (coTeacherError) {
    console.error("Error fetching co-teachers:", coTeacherError);
  }

  // Build a map of class_id -> co-teacher (the other instructor)
  const coTeacherMap = {};
  (allAssignments || []).forEach((a) => {
    if (a.profile_id !== profileId && a.profiles) {
      coTeacherMap[a.class_id] = {
        id: a.profiles.id,
        name: a.profiles.full_name,
      };
    }
  });

  // Expand each class's recurring days into actual dates within range
  const sessions = [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");

  assignments.forEach((assignment) => {
    const cls = assignment.classes;
    if (!cls || !cls.days || !cls.schools) return;

    const school = cls.schools;
    const district = school.districts;

    // Get the days this class runs
    const classDays = cls.days.map((d) => DAY_MAP[d]).filter((d) => d !== undefined);

    // Iterate through each day in the range
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();

      // Check if this day matches one of the class days
      if (classDays.includes(dayOfWeek)) {
        const dateStr = formatDate(current);

        // Check if class has started (if start_date is set)
        if (cls.start_date && dateStr < cls.start_date) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        // Check if class has ended (based on num_weeks from start_date)
        if (cls.start_date && cls.num_weeks) {
          const classStart = new Date(cls.start_date + "T00:00:00");
          const classEnd = new Date(classStart);
          classEnd.setDate(classEnd.getDate() + cls.num_weeks * 7);
          if (current > classEnd) {
            current.setDate(current.getDate() + 1);
            continue;
          }
        }

        sessions.push({
          id: `${cls.id}-${dateStr}`,
          classId: cls.id,
          date: dateStr,
          dayName: getDayName(current),
          time: cls.time,
          isReviewDay: cls.is_review_day,
          school: {
            id: school.id,
            name: school.name,
            address: school.address,
            color: getSchoolColor(school.id),
          },
          district: district ? {
            id: district.id,
            name: district.name,
            color: district.color,
          } : null,
          coTeacher: coTeacherMap[cls.id] || null,
        });
      }

      current.setDate(current.getDate() + 1);
    }
  });

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
    .select("id, date, name, district_id")
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

  // Build class list with computed end dates
  const classes = [];

  for (const assignment of assignments) {
    const cls = assignment.classes;
    if (!cls || !cls.schools) continue;

    const school = cls.schools;
    const district = school.districts;

    // Compute end date if target_sessions is set
    let endDate = null;
    let durationText = "Ongoing, no end date";

    if (cls.start_date && cls.target_sessions) {
      // Import computeClassOccurrences dynamically to avoid circular deps
      const { computeClassOccurrences, formatDateDisplay } = await import("./occurrences.js");

      const result = computeClassOccurrences({
        startDate: cls.start_date,
        days: cls.days,
        targetSessions: cls.target_sessions,
        holidays: [],
        programOffDays: [],
      });

      if (result.endDate) {
        endDate = result.endDate;
        const weeksCount = cls.target_sessions;
        durationText = `${weeksCount}-week session, runs through ${formatDateDisplay(result.endDate)}`;
      }
    }

    // Format days display
    const daysDisplay = cls.days?.join(" & ") || "";

    classes.push({
      id: cls.id,
      program: cls.program || "wellness", // default to wellness if not set
      school: {
        id: school.id,
        name: school.name,
        address: school.address,
        color: getSchoolColor(school.id),
      },
      district: district ? { id: district.id, name: district.name } : null,
      days: cls.days || [],
      daysDisplay,
      time: cls.time,
      startDate: cls.start_date,
      endDate,
      durationText,
      targetSessions: cls.target_sessions,
    });
  }

  return classes;
}

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
    // Skip sessions from today that have already passed (if we had time comparison)
    // For now, just return the first upcoming session
    if (session.date >= todayStr) {
      // Check if school has address, log warning if not
      if (!session.school.address) {
        console.warn(
          `School ${session.school.id} (${session.school.name}) has no address on file`
        );
      }

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
