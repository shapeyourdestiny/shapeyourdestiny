/**
 * ICS validation script
 * Run with: node scripts/check-ics.mjs
 */

import {
  buildCalendar,
  buildEventDescription,
  escapeIcsText,
  foldLine,
  formatTimeCompact,
  addHoursToTime,
} from "../lib/calendar/ics.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message = "") {
  if (actual !== expected) {
    throw new Error(
      `Expected "${expected}" but got "${actual}"${message ? ` (${message})` : ""}`
    );
  }
}

function assertIncludes(str, substr, message = "") {
  if (!str.includes(substr)) {
    throw new Error(
      `Expected string to include "${substr}"${message ? ` (${message})` : ""}`
    );
  }
}

console.log("\n=== ICS Builder Tests ===\n");

console.log("escapeIcsText:");
test("escapes backslashes", () => {
  assertEqual(escapeIcsText("foo\\bar"), "foo\\\\bar");
});

test("escapes semicolons", () => {
  assertEqual(escapeIcsText("foo;bar"), "foo\\;bar");
});

test("escapes commas", () => {
  assertEqual(escapeIcsText("foo,bar"), "foo\\,bar");
});

test("escapes newlines", () => {
  assertEqual(escapeIcsText("foo\nbar"), "foo\\nbar");
});

test("handles combined escapes", () => {
  assertEqual(
    escapeIcsText("a\\b;c,d\ne"),
    "a\\\\b\\;c\\,d\\ne"
  );
});

console.log("\nfoldLine:");
test("leaves short lines unchanged", () => {
  const short = "SUMMARY:Test event";
  assertEqual(foldLine(short), short);
});

test("folds long lines at 75 characters", () => {
  const long = "DESCRIPTION:" + "x".repeat(100);
  const folded = foldLine(long);
  const lines = folded.split("\r\n");
  assertEqual(lines.length, 2, "should have 2 lines");
  assertEqual(lines[0].length, 75, "first line should be 75 chars");
  assertEqual(lines[1][0], " ", "continuation should start with space");
});

console.log("\nformatTimeCompact:");
test("formats 12-hour pm time", () => {
  assertEqual(formatTimeCompact("2:30pm"), "143000");
});

test("formats 12-hour am time", () => {
  assertEqual(formatTimeCompact("10:00am"), "100000");
});

test("formats noon", () => {
  assertEqual(formatTimeCompact("12:00pm"), "120000");
});

test("formats midnight", () => {
  assertEqual(formatTimeCompact("12:00am"), "000000");
});

console.log("\naddHoursToTime:");
test("adds hours to afternoon time", () => {
  assertEqual(addHoursToTime("2:30pm", 1), "153000");
});

test("adds hours to morning time", () => {
  assertEqual(addHoursToTime("10:00am", 2), "120000");
});

console.log("\nbuildEventDescription:");
test("includes co-teacher info", () => {
  const desc = buildEventDescription({
    isSubbing: false,
    coTeacherName: "Jane Smith",
    siteUrl: "https://example.com",
  });
  assertIncludes(desc, "Teaching with Jane Smith");
});

test("includes covering info for subs", () => {
  const desc = buildEventDescription({
    isSubbing: true,
    coveringForName: "John Doe",
    siteUrl: "https://example.com",
  });
  assertIncludes(desc, "Covering for John");
});

test("includes instructions as numbered steps", () => {
  const desc = buildEventDescription({
    isSubbing: false,
    instructions: "Park in back\nCheck in at office",
    siteUrl: "https://example.com",
  });
  assertIncludes(desc, "1. Park in back");
  assertIncludes(desc, "2. Check in at office");
});

test("includes front office info", () => {
  const desc = buildEventDescription({
    isSubbing: false,
    officeContact: "Mrs. Jones",
    officePhone: "(555) 123-4567",
    siteUrl: "https://example.com",
  });
  assertIncludes(desc, "Front office: Mrs. Jones (555) 123-4567");
});

test("includes app link", () => {
  const desc = buildEventDescription({
    isSubbing: false,
    siteUrl: "https://shapeyourdestiny.co",
  });
  assertIncludes(desc, "Open in the app: https://shapeyourdestiny.co/instructor/dashboard");
});

console.log("\nbuildCalendar:");
test("builds valid calendar structure", () => {
  const ics = buildCalendar([]);
  assertIncludes(ics, "BEGIN:VCALENDAR");
  assertIncludes(ics, "END:VCALENDAR");
  assertIncludes(ics, "VERSION:2.0");
  assertIncludes(ics, "PRODID:");
});

test("includes calendar settings", () => {
  const ics = buildCalendar([]);
  assertIncludes(ics, "X-WR-CALNAME:Shape Your Destiny classes");
  assertIncludes(ics, "X-WR-TIMEZONE:America/Los_Angeles");
  assertIncludes(ics, "REFRESH-INTERVAL;VALUE=DURATION:PT1H");
  assertIncludes(ics, "X-PUBLISHED-TTL:PT1H");
});

test("includes LA timezone definition", () => {
  const ics = buildCalendar([]);
  assertIncludes(ics, "BEGIN:VTIMEZONE");
  assertIncludes(ics, "TZID:America/Los_Angeles");
  assertIncludes(ics, "BEGIN:DAYLIGHT");
  assertIncludes(ics, "BEGIN:STANDARD");
  assertIncludes(ics, "END:VTIMEZONE");
});

test("builds event with correct UID format", () => {
  const ics = buildCalendar([
    {
      uid: "abc123-20261115@shapeyourdestiny.co",
      dateStr: "2026-11-15",
      startTime: "2:30pm",
      endTime: "3:30pm",
      hoursPerDay: 1,
      summary: "Wellness · Test School",
      location: "123 Main St",
      description: "Teaching alone",
    },
  ]);
  assertIncludes(ics, "UID:abc123-20261115@shapeyourdestiny.co");
});

test("builds event with local time and timezone", () => {
  const ics = buildCalendar([
    {
      uid: "test-20261115@shapeyourdestiny.co",
      dateStr: "2026-11-15",
      startTime: "2:30pm",
      endTime: "3:30pm",
      hoursPerDay: 1,
      summary: "Test",
      location: "Test",
      description: "Test",
    },
  ]);
  assertIncludes(ics, "DTSTART;TZID=America/Los_Angeles:20261115T143000");
  assertIncludes(ics, "DTEND;TZID=America/Los_Angeles:20261115T153000");
});

test("includes all required event fields", () => {
  const ics = buildCalendar([
    {
      uid: "test-20261115@shapeyourdestiny.co",
      dateStr: "2026-11-15",
      startTime: "2:30pm",
      endTime: "3:30pm",
      summary: "Test Summary",
      location: "Test Location",
      description: "Test Description",
    },
  ]);
  assertIncludes(ics, "BEGIN:VEVENT");
  assertIncludes(ics, "END:VEVENT");
  assertIncludes(ics, "SUMMARY:Test Summary");
  assertIncludes(ics, "LOCATION:Test Location");
  assertIncludes(ics, "DESCRIPTION:Test Description");
  assertIncludes(ics, "STATUS:CONFIRMED");
  assertIncludes(ics, "TRANSP:OPAQUE");
  assertIncludes(ics, "DTSTAMP:");
  assertIncludes(ics, "LAST-MODIFIED:");
});

test("uses CRLF line endings", () => {
  const ics = buildCalendar([]);
  assertEqual(ics.includes("\r\n"), true, "should use CRLF");
});

test("ends with CRLF", () => {
  const ics = buildCalendar([]);
  assertEqual(ics.endsWith("\r\n"), true, "should end with CRLF");
});

console.log("\n========================================");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("========================================\n");

process.exit(failed > 0 ? 1 : 0);
