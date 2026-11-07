# Audit: payroll wiring + dead code sweep

Read `AGENTS.md` first.

**Run this only after the Payroll build is committed.** If `git status` shows uncommitted work in `app/admin/payroll`, `app/api/admin/payroll`, `app/api/cron`, `lib/payroll`, `Sidebar.jsx`, `layout.jsx` or `lib/email/index.js`, stop and tell me.

## Goal

Two things:
1. **Payroll wiring:** every place in the code that mentions pay, payroll, rates, pay periods, class counts or paydays should connect to the real Payroll system and agree with it. Find anything that's disconnected, duplicated, contradictory or unused.
2. **Dead code:** find and remove code that isn't used anywhere: files, components, CSS, exports, routes, email functions, tables and columns. Leave alone anything that's deliberately waiting for a future feature, but list it.

**Workflow:**
- **Audit first.** Write the report, then make only the safe deletions and fixes listed under "What you may change without asking".
- **Ask before anything else:** list it and wait for me.

## Part 1: payroll wiring

### Inventory

Start from this list, then grep for anything I missed: `payroll|pay_rate|rate_per_class|hours_per_day|payday|pay period|paid|payroll_|classes_override|nothing_to_pay|CRON_SECRET`.

- **Payroll itself:**
  - `lib/payroll/schedule.js`, `compute.js`, `actions.js`, `checks.js`, `check-actions.js`
  - `app/admin/payroll/*`
  - `app/api/admin/payroll/export/route.js`
  - `app/api/cron/payroll-reminders/route.js`
  - `scripts/check-payroll-dates.mjs`
- **Database files:** `add-payroll.sql`, `update-payroll.sql`, `add-payroll-checks.sql`, `add-classes-hours-per-day.sql`, `add-classes-end-time.sql`
- **Things that feed payroll:**
  - `lib/instructor-notes/actions.js` and `queries.js` (pay notes, `instructor_pay_rates`)
  - `lib/schedule/queries.js`
  - `app/admin/programs/ClassPanel.jsx` and `ProgramsClient.jsx` (`hours_per_day`, `end_time`)
  - `app/admin/schedule/MarkOutModal.jsx` (`notified_on`, subs)
- **Things that show payroll to people:**
  - `app/instructor/past/*`
  - both Inbox clients and `lib/admin/inbox*.js`, `lib/instructor/inbox.js`
  - `lib/email/index.js`
  - `Sidebar.jsx`, `app/admin/layout.jsx`
  - `lib/staff/queries.js`. Why does the staff page mention pay at all? Check that nothing pay-related can leak to the public staff page.
  - `audit/db-checks.sql`

### Check each one against these rules

1. **One way to count classes.** Payroll, Past classes, the class check, the instructor's Attendance tab, the Overview "Sessions taught" number and the CSV should all get their sessions from `getPeriodSessions` / `getSessionStaff`. List every place that counts sessions, classes or hours its own way, and say whether its numbers could disagree with payroll's.
2. **One way to get a rate.**
   - **Reading a rate:** the rate for a session is the latest pay note `effective_date` on or before the session date, with `instructor_pay_rates.rate_per_class` as the fallback. List every place that reads a rate and confirm it uses this rule. A Pay card that shows a different number than payroll counts as a bug.
   - **Writing a rate:** only the pay note action should write rates. Flag anywhere else that writes `instructor_pay_rates` directly.
3. **`hours_per_day`:** confirm payroll multiplies by it. Confirm `end_time` sets it consistently when a class is created or edited. Confirm Past classes and the CSV show "2 classes" for a 2-hour session. Flag any screen that shows 1 for it.
4. **Pay periods:** everything uses `lib/payroll/schedule.js`. Flag any hard-coded dates, period lengths or anchors (anything mentioning Sep 5, 14 days, +7 or +14 days) outside it and `payroll_settings`. Run `node scripts/check-payroll-dates.mjs`.
5. **Statuses agree:**
   - Period statuses (`open`, `approved`, `paid`, `nothing_to_pay`) and check statuses (`confirmed`, `flagged`, `no_reply`, `no_classes`) are spelled the same in SQL CHECK constraints, JS constants and UI labels.
   - List any status the code uses that the database doesn't allow, and the reverse.
6. **Database matches code:** for every payroll-related table and column, confirm the code reads or writes it and the migrations create it.
   - List columns created but never used, and columns used but never created.
   - Note anything `update-payroll.sql` changes that `add-payroll.sql` already did, or that conflicts with it.
   - Write the order the payroll SQL files have to be run in.
7. **Privacy:**
   - **Admin-only:** every payroll table, the CSV route and the payroll server actions are admin-only, checked on the server with `verifyAdmin`.
   - **Instructors** can only see what Past classes is meant to show: their own sessions, and "Approved · paid Fri, {date}". No rates, no amounts, nobody else.
   - **The cron route** rejects requests without `CRON_SECRET`.
8. **Emails and reminders:**
   - There's exactly one reminder system for admins (payroll) and one for instructors (class check), both triggered from the same cron route, with no duplicates.
   - `nothing_to_pay` periods and people with no classes never get emails.
   - List every email function that mentions pay, and where it's called from.
9. **Sidebar and Inbox counts:** the Payroll badge, the admin Inbox "payroll ready" item and the class-check status card all count the same periods the same way.

For each finding, give the file and line, what's wrong, what a person would see, and the fix.

## Part 2: dead code sweep (the whole app, not just payroll)

Find things nothing uses anymore. **Check the leftovers from earlier redesigns first:**
- `app/admin/schedule/ManageModal.jsx` and its CSS (replaced by Programs)
- `app/admin/instructors/InstructorDrawer.jsx` and its CSS (replaced by the profile page)
- the old ✕ unassign handlers on the Schedule Board
- the old "Reviews & Audits" placeholder
- the old stat cards, tabs and collapse CSS on Programs
- the coverage remnants (`coverage_requests`, any coverage email or UI)
- certification remnants
- the duplicate or old Inbox empty-state components
- old `instructor-queries` functions that `session-staff` replaced. Earlier, `getInstructorSessions` counted sessions its own way, so check whether anything still calls it.

**Then sweep everything:**
- **Files and components:** any file that nothing imports, or that isn't a Next.js route.
- **Exports:** exported functions or constants nothing imports, in `lib/**` and `app/**`.
- **CSS:** CSS Module classes no component references.
- **Routes:** API routes nothing calls. Check for `fetch('/api/...` and form actions, and keep anything external, like the cron and calendar routes.
- **Email functions** nothing calls.
- **Commented-out code** blocks over 5 lines, plus `console.log` left in. Keep `console.error` that's in actual error handling.
- **Database:** tables and columns no code uses. **Never drop these.** List them, and write a separate `supabase/migrations/cleanup-unused.sql` with `DROP` statements commented out, so I can review it and decide.

**Never delete:**
- anything in `app/design-mockups/`
- any `.sql` migration file
- `audit/`
- `scripts/`
- `.claude/`
- anything a cron or external calendar depends on
- anything for an announced future feature: pay amounts in Past classes, calendar sync, and the holiday impact preview

Put those under "Kept on purpose" with one line each.

## What you may change without asking

- **Delete** files, components and CSS classes that nothing references, and exports nothing imports. That includes the drawer and Manage modal **if** nothing imports them.
- **Remove** commented-out code and stray `console.log`.
- **Fix** where a status string doesn't match between SQL and code. Fix the code side only.
- **Point** any place that counts sessions or reads rates its own way at the shared helpers, **but only if** the numbers shown can't change for periods that are already approved.

## Ask me before

- changing any SQL, or dropping or renaming any table or column
- changing how pay is calculated, or anything an approved period depends on
- deleting any route, email function or feature that's reachable from the UI
- anything you're less than sure is unused

## Then

1. Run `npm run build`, `npm run lint` and `node scripts/check-payroll-dates.mjs`. Show me the real output.
2. Write `audit/PAYROLL-AND-DEAD-CODE.md`:
   - **Summary:** three lines max. Does every payroll mention connect to real payroll? Did anything risk paying people wrong?
   - **Fixed:** what you changed, by file.
   - **Deleted:** files, exports and CSS you removed, with how you confirmed each was unused.
   - **Needs my OK:** anything from "Ask me before".
   - **Kept on purpose.**
   - **Database:** unused tables and columns, and the payroll SQL run order.
   - **Click-through for me:**
     - one instructor across one period: their Past classes count, class check list, Payroll row, CSV rows and Overview "Sessions taught" all match
     - a sub day: paid to the sub, not to the absent person
     - a 2-hour class: counted as 2 classes everywhere
     - a raise mid-period
     - a winter break period
3. Don't commit or push. I'll review first.
