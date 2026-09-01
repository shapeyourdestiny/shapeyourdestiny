/**
 * Certification status computation utility
 * Used for CPR, Food Handler's Card, and potentially future certifications
 */

// Days before expiration to show "Expiring Soon" warning
export const WARNING_THRESHOLD_DAYS = 45;

/**
 * Compute the status of a certification based on its expiration date
 * @param {string|Date|null} expirationDate - The expiration date
 * @param {number} warningDays - Days threshold for "Expiring Soon" (default 45)
 * @returns {{ label: string, className: string } | null} Status object or null if no date
 */
export function computeCertStatus(expirationDate, warningDays = WARNING_THRESHOLD_DAYS) {
  if (!expirationDate) {
    return null;
  }

  const expDate = new Date(expirationDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Expired", className: "expired" };
  }

  if (diffDays <= warningDays) {
    return { label: "Expiring Soon", className: "expiring" };
  }

  return { label: "Valid", className: "valid" };
}

/**
 * Format an expiration date for display
 * @param {string|Date|null} expirationDate - The expiration date
 * @returns {string} Formatted date string or "Not on file"
 */
export function formatExpirationDate(expirationDate) {
  if (!expirationDate) {
    return "Not on file";
  }

  const date = new Date(expirationDate);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `Expires ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
