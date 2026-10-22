/**
 * Session Calculator
 * ==================
 * Computes actual session dates for a class, properly accounting for:
 * - Holidays (global, district-level, or school-level)
 * - Program off days (only for the class's program)
 *
 * This mirrors the logic in ScheduleBoard's isClassActiveOnDate().
 */

import { createClient } from "@/lib/supabase/server";
import { computeClassOccurrences } from "./occurrences.js";

/**
 * Format a Date object as YYYY-MM-DD string
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Fetch holidays applicable to a specific school.
 * Includes: global holidays, district holidays, and school-specific holidays.
 *
 * @param {string} districtId - The district ID
 * @param {string} schoolId - The school ID
 * @param {string} startDate - Start of date range (YYYY-MM-DD)
 * @param {string} endDate - End of date range (YYYY-MM-DD), optional
 * @returns {Promise<Array<{date: string, name: string}>>}
 */
export async function getHolidaysForSchool(districtId, schoolId, startDate, endDate = null) {
  const supabase = await createClient();

  let query = supabase
    .from("holidays")
    .select("date, name, district_id, school_id")
    .gte("date", startDate);

  if (endDate) {
    query = query.lte("date", endDate);
  }

  const { data: holidays, error } = await query.order("date");

  if (error) {
    console.error("Error fetching holidays:", error);
    return [];
  }

  // Filter to only those applicable to this school
  return (holidays || []).filter((h) => {
    // Global holiday (applies to all)
    if (h.district_id === null && h.school_id === null) return true;
    // District-specific holiday (applies to all schools in district)
    if (h.district_id === districtId && h.school_id === null) return true;
    // School-specific holiday
    if (h.school_id === schoolId) return true;
    return false;
  });
}

/**
 * Fetch program off days for a specific program.
 *
 * @param {string} program - The program name ('wellness' or 'soccer')
 * @param {string} startDate - Start of date range (YYYY-MM-DD)
 * @param {string} endDate - End of date range (YYYY-MM-DD), optional
 * @returns {Promise<Array<{date: string, reason: string}>>}
 */
export async function getProgramOffDays(program, startDate, endDate = null) {
  const supabase = await createClient();

  let query = supabase
    .from("program_off_days")
    .select("date, reason")
    .eq("program", program)
    .gte("date", startDate);

  if (endDate) {
    query = query.lte("date", endDate);
  }

  const { data, error } = await query.order("date");

  if (error) {
    console.error("Error fetching program off days:", error);
    return [];
  }

  return data || [];
}

/**
 * Get all session dates for a class within a date range.
 * Properly excludes holidays and program off days.
 *
 * @param {Object} classData - Class information
 * @param {string} classData.startDate - Class start date (YYYY-MM-DD)
 * @param {string[]} classData.days - Days of week the class runs (e.g., ["Mon", "Wed"])
 * @param {number|null} classData.targetSessions - Number of sessions, or null for ongoing
 * @param {string} classData.program - Program name ('wellness' or 'soccer')
 * @param {string} classData.districtId - District ID for holiday scoping
 * @param {string} classData.schoolId - School ID for holiday scoping
 * @param {string} rangeStart - Start of range to return sessions for (YYYY-MM-DD)
 * @param {string} rangeEnd - End of range to return sessions for (YYYY-MM-DD)
 * @returns {Promise<{occurrences: Array<{date: string, weekday: string}>, endDate: string|null, skipped: Array}>}
 */
export async function getSessionsForClass(classData, rangeStart, rangeEnd) {
  const {
    startDate,
    days,
    targetSessions,
    program,
    districtId,
    schoolId,
  } = classData;

  if (!startDate || !days || days.length === 0) {
    return { occurrences: [], endDate: null, skipped: [] };
  }

  // Fetch holidays and off days starting from class start date
  const [holidays, programOffDays] = await Promise.all([
    getHolidaysForSchool(districtId, schoolId, startDate, rangeEnd),
    getProgramOffDays(program || "wellness", startDate, rangeEnd),
  ]);

  // Compute all occurrences
  const result = computeClassOccurrences({
    startDate,
    days,
    targetSessions,
    holidays,
    programOffDays,
    rangeEnd: targetSessions ? null : rangeEnd,
  });

  // Filter to only occurrences within the requested range
  const filteredOccurrences = result.occurrences.filter(
    (o) => o.date >= rangeStart && o.date <= rangeEnd
  );

  return {
    occurrences: filteredOccurrences,
    endDate: result.endDate,
    skipped: result.skipped,
    allOccurrences: result.occurrences, // Full list for progress calculation
  };
}

/**
 * Calculate sessions done and total for a class.
 *
 * @param {Object} classData - Class information (same as getSessionsForClass)
 * @returns {Promise<{sessionsDone: number, totalSessions: number|null, endDate: string|null}>}
 */
export async function getClassProgress(classData) {
  const { startDate, days, targetSessions, program, districtId, schoolId } = classData;

  if (!startDate || !days || days.length === 0) {
    return { sessionsDone: 0, totalSessions: null, endDate: null };
  }

  const today = formatDate(new Date());

  // For classes with target_sessions, we need to compute all occurrences
  // For ongoing classes, we just count from start to today

  // Look ahead far enough to cover all possible sessions
  const lookAheadEnd = new Date();
  lookAheadEnd.setFullYear(lookAheadEnd.getFullYear() + 2);
  const farFuture = formatDate(lookAheadEnd);

  const [holidays, programOffDays] = await Promise.all([
    getHolidaysForSchool(districtId, schoolId, startDate, farFuture),
    getProgramOffDays(program || "wellness", startDate, farFuture),
  ]);

  const result = computeClassOccurrences({
    startDate,
    days,
    targetSessions,
    holidays,
    programOffDays,
    rangeEnd: targetSessions ? null : today,
  });

  // Count sessions done (dates before or equal to today)
  const sessionsDone = result.occurrences.filter((o) => o.date <= today).length;

  // Total sessions is the target, or null for ongoing
  const totalSessions = targetSessions ? targetSessions * days.length : null;

  return {
    sessionsDone,
    totalSessions,
    endDate: result.endDate,
    allOccurrences: result.occurrences,
    skipped: result.skipped,
  };
}

/**
 * Find the next day off for a class (holiday or program off day).
 * Returns merged consecutive ranges.
 *
 * @param {Object} classData - Class information
 * @param {string} fromDate - Start looking from this date (YYYY-MM-DD)
 * @returns {Promise<{startDate: string, endDate: string, reason: string}|null>}
 */
export async function getNextDayOff(classData, fromDate) {
  const { startDate, days, program, districtId, schoolId } = classData;

  if (!startDate || !days || days.length === 0) {
    return null;
  }

  // Look ahead 6 months
  const lookAhead = new Date(fromDate);
  lookAhead.setMonth(lookAhead.getMonth() + 6);
  const endDate = formatDate(lookAhead);

  const [holidays, programOffDays] = await Promise.all([
    getHolidaysForSchool(districtId, schoolId, fromDate, endDate),
    getProgramOffDays(program || "wellness", fromDate, endDate),
  ]);

  // Build a map of date -> reason for all off days
  const offDayMap = new Map();

  for (const h of holidays) {
    offDayMap.set(h.date, h.name);
  }

  for (const od of programOffDays) {
    // Don't overwrite holiday with off day reason
    if (!offDayMap.has(od.date)) {
      offDayMap.set(od.date, od.reason);
    }
  }

  if (offDayMap.size === 0) {
    return null;
  }

  // Map day names to numbers
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const classDayNumbers = new Set(days.map((d) => dayMap[d]));

  // Find off days that fall on class days
  const relevantOffDays = [];
  for (const [date, reason] of offDayMap) {
    const d = new Date(date + "T00:00:00");
    if (classDayNumbers.has(d.getDay()) && date >= fromDate) {
      relevantOffDays.push({ date, reason });
    }
  }

  if (relevantOffDays.length === 0) {
    return null;
  }

  // Sort by date
  relevantOffDays.sort((a, b) => a.date.localeCompare(b.date));

  // Merge consecutive off days with the same reason
  const merged = [];
  let current = null;

  for (const day of relevantOffDays) {
    if (!current) {
      current = { startDate: day.date, endDate: day.date, reason: day.reason };
    } else {
      // Check if this day is consecutive (within 7 days for same weekday pattern)
      const prevEnd = new Date(current.endDate + "T00:00:00");
      const thisDate = new Date(day.date + "T00:00:00");
      const diffDays = (thisDate - prevEnd) / (1000 * 60 * 60 * 24);

      // Merge if within 7 days and same reason (or similar holiday name)
      if (diffDays <= 7 && (day.reason === current.reason || day.reason.includes(current.reason) || current.reason.includes(day.reason))) {
        current.endDate = day.date;
        // Keep the longer/more descriptive reason
        if (day.reason.length > current.reason.length) {
          current.reason = day.reason;
        }
      } else {
        merged.push(current);
        current = { startDate: day.date, endDate: day.date, reason: day.reason };
      }
    }
  }

  if (current) {
    merged.push(current);
  }

  // Return the first upcoming off day range
  return merged[0] || null;
}
