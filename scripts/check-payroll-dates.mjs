/**
 * Payroll Date Calculation Tests
 * ==============================
 * Run with: node scripts/check-payroll-dates.mjs
 *
 * Tests the payroll schedule calculations against known correct values.
 */

// Import the schedule functions
import {
  getPeriodForDate,
  getPeriodStart,
  getDueDate,
  getPayday,
  formatPeriodRange,
} from "../lib/payroll/schedule.js";

const settings = {
  anchorDate: "2026-09-05",
  periodDays: 14,
  dueOffsetDays: 7,
  paydayOffsetDays: 14,
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    console.log(`    Expected: ${expected}`);
    console.log(`    Actual:   ${actual}`);
    failed++;
  }
}

console.log("\n=== Payroll Date Calculation Tests ===\n");

// Test 1: First period (Sep 5-18, 2026)
console.log("Period 1: Sep 5-18, 2026");
{
  const period = getPeriodForDate("2026-09-05", settings);
  assertEqual(period.startDate, "2026-09-05", "Start date is Sep 5");
  assertEqual(period.endDate, "2026-09-18", "End date is Sep 18");
  assertEqual(period.dueDate, "2026-09-25", "Due date is Sep 25 (7 days after end)");
  assertEqual(period.payday, "2026-10-02", "Payday is Oct 2 (14 days after end)");

  // Check formatting
  const rangeStr = formatPeriodRange(period.startDate, period.endDate);
  assertEqual(rangeStr, "Sep 5 – 18, 2026", "Period range formatted correctly");
}

// Test 2: Second period (Sep 19 - Oct 2, 2026)
console.log("\nPeriod 2: Sep 19 - Oct 2, 2026");
{
  const period = getPeriodForDate("2026-09-19", settings);
  assertEqual(period.startDate, "2026-09-19", "Start date is Sep 19");
  assertEqual(period.endDate, "2026-10-02", "End date is Oct 2");
  assertEqual(period.dueDate, "2026-10-09", "Due date is Oct 9 (7 days after end)");
  assertEqual(period.payday, "2026-10-16", "Payday is Oct 16 (14 days after end)");

  const rangeStr = formatPeriodRange(period.startDate, period.endDate);
  assertEqual(rangeStr, "Sep 19 – Oct 2, 2026", "Period range formatted correctly");
}

// Test 3: Date in middle of a period (Oct 22)
console.log("\nOct 22, 2026 falls in period Oct 17-30");
{
  const period = getPeriodForDate("2026-10-22", settings);
  assertEqual(period.startDate, "2026-10-17", "Start date is Oct 17");
  assertEqual(period.endDate, "2026-10-30", "End date is Oct 30");
}

// Test 4: Date before anchor should return null
console.log("\nDate before anchor (Sep 1, 2026)");
{
  const periodStart = getPeriodStart("2026-09-01", settings);
  assertEqual(periodStart, null, "Returns null for date before anchor");
}

// Test 5: Due date calculation helper
console.log("\nDue date calculation");
{
  const due = getDueDate("2026-09-18", 7);
  assertEqual(due, "2026-09-25", "Due date 7 days after Sep 18 is Sep 25");
}

// Test 6: Payday calculation helper
console.log("\nPayday calculation");
{
  const pay = getPayday("2026-09-18", 14);
  assertEqual(pay, "2026-10-02", "Payday 14 days after Sep 18 is Oct 2");
}

// Test 7: Multiple consecutive periods
console.log("\nConsecutive periods");
{
  // Period starting Sep 5
  const p1 = getPeriodForDate("2026-09-05", settings);
  // Next day after p1 ends should start p2
  const p2 = getPeriodForDate("2026-09-19", settings);
  // Next day after p2 ends should start p3
  const p3 = getPeriodForDate("2026-10-03", settings);

  assertEqual(p1.endDate, "2026-09-18", "P1 ends Sep 18");
  assertEqual(p2.startDate, "2026-09-19", "P2 starts Sep 19 (day after P1 ends)");
  assertEqual(p2.endDate, "2026-10-02", "P2 ends Oct 2");
  assertEqual(p3.startDate, "2026-10-03", "P3 starts Oct 3 (day after P2 ends)");
}

// Summary
console.log("\n" + "=".repeat(40));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(40) + "\n");

if (failed > 0) {
  process.exit(1);
}
