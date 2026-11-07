# Build the admin Payroll page (v2, updated Nov 6)

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing routes, server actions or route handlers.

**Only start this after the Past classes + payroll class check work is committed.** Payroll builds on `lib/payroll/checks.js`. If `git status` shows that work still uncommitted, stop and tell me.

## Goal

Add a Payroll page at `/admin/payroll`. Every two weeks an admin:
1. reviews the pay period
2. sees which instructors confirmed or flagged their classes
3. fixes anything odd
4. approves it
5. exports a CSV
6. marks it paid

Approved periods are locked and kept as history. Admins get email reminders when a period needs approval.

**The design** is `app/design-mockups/payroll-v1.html`. Open it in a browser and match its layout, structure and copy. It has four views:
- the current period
- an instructor's pay drawer
- payroll history, with a past-period drawer
- the Pay schedule & reminders modal

**Changes from the mockup:**
- **Colors:** use the navy/teal tokens in `app/globals.css`, with no orange or gold. Match the redesigned Programs, Schedule Board v2 and Instructors pages: white cards with soft shadows and no borders, one solid navy primary button per screen, ghost buttons for everything else.
  - **Status colors:** green for Paid, teal for Approved, amber for things that need review, red only for overdue or a missing rate.
- **No Coverage column.** Subs are handled automatically (see "Where the numbers come from").
- **Add a "Class check" column** (section 4).

Build with CSS Modules. Use `app/admin/components/Modal.jsx` for popups.

## What already exists (reuse it, don't rebuild it)

- **`supabase/migrations/add-payroll.sql`:** tables for rates, settings, periods, overrides, adjustments, lines and activity. **Ask me whether I've already run it.** If I have, put changes in `supabase/migrations/update-payroll.sql` instead of editing it.
- **`lib/payroll/schedule.js` and `scripts/check-payroll-dates.mjs`:** pay period math. Check them against the schedule below, and fix anything that doesn't match.
- **`lib/payroll/checks.js` and `check-actions.js`:**
  - `getPeriodSessions(profileId, period)` returns `taught`, `subbed`, `off`, `holiday` and `upcoming` rows.
  - `getCheckStatus(period)` returns `confirmed`, `flagged`, `no_reply` or `no_classes`.
  - `getOpenPayrollIssues()`.
- **`lib/schedule/session-staff.js` (`getSessionStaff`) and `session_changes`:** who actually taught each session, including subs, absences and one-day fills.
- **`lib/schedule/occurrences.js` and `sessions.js`:** scoped holidays, AM/PM partial holidays, program days off, `classes.end_date`, ongoing classes.
- **`classes.hours_per_day`:** a session counts as that many paid classes. A 2-hour session is 2 classes. `end_time` can set it automatically.
- **`instructor_pay_rates`:** pay notes in `lib/instructor-notes/actions.js` already write `rate_per_class` when an admin adds a pay change.
- **`instructor_notes` of type `pay`:** these carry `details.effective_date` and `rate_from` / `rate_to`.
- **The existing `verifyAdmin` pattern, admin Inbox (`lib/inbox/admin.js`) and email helpers.**

## Pay schedule (real dates)

- Periods are 14 days, Saturday to Friday, anchored on **Sat Sep 5, 2026**.
- Approval is due **7 days** after the period ends, and payday is **14 days** after.
- Examples:
  - Sep 5 – 18 is due Fri Sep 25 and paid Fri Oct 2.
  - Oct 31 – Nov 13 is due Fri Nov 20 and paid Fri Nov 27.
  - Dec 26 – Jan 8 is due Fri Jan 15 and paid Fri Jan 22.
- Do all date math as `YYYY-MM-DD` calendar dates in `America/Los_Angeles`, the same as `lib/schedule`. Never let UTC shift a day.
- Never show periods before the anchor. Saturday classes fall inside the Sat–Fri period like any other day.

**Which period the page opens on:**
- The oldest period that has ended and isn't approved, ignoring "Nothing to pay" periods (see Breaks).
- If none are waiting, the period in progress.
- If two or more are waiting, the header says "2 periods need approval", and the page opens the oldest.
- Nothing is approved automatically except "Nothing to pay" periods.

## Where the numbers come from (one source of truth)

**Use `getPeriodSessions` for every instructor.** Don't count sessions any other way, so payroll, Past classes and the class check can never disagree.

- **Paid lines:** each `taught` row and each `subbed` row becomes one pay line for that instructor.
  - Line `classes` = that class's `hours_per_day` (default 1).
  - Line `amount` = `classes × rate`.
- **`off` rows:** the absent person isn't paid. Their sub gets the line instead, because it shows up as `subbed` for the sub. Don't add sick pay.
- **`holiday` rows:** not paid. That includes AM/PM partial holidays that cancel a class at its time. A partial holiday that doesn't cancel the class leaves it `taught`, so it's paid.
- **`upcoming` rows:** in a period that's still running, show them as "Coming up" with a muted amount, and don't include them in the total.
- **Paid slots:** only `instructor_1` and `instructor_2`, including one-day fills. `admin_review` isn't paid. Put this in one `PAID_SLOTS` constant.

**Rate for a session:** use the rate in effect on the session date.
- Take the latest pay note whose `effective_date` is on or before that date.
- If there isn't one, use `instructor_pay_rates.rate_per_class`.
- If there's no rate at all, the line shows "No rate" in red, and the period can't be approved (see Approve).

A rate change in the middle of a period should come out right automatically.

**Admins can also:**
- **Switch a line to Don't pay,** with an optional reason (`payroll_line_overrides`).
- **Change the class count on one line** (for example, a 1-hour class that ran 2 hours). Add `classes_override NUMERIC` to overrides if it isn't there.
- **Add adjustments,** positive or negative, with a label and note (reimbursement, bonus, correction).
- **Change a rate** from the drawer. This creates a pay note through the existing notes action, with `effective_date` = that period's start, so history stays in one place. Never write `instructor_pay_rates` directly from payroll.

**"Needs review"** is shown on an instructor row when any of these apply:
- a line has no rate
- a line is set to Don't pay
- a class count was overridden
- there's an adjustment
- their class check is `flagged` with open issues

## 4. Class check column

In the period table, add a **Class check** column, filled from `getCheckStatus(period)`:
- **Confirmed:** green check, "Confirmed {date}".
- **Flagged:** amber, "{n} issue(s)". Clicking it opens the drawer on the Issues section.
- **No reply:** gray, "No reply". Tooltip: "Went with what's listed".
- **No classes:** these people aren't listed in the table at all. Show them in a collapsed line at the bottom: "{n} instructors had no classes this period".

**While the check is open** (period end through the check deadline), show a teal banner above the table: "Class check open until {deadline}. {n} confirmed · {n} flagged · {n} waiting."

**Issues section in the drawer:** each open issue with its kind, date, school and note, plus the same buttons as the admin Inbox (Add the class, Open Schedule Board, Mark fixed). Reuse them, don't copy them.

**After an issue is fixed**, the period recalculates automatically, since it reads `getPeriodSessions` live.

## Breaks (no classes for weeks or months)

- **Nobody had classes in the period** (winter break, between programs):
  - Mark it `nothing_to_pay` automatically once it ends: total $0, no approval needed.
  - Send no reminder emails.
  - It shows in History as "Nothing to pay", muted, and never as "needs approval".
- **Some people had no classes:** they're left out of the table, as above. They never block approval.
- **Period header during a long break:** "No classes this period" with the next scheduled class date, if any.

## Approve, pay, lock

- **Approve button:** "Approve {range}".
  - **Blocked** when any instructor with paid lines has no rate. The button explains why and links to the first one.
  - **Warning, not a block,** when there are open class-check issues or the check deadline hasn't passed yet: "{n} open issues. Approve anyway?"
- **`approvePeriod`:**
  - Recompute on the server from `getPeriodSessions`.
  - Write `payroll_lines` as a locked snapshot, one row per paid session per instructor, with: instructor name, school, program, date, time, slot, classes, rate, amount, paid flag and reason.
  - Write the adjustments and total.
  - Set status `approved` and log activity.
  - Do it all in one go, so a double click can't approve twice.
- **Approved periods are read only:** history reads **only** from `payroll_lines`, so later schedule edits, deleted classes or rate changes never change past pay. Corrections go on the next period as an adjustment, which is what the mockup's note says.
- **Mark paid:** "Mark paid" sets `paid` and `paid_at`, and logs "Instructors paid".
- **Instructor-facing:** once a period is approved, each instructor's Past classes page for that period can show "Approved · paid Fri, {date}". Don't show amounts yet. I'll decide that later.

## Database changes

If `add-payroll.sql` hasn't been run, edit it. If it has, use `update-payroll.sql`. Changes:
- `payroll_periods.status` allows `'open' | 'approved' | 'paid' | 'nothing_to_pay'`.
- `payroll_line_overrides` gets `classes_override NUMERIC`.
- `payroll_lines` gets `classes NUMERIC NOT NULL DEFAULT 1` and `source TEXT` (`'taught' | 'subbed'`), so the snapshot records whether it was a sub.
- **RLS:**
  - Every payroll table is admin-only, using the `verifyAdmin` logic (`profiles.user_id = auth.uid()` or the legacy `profiles.id = auth.uid()`, plus `role = 'admin'`).
  - No updates or deletes on `payroll_lines`.
  - No changes to adjustments on approved periods.

## Server code

- **`lib/payroll/compute.js`:**
  - **`getPeriodView(period)`:** for open periods it builds the instructor rows from `getPeriodSessions` plus rates, overrides, adjustments and check status. For approved and paid periods it reads the snapshot.
  - **`getHistory()`:** past periods with their totals and status.
- **`lib/payroll/actions.js`:** server actions, each re-checking admin with `verifyAdmin`:
  - `setLinePay`, `setLineClasses`
  - `addAdjustment`, `removeAdjustment`
  - `changeRate` (goes through the pay note action)
  - `approvePeriod`, `markPaid`
  - `saveSettings`
- **`app/api/admin/payroll/export/route.js`:** CSV for a period.
  - **Summary:** one row per instructor: name, classes taught, classes subbed, total classes, rate(s), adjustments, total.
  - **Detail section:** one row per line, with date, school, program, time, source, classes, rate, amount, paid and reason.
  - Log "CSV exported".

**Settings:**
- Saving the Pay schedule modal only affects periods after the last approved one. Never rewrite dates on approved periods.
- If a new anchor or period length would leave a gap or overlap with the last approved period, show an error instead of saving.
- Keep the class check settings (deadline offset, reminder) in the same modal as a "Class check" section, using the existing `updateCheckSettings`.

## Reminder emails (admins)

Add `sendPayrollReminderEmail({ to, period, total, instructorCount, paidClasses, needsReview, openIssues, kind })` to `lib/email/index.js`, built with `buildEmailHTML`, `emailButton` and `emailInfoBox`. The button goes to `/admin/payroll`.
- **Subject:** "Payroll due {weekday, Mon D}: {range} needs your approval".
- **Body:** mention the class check status: "{n} confirmed, {n} issues open".

Reminders, each sent once per period and logged in `payroll_activity`:
- **Check closed:** the day after the class check deadline. "Class check is done, payroll is ready to review."
- **Due soon:** 2 days before the due date.
- **Overdue:** the day after the due date if it's still not approved, then every 2 days until it is.
- **None at all** for `nothing_to_pay` periods.

Send to `payroll_settings.reminder_emails`, which the modal edits.

**Scheduler:**
- Add `app/api/cron/payroll-reminders/route.js`. It checks a `CRON_SECRET` bearer header, works out which reminders are due today in Los Angeles time, auto-marks `nothing_to_pay` periods, and sends the emails.
- Add a `vercel.json` cron that runs it daily at 15:00 UTC (7 or 8am Pacific).
- If `.env.example` exists, add `CRON_SECRET` to it. Tell me to set it in Vercel.
- If the class check reminder emails also need a daily trigger, run them from this same cron route.

## Sidebar and admin Inbox

- Add **Payroll** to `NAV_OPERATIONS` in `Sidebar.jsx`, after Schedule Board, with the icon from the mockup.
  - It gets a badge with the count of periods waiting for approval, not counting `nothing_to_pay` periods.
  - Load that count in `app/admin/layout.jsx` the way `incidentCount` is loaded, inside a try/catch so the layout still works before the migration is run.
- In the admin Inbox, add one item when a period becomes ready to approve: "{range} payroll is ready", with "Review payroll" linking to `/admin/payroll`.

## Copy rules

Use the wording from the mockup, plus the copy above. No em dashes in any UI text or emails. Use an en dash for date ranges ("Sep 5 – 18"). Money looks like `$1,240.00`, and class counts like "6 classes" or "1 class".

## When you're done

1. List the files you changed.
2. Tell me exactly which SQL to run, and in what order.
3. Run `node scripts/check-payroll-dates.mjs`, `npm run build` and `npm run lint`, and show me the results.
4. Walk me through checking it by hand:
   - set a rate for one instructor, plus a raise that starts mid-period
   - mark someone out with a sub: the sub is paid and the absent person isn't
   - add a PM-only holiday on an afternoon class: that session drops out
   - set a 2-hour class: it counts as 2 classes
   - flag an issue from Past classes, then see it in the Class check column and the drawer, and fix it there
   - approve with an open issue (warning), export the CSV, mark paid
   - edit the class on Programs afterwards: the approved period doesn't change
   - jump to a winter break period: it's "Nothing to pay", with no reminders and nothing to approve

Don't commit or push. I'll review first.
