/**
 * ICS (iCalendar) builder for instructor calendar feeds.
 * Generates valid RFC 5545 calendar files.
 */

/**
 * Escape text for ICS format.
 * Escapes backslashes, semicolons, commas, and newlines.
 */
function escapeIcsText(text) {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Fold lines at 75 octets as per RFC 5545.
 * Continuation lines start with a space.
 */
function foldLine(line) {
  const result = [];
  let remaining = line;

  while (remaining.length > 75) {
    // Find a safe break point (within 75 bytes)
    let breakPoint = 75;

    // Don't break in the middle of a UTF-8 character
    while (breakPoint > 0 && isHighByte(remaining.charCodeAt(breakPoint))) {
      breakPoint--;
    }

    if (breakPoint === 0) breakPoint = 75; // Fallback

    result.push(remaining.slice(0, breakPoint));
    remaining = " " + remaining.slice(breakPoint);
  }

  result.push(remaining);
  return result.join("\r\n");
}

function isHighByte(code) {
  return code >= 0x80 && code <= 0xbf;
}

/**
 * Format a date as YYYYMMDD.
 */
function formatDateCompact(dateStr) {
  return dateStr.replace(/-/g, "");
}

/**
 * Format a time string (e.g., "2:30pm") as HHMMSS.
 */
function formatTimeCompact(timeStr) {
  if (!timeStr) return "120000"; // Default noon

  const normalized = timeStr.toLowerCase().trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);

  if (!match) return "120000";

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3];

  if (ampm === "pm" && hours < 12) hours += 12;
  if (ampm === "am" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}${minutes}00`;
}

/**
 * Add hours to a time string.
 */
function addHoursToTime(timeStr, hours) {
  const normalized = timeStr.toLowerCase().trim();
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);

  if (!match) {
    // Default: noon + hours
    const endHour = 12 + hours;
    return `${String(endHour).padStart(2, "0")}0000`;
  }

  let hour = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3];

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  hour += hours;
  if (hour >= 24) hour = hour % 24;

  return `${String(hour).padStart(2, "0")}${minutes}00`;
}

/**
 * Get current timestamp in ICS format (UTC).
 */
function getNowUtc() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  const min = String(now.getUTCMinutes()).padStart(2, "0");
  const s = String(now.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * Build VTIMEZONE component for America/Los_Angeles.
 */
function buildTimezone() {
  return `BEGIN:VTIMEZONE
TZID:America/Los_Angeles
X-LIC-LOCATION:America/Los_Angeles
BEGIN:DAYLIGHT
TZOFFSETFROM:-0800
TZOFFSETTO:-0700
TZNAME:PDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0700
TZOFFSETTO:-0800
TZNAME:PST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE`;
}

/**
 * Build a single VEVENT.
 */
function buildEvent({
  uid,
  dateStr,
  startTime,
  endTime,
  hoursPerDay,
  summary,
  location,
  description,
}) {
  const dateCompact = formatDateCompact(dateStr);
  const startTimeCompact = formatTimeCompact(startTime);

  let endTimeCompact;
  if (endTime) {
    endTimeCompact = formatTimeCompact(endTime);
  } else {
    endTimeCompact = addHoursToTime(startTime, hoursPerDay || 1);
  }

  const nowUtc = getNowUtc();

  const lines = [
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    foldLine(`DTSTART;TZID=America/Los_Angeles:${dateCompact}T${startTimeCompact}`),
    foldLine(`DTEND;TZID=America/Los_Angeles:${dateCompact}T${endTimeCompact}`),
    foldLine(`SUMMARY:${escapeIcsText(summary)}`),
  ];

  if (location) {
    lines.push(foldLine(`LOCATION:${escapeIcsText(location)}`));
  }

  if (description) {
    lines.push(foldLine(`DESCRIPTION:${escapeIcsText(description)}`));
  }

  lines.push(
    `DTSTAMP:${nowUtc}`,
    `LAST-MODIFIED:${nowUtc}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT"
  );

  return lines.join("\r\n");
}

/**
 * Build a complete ICS calendar.
 *
 * @param {Array} events - Array of event objects
 * @returns {string} Complete ICS file content
 */
export function buildCalendar(events) {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shape Your Destiny//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Shape Your Destiny classes",
    "X-WR-TIMEZONE:America/Los_Angeles",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ].join("\r\n");

  const timezone = buildTimezone();

  const eventStrings = events.map((event) => buildEvent(event));

  const footer = "END:VCALENDAR";

  return [header, timezone, ...eventStrings, footer].join("\r\n") + "\r\n";
}

/**
 * Build description text for an event.
 */
export function buildEventDescription({
  isSubbing,
  coveringForName,
  coTeacherName,
  instructions,
  officeContact,
  officePhone,
  siteUrl,
}) {
  const lines = [];

  // Who they're teaching with
  if (isSubbing && coveringForName) {
    lines.push(`Covering for ${coveringForName.split(" ")[0]}`);
  } else if (coTeacherName) {
    lines.push(`Teaching with ${coTeacherName}`);
  } else {
    lines.push("Teaching alone");
  }

  // Instructions
  if (instructions) {
    const steps = instructions
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (steps.length > 0) {
      lines.push("");
      steps.forEach((step, i) => {
        lines.push(`${i + 1}. ${step}`);
      });
    }
  }

  // Front office
  if (officeContact || officePhone) {
    lines.push("");
    const parts = ["Front office:"];
    if (officeContact) parts.push(officeContact);
    if (officePhone) parts.push(officePhone);
    lines.push(parts.join(" "));
  }

  // App link
  lines.push("");
  lines.push(`Open in the app: ${siteUrl}/instructor/dashboard`);

  return lines.join("\n");
}

// Export helpers for testing
export { escapeIcsText, foldLine, formatTimeCompact, addHoursToTime };
