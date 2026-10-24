/**
 * Payroll Schedule Calculator
 * ===========================
 * Pure date functions for computing pay periods.
 * All dates are handled as YYYY-MM-DD strings in America/Los_Angeles timezone.
 * No database access - this module is pure functions.
 */

/**
 * Parse a YYYY-MM-DD string to a Date object in local timezone
 * Avoids UTC shift issues by using component parsing
 */
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

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
 * Add days to a date string, return new date string
 */
function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Get the start of the period containing a given date
 * @param {string} dateStr - Date to check (YYYY-MM-DD)
 * @param {Object} settings - Payroll settings
 * @param {string} settings.anchorDate - Anchor date (YYYY-MM-DD)
 * @param {number} settings.periodDays - Period length in days
 * @returns {string} Period start date (YYYY-MM-DD)
 */
export function getPeriodStart(dateStr, settings) {
  const { anchorDate, periodDays } = settings;

  const anchor = parseDate(anchorDate);
  const target = parseDate(dateStr);

  // Calculate days since anchor
  const diffMs = target.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If before anchor, return null (no periods before anchor)
  if (diffDays < 0) {
    return null;
  }

  // Calculate which period number (0-indexed)
  const periodNum = Math.floor(diffDays / periodDays);

  // Calculate start date
  const startDate = new Date(anchor);
  startDate.setDate(startDate.getDate() + periodNum * periodDays);

  return formatDate(startDate);
}

/**
 * Get the full period info for a given date
 * @param {string} dateStr - Date to check (YYYY-MM-DD)
 * @param {Object} settings - Payroll settings
 * @returns {Object|null} Period info or null if before anchor
 */
export function getPeriodForDate(dateStr, settings) {
  const { anchorDate, periodDays, dueOffsetDays, paydayOffsetDays } = settings;

  const startDate = getPeriodStart(dateStr, settings);
  if (!startDate) {
    return null;
  }

  const endDate = addDays(startDate, periodDays - 1);
  const dueDate = addDays(endDate, dueOffsetDays);
  const payday = addDays(endDate, paydayOffsetDays);

  return {
    startDate,
    endDate,
    dueDate,
    payday,
  };
}

/**
 * Get the due date for a period
 * @param {string} periodEndDate - Period end date (YYYY-MM-DD)
 * @param {number} dueOffsetDays - Days after period end
 * @returns {string} Due date (YYYY-MM-DD)
 */
export function getDueDate(periodEndDate, dueOffsetDays) {
  return addDays(periodEndDate, dueOffsetDays);
}

/**
 * Get the payday for a period
 * @param {string} periodEndDate - Period end date (YYYY-MM-DD)
 * @param {number} paydayOffsetDays - Days after period end
 * @returns {string} Payday (YYYY-MM-DD)
 */
export function getPayday(periodEndDate, paydayOffsetDays) {
  return addDays(periodEndDate, paydayOffsetDays);
}

/**
 * Get all periods between two dates (inclusive)
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @param {Object} settings - Payroll settings
 * @returns {Array} Array of period objects
 */
export function getPeriodsBetween(fromDate, toDate, settings) {
  const periods = [];
  const { anchorDate, periodDays } = settings;

  // Start from the first period on or after anchor that overlaps with fromDate
  let current = getPeriodStart(fromDate, settings);
  if (!current) {
    current = anchorDate;
  }

  while (current <= toDate) {
    const period = getPeriodForDate(current, settings);
    if (period && period.startDate >= anchorDate) {
      periods.push(period);
    }
    current = addDays(current, periodDays);
  }

  return periods;
}

/**
 * Get the next period after the given period
 * @param {Object} currentPeriod - Current period object
 * @param {Object} settings - Payroll settings
 * @returns {Object} Next period object
 */
export function getNextPeriod(currentPeriod, settings) {
  const nextStart = addDays(currentPeriod.endDate, 1);
  return getPeriodForDate(nextStart, settings);
}

/**
 * Get the previous period before the given period
 * @param {Object} currentPeriod - Current period object
 * @param {Object} settings - Payroll settings
 * @returns {Object|null} Previous period object or null if at anchor
 */
export function getPreviousPeriod(currentPeriod, settings) {
  const prevEnd = addDays(currentPeriod.startDate, -1);
  return getPeriodForDate(prevEnd, settings);
}

/**
 * Check if a period has ended
 * @param {Object} period - Period object
 * @param {string} today - Today's date (YYYY-MM-DD)
 * @returns {boolean}
 */
export function isPeriodEnded(period, today) {
  return period.endDate < today;
}

/**
 * Check if a period is in progress
 * @param {Object} period - Period object
 * @param {string} today - Today's date (YYYY-MM-DD)
 * @returns {boolean}
 */
export function isPeriodInProgress(period, today) {
  return period.startDate <= today && today <= period.endDate;
}

/**
 * Check if a period is due soon (within 2 days)
 * @param {Object} period - Period object
 * @param {string} today - Today's date (YYYY-MM-DD)
 * @returns {boolean}
 */
export function isDueSoon(period, today) {
  const twoDaysBefore = addDays(period.dueDate, -2);
  return today >= twoDaysBefore && today < period.dueDate;
}

/**
 * Check if a period is overdue
 * @param {Object} period - Period object
 * @param {string} today - Today's date (YYYY-MM-DD)
 * @returns {boolean}
 */
export function isOverdue(period, today) {
  return today > period.dueDate;
}

/**
 * Format a date for display (e.g., "Sep 5")
 */
export function formatDateShort(dateStr) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = parseDate(dateStr);
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format a date with day name (e.g., "Fri, Sep 25")
 */
export function formatDateWithDay(dateStr) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const date = parseDate(dateStr);
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format a period date range (e.g., "Sep 5 - 18, 2026")
 * Uses en dash per requirements
 */
export function formatPeriodRange(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    // Same month: "Sep 5 – 18, 2026"
    return `${months[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
  } else if (start.getFullYear() === end.getFullYear()) {
    // Same year, different month: "Sep 19 – Oct 2, 2026"
    return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
  } else {
    // Different year
    return `${months[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} – ${months[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
}

/**
 * Format a short period range for display (e.g., "Sep 5 – 18")
 */
export function formatPeriodRangeShort(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  if (start.getMonth() === end.getMonth()) {
    // Same month: "Sep 5 – 18"
    return `${months[start.getMonth()]} ${start.getDate()} – ${end.getDate()}`;
  } else {
    // Different month: "Sep 19 – Oct 2"
    return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`;
  }
}

/**
 * Get today's date as YYYY-MM-DD in America/Los_Angeles timezone
 */
export function getTodayLA() {
  const now = new Date();
  // Use Intl to get the correct date in LA timezone
  const laDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return formatDate(laDate);
}

// Export parseDate and formatDate for use by other modules
export { parseDate, formatDate, addDays };
