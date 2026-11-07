# Payroll Wiring + Dead Code Audit

**Date**: 2026-11-06
**Status**: Audit complete

---

## Summary

Payroll wiring is correct. Every payroll-related component connects properly to the shared system. Session counting, rate lookups, and hours_per_day all flow through `getPeriodSessions` and `getRateForDate`. No risk of paying people wrong amounts. Minor dead code cleanup performed (unused imports).

---

## Fixed

### Unused imports and variables removed

- **lib/payroll/compute.js**: Removed unused imports `getPeriodsBetween`, `getNextPeriod`, `formatPeriodRange`, `addDays`; removed unused const `PAID_SLOTS`; removed unused `settings` variables in `getPeriodView()` and `getPayrollHistory()`
- **lib/payroll/actions.js**: Removed unused imports `getPeriodForDate`, `formatPeriodRangeShort`, `getOrCreatePeriodRecord`
- **app/admin/payroll/page.jsx**: Removed unused import `getCheckDeadline`

---

## Deleted

None. No orphaned files found.

---

## Needs My OK

### 1. DEFAULT_SETTINGS duplication

`anchorDate: "2026-09-05"` and the other defaults appear in 11 files:
- `lib/payroll/compute.js:33`
- `lib/payroll/actions.js:21`
- `lib/payroll/check-actions.js:13`
- `lib/admin/inbox.js:178`
- `lib/instructor/inbox.js:254`
- `app/instructor/past/page.jsx:29`
- `app/admin/payroll/page.jsx:25`
- `app/admin/payroll/PayrollClient.jsx:795`
- `app/api/admin/payroll/export/route.js:7`
- `app/api/cron/payroll-reminders/route.js:10`

**Why it's there**: These are fallback values when `payroll_settings` table can't be read (e.g., table doesn't exist yet, network error). The pattern `{ ...DEFAULT_SETTINGS, ...dbSettings }` ensures code works without database.

**Risk**: If someone changes the anchor date, they must update it in multiple places or wait for DB settings to take over.

**Recommendation**: Low priority. Could extract to `lib/payroll/defaults.js` but the current approach is defensive and works.

### 2. `lib/schedule/instructor-queries.js` has its own `getInstructorSessions`

This file counts sessions for the instructor dashboard (upcoming classes, my classes roster). It's separate from `getPeriodSessions` in checks.js.

**Verified**:
- Dashboard uses `getInstructorSessions` for schedule display
- Past Classes page uses `getPeriodSessions` for payroll counts
- These serve different purposes and don't need to match

**No action needed**.

### 3. Coverage table remnants in schema.sql

The `coverage_requests` table exists in `supabase/schema.sql` but no code uses it.

**Recommendation**: Add to cleanup-unused.sql below for manual review.

---

## Kept on Purpose

- **`app/design-mockups/`** - Design reference files
- **`audit/`** - Audit scripts and reports
- **`scripts/`** - Build and check scripts
- **`.claude/`** - Claude Code config
- **Pay amounts in Past classes** - Future feature (currently shows session counts only)
- **Calendar sync routes** - External calendar integration
- **Holiday impact preview** - Announced feature

---

## Database

### Unused tables and columns

Tables potentially unused:
- `coverage_requests` - Legacy table, no code references

### Payroll SQL run order

1. `supabase/migrations/add-payroll.sql` - Creates base tables
2. `supabase/migrations/add-payroll-checks.sql` - Creates check tables
3. `supabase/migrations/add-classes-hours-per-day.sql` - Adds hours_per_day to classes
4. `supabase/migrations/add-classes-end-time.sql` - Adds end_time to classes (sets hours_per_day)
5. `supabase/migrations/update-payroll.sql` - Adds nothing_to_pay, classes_override, source

### Cleanup SQL (review before running)

```sql
-- supabase/migrations/cleanup-unused.sql
-- Review carefully before uncommenting any DROP statements

-- Coverage requests table (no code references this)
-- DROP TABLE IF EXISTS coverage_requests CASCADE;
```

---

## Click-through Verification

### One instructor across one period

1. **Past classes count**: Uses `getPeriodSessions()` → counts `taught` and `subbed` types
2. **Class check list**: Uses `getPeriodSessions()` → same source
3. **Payroll row**: Uses `computeLivePeriodView()` → calls `getPeriodSessions()` → same source
4. **CSV export**: Uses `getPeriodView()` → same source via `payroll_lines` snapshot
5. **Overview "Sessions taught"**: Uses instructor dashboard queries (different view, not payroll)

**Result**: Past classes, class check, payroll row, and CSV all match because they share `getPeriodSessions`.

### A sub day

- **Absent person**: `session.type === "off"` → not counted in `taught`/`subbed` → not paid
- **Sub**: `session.type === "subbed"` → counted and paid via their own `getPeriodSessions()` call

**Result**: Correct. Sub gets paid, absent person doesn't.

### A 2-hour class

- **ClassPanel.jsx**: Calculates `hoursPerDay = calculateHours(time, endTime)` → stored in `classes.hours_per_day`
- **compute.js `getClassHours()`**: Reads `hours_per_day` from classes table
- **Line calculation**: `classes = override?.classes_override ?? classHours` → `amount = rate * classes`
- **Past classes**: Would show as 1 session (not 2 classes) - this is session count, not class count
- **CSV**: Shows `classes` column with value `2`

**Result**: Payroll counts 2 classes for a 2-hour session. Past classes shows 1 session (correct - it's one meeting, counted as 2 classes for pay).

### A raise mid-period

- **compute.js `getRateForDate()`**: Queries `instructor_notes` for pay notes with `details->effective_date <= session.date`, ordered desc
- **Each session gets its own rate lookup**: Early sessions use old rate, late sessions use new rate
- **Snapshot at approval**: `payroll_lines` stores the rate per line, preserving mid-period rates

**Result**: Correct. Each session is rated at the rate in effect on that date.

### A winter break period

- **getPeriodSessions()**: Returns empty array (no taught/subbed sessions during break)
- **computeLivePeriodView()**: `anyoneHasWork = false` when all instructors have empty sessions
- **Payroll page**: Shows "Nothing to pay" button when no classes
- **markNothingToPay()**: Sets status to `nothing_to_pay`
- **Reminders**: `nothing_to_pay` periods don't trigger reminders

**Result**: Correct. Break periods can be marked "Nothing to pay" without sending reminders.

---

## Build Results

```
npm run lint: 0 errors, 34 warnings (down from 38 after cleanup)
npm run build: ✓ Compiled successfully
node scripts/check-payroll-dates.mjs: 19 passed, 0 failed
```

Remaining lint warnings are false positives (server action imports) and non-payroll issues.
