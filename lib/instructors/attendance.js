import { createClient } from "@/lib/supabase/server";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";

/**
 * Get the current school year boundaries (Aug 1 to Jul 31 in LA time)
 */
function getSchoolYearBounds() {
  const now = new Date();
  const laDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const year = laDate.getMonth() >= 7 ? laDate.getFullYear() : laDate.getFullYear() - 1;
  return {
    start: `${year}-08-01`,
    end: `${year + 1}-07-31`,
    startYear: year,
  };
}

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
 * Get today's date as YYYY-MM-DD in America/Los_Angeles timezone
 */
function getTodayLA() {
  const now = new Date();
  const laDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return formatDate(laDate);
}

/**
 * Calculate notice description from days difference
 */
function getNoticeText(daysDiff) {
  if (daysDiff === 0) return "Same day";
  if (daysDiff < 7) return `${daysDiff} day${daysDiff > 1 ? "s" : ""} ahead`;
  const weeks = Math.floor(daysDiff / 7);
  return `${weeks} week${weeks > 1 ? "s" : ""} ahead`;
}

/**
 * Get notice level for styling: 'same-day', 'short', 'good'
 */
function getNoticeLevel(daysDiff) {
  if (daysDiff === 0) return "same-day";
  if (daysDiff < 7) return "short";
  return "good";
}

/**
 * Get attendance data for an instructor
 * @param {string} profileId - The instructor's profile ID
 */
export async function getAttendance(profileId) {
  const supabase = await createClient();
  const { start: schoolYearStart, end: schoolYearEnd, startYear } = getSchoolYearBounds();
  const today = getTodayLA();

  // Default empty result
  const emptyResult = {
    daysOut: [],
    stats: {
      totalDaysOut: 0,
      classesScheduled: 0,
      oneInN: null,
      withWeekNotice: 0,
      totalWithNotice: 0,
      sameDayByReason: [],
      classesWithoutSub: 0,
      timesSubbed: 0,
    },
    monthByMonth: Array(12).fill(null),
    byReason: {},
    coveredForOthers: [],
    requests: [],
  };

  // -----------------------------------------------------------------------------
  // 1. Fetch session_changes where this instructor was absent
  // -----------------------------------------------------------------------------
  const { data: absences, error: absencesError } = await supabase
    .from("session_changes")
    .select(`
      id,
      class_id,
      session_date,
      slot_type,
      reason,
      sub_profile_id,
      notified_on,
      absence_group_id,
      created_at,
      classes:class_id (
        id,
        program,
        time,
        schools:school_id (
          id,
          name
        )
      ),
      subProfile:sub_profile_id (
        id,
        full_name
      )
    `)
    .eq("absent_profile_id", profileId)
    .gte("session_date", schoolYearStart)
    .lte("session_date", schoolYearEnd)
    .order("session_date", { ascending: false });

  if (absencesError) {
    console.error("Error fetching absences:", absencesError);
    return emptyResult;
  }

  // -----------------------------------------------------------------------------
  // 2. Fetch session_changes where this instructor subbed for others
  // -----------------------------------------------------------------------------
  const { data: subbed, error: subbedError } = await supabase
    .from("session_changes")
    .select(`
      id,
      class_id,
      session_date,
      absent_profile_id,
      classes:class_id (
        id,
        program,
        time,
        schools:school_id (
          id,
          name
        )
      ),
      absentProfile:absent_profile_id (
        id,
        full_name
      )
    `)
    .eq("sub_profile_id", profileId)
    .gte("session_date", schoolYearStart)
    .lte("session_date", schoolYearEnd)
    .order("session_date", { ascending: false });

  if (subbedError) {
    console.error("Error fetching subbed sessions:", subbedError);
  }

  // -----------------------------------------------------------------------------
  // 3. Fetch time off requests
  // -----------------------------------------------------------------------------
  const { data: requests, error: requestsError } = await supabase
    .from("time_off_requests")
    .select(`
      id,
      start_date,
      end_date,
      reason,
      note,
      requested_on,
      status,
      decided_by,
      decided_at,
      decision_note,
      absence_group_id,
      created_at,
      decider:decided_by (
        id,
        full_name
      )
    `)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (requestsError) {
    // Table might not exist yet
    if (!requestsError.message?.includes("does not exist")) {
      console.error("Error fetching time off requests:", requestsError);
    }
  }

  // -----------------------------------------------------------------------------
  // 4. Fetch instructor's class assignments to calculate scheduled classes
  // -----------------------------------------------------------------------------
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      id,
      class_id,
      slot_type,
      classes:class_id (
        id,
        program,
        days,
        time,
        start_date,
        target_sessions,
        schools:school_id (
          id,
          name,
          district_id
        )
      )
    `)
    .eq("profile_id", profileId);

  // Fetch holidays and program off days for occurrence calculation
  const { data: holidays } = await supabase
    .from("holidays")
    .select("date, name, time_period, district_id, school_id")
    .order("date");

  const { data: programOffDays } = await supabase
    .from("program_off_days")
    .select("date, reason, program")
    .order("date");

  // -----------------------------------------------------------------------------
  // 5. Calculate scheduled classes count
  // -----------------------------------------------------------------------------
  let scheduledClassCount = 0;
  const assignmentsList = assignments || [];

  for (const a of assignmentsList) {
    const cls = a.classes;
    if (!cls || !cls.start_date || !cls.days) continue;

    const classHolidays = (holidays || [])
      .filter(h => {
        if (h.district_id === null && h.school_id === null) return true;
        if (h.district_id === cls.schools?.district_id && h.school_id === null) return true;
        if (h.school_id === cls.schools?.id) return true;
        return false;
      })
      .map(h => ({ date: h.date, name: h.name, time_period: h.time_period || "all_day" }));

    const classOffDays = (programOffDays || [])
      .filter(od => !od.program || od.program === cls.program)
      .map(od => ({ date: od.date, reason: od.reason }));

    const result = computeClassOccurrences({
      startDate: cls.start_date,
      days: cls.days,
      targetSessions: cls.target_sessions,
      holidays: classHolidays,
      programOffDays: classOffDays,
      classTime: cls.time,
      rangeEnd: null,
    });

    // Count occurrences within the school year that have already passed
    for (const occ of result.occurrences) {
      if (occ.date >= schoolYearStart && occ.date <= today) {
        scheduledClassCount++;
      }
    }
  }

  // -----------------------------------------------------------------------------
  // 6. Group absences by date (one day might have multiple classes)
  // -----------------------------------------------------------------------------
  const absencesByDate = {};
  (absences || []).forEach(a => {
    if (!absencesByDate[a.session_date]) {
      absencesByDate[a.session_date] = {
        date: a.session_date,
        sessions: [],
        reason: a.reason,
        notifiedOn: a.notified_on,
      };
    }
    absencesByDate[a.session_date].sessions.push({
      id: a.id,
      classId: a.class_id,
      schoolName: a.classes?.schools?.name,
      program: a.classes?.program,
      time: a.classes?.time,
      subName: a.subProfile?.full_name || null,
      hasSub: !!a.sub_profile_id,
    });
  });

  // Build days out list with notice calculation
  const daysOut = Object.values(absencesByDate).map(day => {
    const sessionDate = new Date(day.date + "T00:00:00");
    const notifiedDate = day.notifiedOn ? new Date(day.notifiedOn + "T00:00:00") : sessionDate;
    const daysDiff = Math.floor((sessionDate - notifiedDate) / (1000 * 60 * 60 * 24));

    return {
      date: day.date,
      reason: day.reason || "other",
      sessions: day.sessions,
      noticeText: getNoticeText(daysDiff),
      noticeLevel: getNoticeLevel(daysDiff),
      noticeDays: daysDiff,
    };
  });

  // -----------------------------------------------------------------------------
  // 7. Calculate stats
  // -----------------------------------------------------------------------------
  const totalDaysOut = daysOut.length;
  const withWeekNotice = daysOut.filter(d => d.noticeDays >= 7).length;

  // Same-day absences by reason
  const sameDayAbsences = daysOut.filter(d => d.noticeDays === 0);
  const sameDayByReason = [];
  const reasonCounts = {};
  sameDayAbsences.forEach(d => {
    reasonCounts[d.reason] = (reasonCounts[d.reason] || 0) + 1;
  });
  Object.entries(reasonCounts).forEach(([reason, count]) => {
    sameDayByReason.push({ reason, count });
  });

  // Classes without sub (past dates only)
  let classesWithoutSub = 0;
  (absences || []).forEach(a => {
    if (a.session_date < today && !a.sub_profile_id) {
      classesWithoutSub++;
    }
  });

  // One in N calculation
  const oneInN = totalDaysOut > 0 && scheduledClassCount > 0
    ? Math.round(scheduledClassCount / totalDaysOut)
    : null;

  // -----------------------------------------------------------------------------
  // 8. Month by month (Aug = index 0, Jul = index 11)
  // -----------------------------------------------------------------------------
  const monthByMonth = Array(12).fill(0);
  const currentMonth = new Date().getMonth(); // 0-11
  const currentYear = new Date().getFullYear();

  daysOut.forEach(d => {
    const date = new Date(d.date + "T00:00:00");
    const month = date.getMonth();
    // Map to school year: Aug (7) = 0, Sep (8) = 1, ..., Jul (6) = 11
    const idx = (month - 7 + 12) % 12;
    monthByMonth[idx]++;
  });

  // Mark future months as null
  const currentSchoolYearMonth = (currentMonth - 7 + 12) % 12;
  for (let i = currentSchoolYearMonth + 1; i < 12; i++) {
    // Only mark as null if we're in the current school year
    const monthInQuestion = (i + 7) % 12;
    const yearForMonth = monthInQuestion >= 7 ? startYear : startYear + 1;
    if (yearForMonth > currentYear || (yearForMonth === currentYear && monthInQuestion > currentMonth)) {
      monthByMonth[i] = null;
    }
  }

  // -----------------------------------------------------------------------------
  // 9. By reason
  // -----------------------------------------------------------------------------
  const byReason = {};
  daysOut.forEach(d => {
    byReason[d.reason] = (byReason[d.reason] || 0) + 1;
  });

  // -----------------------------------------------------------------------------
  // 10. Covered for others
  // -----------------------------------------------------------------------------
  const coveredForOthers = (subbed || []).map(s => ({
    id: s.id,
    date: s.session_date,
    schoolName: s.classes?.schools?.name,
    program: s.classes?.program,
    time: s.classes?.time,
    forName: s.absentProfile?.full_name?.split(" ")[0] || "someone",
  }));

  // -----------------------------------------------------------------------------
  // 11. Process time off requests
  // -----------------------------------------------------------------------------
  const processedRequests = [];
  for (const req of (requests || [])) {
    // Find affected classes
    const affectedClasses = [];
    let classesNeedingSub = 0;

    if (req.status === "approved" && req.absence_group_id) {
      // Get session changes for this request
      const { data: sessionChanges } = await supabase
        .from("session_changes")
        .select(`
          id,
          session_date,
          sub_profile_id,
          classes:class_id (
            id,
            time,
            schools:school_id (
              id,
              name
            )
          )
        `)
        .eq("absence_group_id", req.absence_group_id);

      (sessionChanges || []).forEach(sc => {
        affectedClasses.push({
          id: sc.id,
          date: sc.session_date,
          schoolName: sc.classes?.schools?.name,
          time: sc.classes?.time,
          hasSub: !!sc.sub_profile_id,
        });
        if (!sc.sub_profile_id && sc.session_date >= today) {
          classesNeedingSub++;
        }
      });
    } else if (req.status === "pending") {
      // Calculate what classes would be affected
      for (const a of assignmentsList) {
        const cls = a.classes;
        if (!cls || !cls.start_date || !cls.days) continue;

        const classHolidays = (holidays || [])
          .filter(h => {
            if (h.district_id === null && h.school_id === null) return true;
            if (h.district_id === cls.schools?.district_id && h.school_id === null) return true;
            if (h.school_id === cls.schools?.id) return true;
            return false;
          })
          .map(h => ({ date: h.date, name: h.name, time_period: h.time_period || "all_day" }));

        const classOffDays = (programOffDays || [])
          .filter(od => !od.program || od.program === cls.program)
          .map(od => ({ date: od.date, reason: od.reason }));

        const result = computeClassOccurrences({
          startDate: cls.start_date,
          days: cls.days,
          targetSessions: cls.target_sessions,
          holidays: classHolidays,
          programOffDays: classOffDays,
          classTime: cls.time,
          rangeEnd: null,
        });

        for (const occ of result.occurrences) {
          if (occ.date >= req.start_date && occ.date <= req.end_date) {
            affectedClasses.push({
              id: `${cls.id}-${occ.date}`,
              date: occ.date,
              schoolName: cls.schools?.name,
              time: cls.time,
              hasSub: false,
            });
            classesNeedingSub++;
          }
        }
      }
    }

    // Calculate notice
    const startDate = new Date(req.start_date + "T00:00:00");
    const requestedDate = new Date(req.requested_on + "T00:00:00");
    const noticeDays = Math.floor((startDate - requestedDate) / (1000 * 60 * 60 * 24));

    processedRequests.push({
      id: req.id,
      startDate: req.start_date,
      endDate: req.end_date,
      reason: req.reason,
      note: req.note,
      requestedOn: req.requested_on,
      status: req.status,
      decidedAt: req.decided_at,
      decisionNote: req.decision_note,
      deciderName: req.decider?.full_name?.split(" ")[0],
      absenceGroupId: req.absence_group_id,
      affectedClasses,
      classesNeedingSub,
      noticeText: getNoticeText(noticeDays),
      noticeDays,
    });
  }

  // Sort requests: pending first, then by start date
  processedRequests.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    // Then by start date (upcoming first)
    if (a.startDate >= today && b.startDate < today) return -1;
    if (a.startDate < today && b.startDate >= today) return 1;
    return b.startDate.localeCompare(a.startDate);
  });

  // -----------------------------------------------------------------------------
  // Return complete attendance data
  // -----------------------------------------------------------------------------
  return {
    daysOut,
    stats: {
      totalDaysOut,
      classesScheduled: scheduledClassCount,
      oneInN,
      withWeekNotice,
      totalWithNotice: totalDaysOut,
      sameDayByReason,
      classesWithoutSub,
      timesSubbed: (subbed || []).length,
    },
    monthByMonth,
    byReason,
    coveredForOthers,
    requests: processedRequests,
  };
}
