/**
 * Formatting utilities
 */

/**
 * Format a phone number as (XXX) XXX-XXXX
 * Returns "—" if no phone provided
 * @param {string|null} phone - Raw phone number
 * @returns {string} Formatted phone number
 */
export function formatPhone(phone) {
  if (!phone) return "—";

  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Handle 10-digit US numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Handle 11-digit numbers starting with 1 (US country code)
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // Return original if can't format
  return phone;
}

/**
 * Format a date as "Mon DD, YYYY"
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Format a date as "Mon DD" (no year)
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
export function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format a session date as "Day, Mon DD"
 * @param {string} dateStr - YYYY-MM-DD date string
 * @returns {string} Formatted date
 */
export function formatSessionDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}
