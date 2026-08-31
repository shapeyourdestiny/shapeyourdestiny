/**
 * Class Occurrence Calculator
 * ============================
 * Single source of truth for computing when a class actually runs,
 * accounting for holidays (org-wide) and program off days.
 *
 * This same function is used by:
 * - Add Class modal's live preview
 * - Week/Month/Year view rendering
 * - Any future features needing class occurrence data
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
 * Parse a YYYY-MM-DD string to a Date object (avoiding timezone issues)
 */
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Get the weekday name for a date (Mon, Tue, etc.)
 */
function getWeekdayName(date) {
  return DAY_NAMES[date.getDay()];
}

/**
 * Check if a date string is in a Set of date strings
 */
function isDateInSet(dateStr, dateSet) {
  return dateSet.has(dateStr);
}

/**
 * Compute class occurrences based on schedule parameters.
 *
 * @param {Object} params
 * @param {string} params.startDate - Start date as YYYY-MM-DD
 * @param {string[]} params.days - Array of weekday names (e.g., ["Mon", "Wed"])
 * @param {number|null} params.targetSessions - Number of sessions to generate per weekday, or null for ongoing
 * @param {Array<{date: string, name: string}>} params.holidays - Org-wide holidays
 * @param {Array<{date: string, reason: string}>} params.programOffDays - Program-specific off days
 * @param {string} [params.rangeEnd] - For ongoing classes, the end of the date range to compute (YYYY-MM-DD)
 *
 * @returns {Object} {
 *   occurrences: Array<{date: string, weekday: string}>,
 *   skipped: Array<{date: string, reason: string, type: 'holiday' | 'off_day'}>,
 *   endDate: string|null - Computed end date (only for targetSessions mode)
 * }
 */
export function computeClassOccurrences({
  startDate,
  days,
  targetSessions,
  holidays = [],
  programOffDays = [],
  rangeEnd = null,
}) {
  // Build Sets for quick lookup
  const holidayDates = new Map();
  holidays.forEach((h) => {
    holidayDates.set(h.date, h.name);
  });

  const offDayDates = new Map();
  programOffDays.forEach((od) => {
    offDayDates.set(od.date, od.reason);
  });

  // Normalize days array
  const selectedDays = new Set(days);

  // Track occurrences per weekday (for targetSessions mode)
  const countPerDay = {};
  days.forEach((d) => {
    countPerDay[d] = 0;
  });

  const occurrences = [];
  const skipped = [];

  // Start walking from startDate
  let current = parseDate(startDate);

  // For ongoing classes, we need a rangeEnd
  // For targetSessions, we walk until all weekdays reach the target
  const maxIterations = 365 * 3; // Safety limit: 3 years
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    const dateStr = formatDate(current);
    const weekday = getWeekdayName(current);

    // Check if this is a selected weekday
    if (selectedDays.has(weekday)) {
      // Check if it's a holiday
      if (holidayDates.has(dateStr)) {
        skipped.push({
          date: dateStr,
          reason: holidayDates.get(dateStr),
          type: "holiday",
        });
      }
      // Check if it's a program off day
      else if (offDayDates.has(dateStr)) {
        skipped.push({
          date: dateStr,
          reason: offDayDates.get(dateStr),
          type: "off_day",
        });
      }
      // Valid occurrence
      else {
        occurrences.push({
          date: dateStr,
          weekday,
        });

        if (targetSessions !== null) {
          countPerDay[weekday]++;
        }
      }
    }

    // Check termination conditions
    if (targetSessions !== null) {
      // For targetSessions mode: stop when ALL selected weekdays have reached target
      const allReached = days.every((d) => countPerDay[d] >= targetSessions);
      if (allReached) {
        break;
      }
    } else if (rangeEnd) {
      // For ongoing mode with rangeEnd: stop at end of range
      if (dateStr >= rangeEnd) {
        break;
      }
    } else {
      // Ongoing with no rangeEnd - shouldn't happen, but limit to 1 year
      if (iterations >= 365) {
        break;
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  // Compute endDate (last occurrence date) for targetSessions mode
  let endDate = null;
  if (targetSessions !== null && occurrences.length > 0) {
    endDate = occurrences[occurrences.length - 1].date;
  }

  return {
    occurrences,
    skipped,
    endDate,
  };
}

/**
 * Check if a specific date is a valid occurrence for a class.
 * Used by view renderers to determine if a class should show on a given date.
 *
 * @param {Object} params
 * @param {string} params.date - The date to check (YYYY-MM-DD)
 * @param {string} params.classStartDate - Class start date (YYYY-MM-DD)
 * @param {string[]} params.classDays - Weekdays the class runs on
 * @param {number|null} params.targetSessions - Target session count or null for ongoing
 * @param {Array} params.holidays - Org-wide holidays
 * @param {Array} params.programOffDays - Program-specific off days
 *
 * @returns {boolean} True if the class should appear on this date
 */
export function isClassOnDate({
  date,
  classStartDate,
  classDays,
  targetSessions,
  holidays = [],
  programOffDays = [],
}) {
  // Date must be on or after start date
  if (date < classStartDate) {
    return false;
  }

  // Check if it's a selected weekday
  const checkDate = parseDate(date);
  const weekday = getWeekdayName(checkDate);
  if (!classDays.includes(weekday)) {
    return false;
  }

  // Check if it's a holiday or off day
  const holidayDates = new Set(holidays.map((h) => h.date));
  const offDayDates = new Set(programOffDays.map((od) => od.date));
  if (holidayDates.has(date) || offDayDates.has(date)) {
    return false;
  }

  // For ongoing classes, it's valid
  if (targetSessions === null) {
    return true;
  }

  // For targetSessions mode, compute all occurrences up to this date
  // and check if this date is within the valid range
  const result = computeClassOccurrences({
    startDate: classStartDate,
    days: classDays,
    targetSessions,
    holidays,
    programOffDays,
  });

  // Check if date is within the computed occurrences
  return result.occurrences.some((o) => o.date === date);
}

/**
 * Format a date for display (e.g., "Sep 7")
 */
export function formatDateDisplay(dateStr) {
  const date = parseDate(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format a date for full display (e.g., "September 7, 2026")
 */
export function formatDateFull(dateStr) {
  const date = parseDate(dateStr);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
