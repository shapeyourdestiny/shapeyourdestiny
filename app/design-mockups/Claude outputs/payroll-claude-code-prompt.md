# Build the admin Payroll page

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing routes, server actions or route handlers.

## Goal

Add a Payroll page at `/admin/payroll`. Pay comes from the classes assigned on the Schedule Board, counted per session. Every two weeks the admin reviews the period, fixes anything odd, approves it, and exports a CSV. Approved periods are locked and kept as history. Admins get an email when a period needs approval.

The design is in `app/design-mockups/payroll-v1.html`. I just put it back, because the audit commit (2adaa8c) deleted the mockups folder. That folder isn't tracked by git now, so don't commit or delete it. Open the mockup in a browser and match its layout, copy and states. It has four views:
1. the current period
2. an instructor's pay details drawer
3. payroll history, with a past-period drawer
4. the Pay schedule & reminders modal

Build the UI with CSS Modules like the rest of `app/admin`, and use the existing `app/admin/components/Modal.jsx` where a modal fits.

**Changes from the mockup:**
- **Colors:** the mockup uses the old orange and gold accents. The app is navy/teal now (commit 176019a). Use the tokens in `app/globals.css` (`--navy`, `--navy-deep`, `--navy-mid`, `--teal`, `--teal-dark`, `--red`, `--tint`, `--ink`, `--ink-soft`), with no orange or gold.
  - **Look:** match the redesigned Programs page (commit 8339f8d). That means white cards with soft shadows instead of borders, a segmented control for views, one solid navy primary button per screen, and ghost buttons for everything else.
  - **Status colors:** green for paid, teal for approved, red only for overdue or a missing rate.
- **Coverage is gone** (commit 666ab44). Drop the "Coverage" column and any "Covered by" notes.

## Where things stand

Already in the repo (committed in 635e8a1, never wired up):
- `supabase/migrations/add-payroll.sql`
- `lib/payroll/schedule.js`
- `scripts/check-payroll-dates.mjs`

Read those first, check them against this spec, and fix anything that doesn't match. Don't start them over. **Ask me whether I've already run `add-payroll.sql` in Supabase** before you change it. If I have, put any changes in a new `supabase/migrations/update-payroll.sql` instead of editing the original.

Then build the rest:
- `lib/payroll/compute.js` and `lib/payroll/actions.js`
- the `/admin/payroll` page and its UI
- the CSV export route
- the reminder email and cron route
- the sidebar item

**Things that changed since this was first written. Payroll has to respect all of them:**
- **The Programs page** (`app/admin/programs`) is where classes are created and edited now. Classes have an end date field that works out `target_sessions`, and ongoing classes can be ended. Pay lines must follow the same session rules, so keep using `lib/schedule/sessions.js`, and don't add new date logic.
- **Holidays can be AM-only or PM-only** (`holidays.time_period`). `computeClassOccurrences` already decides with `holidayAffectsClass` whether a partial-day holiday cancels a class at its time. A class that still happens is a paid session, and a cancelled one isn't. Don't re-check holidays separately in payroll.
- **Admin checks:** use the same `verifyAdmin` pattern as `lib/instructors/actions.js`, which matches `profiles.user_id` or the legacy `profiles.id`.
- **The audit removed** the coverage emails, the debug routes and the design mockups. Don't bring any of them back.

## Pay schedule (real dates)

- Periods are 14 days, Saturday to Friday, anchored on **Sat Sep 5, 2026**. The first period is Sep 5 to Sep 18, 2026.
- Approval is due **7 days** after the period ends. For the first period that's Fri Sep 25.
- Payday is **14 days** after the period ends. For the first period that's **Fri Oct 2, 2026**.
- The next period is Sep 19 to Oct 2, due Fri Oct 9 and paid Fri Oct 16.
- Do all date math as calendar dates in `America/Los_Angeles`, as `YYYY-MM-DD` strings, the same way `lib/schedule/occurrences.js` does. Don't let UTC shift a date by a day.
- Never create or show periods before the anchor.

**Which period the page opens on:** the oldest period that has ended and isn't approved yet. If none are waiting, open on the period in progress. Approving a period moves the page to the next one. Nothing gets approved automatically, and an unapproved period never rolls forward or disappears. If two periods are waiting, show both in the header ("2 periods need approval") and open the oldest.

## Where the numbers come from

Use `lib/schedule/sessions.js` (`getSessionsForClass`) and `computeClassOccurrences`. They already skip scoped holidays and the program's off days, the same way ScheduleBoard does. Don't write a second version of that logic.

For each period:

1. Load every class with its school, district and program, plus its `class_assignments`.
2. Get the class's sessions inside the period. Sessions before `start_date` and after the computed end don't count.
3. Make one pay line per session for each assigned person in slot `instructor_1` or `instructor_2`. `admin_review` slots are **not** paid. Put that rule in one constant, `PAID_SLOTS`, so I can change it later.
4. Line amount = the instructor's rate per class.

The admin can:
- Turn any line between **Pay** and **Don't pay**, with an optional reason ("School minimum day").
- Change an instructor's rate in the drawer. A rate change applies to unapproved periods only.
- Add adjustments, positive or negative, with a label and note (reimbursement, bonus, correction).

Assignments are stored as current state only, so if someone is reassigned mid-period the lines follow whoever is assigned now. That's fine for v1. Say so in a code comment, and keep it visible in the drawer by listing every session line so the admin can switch off ones that shouldn't be paid.

Mark an instructor row **Needs review** when any of these apply: no rate set, any line was switched to Don't pay, or an adjustment was added. Approve stays blocked while any instructor with paid lines has no rate.

## Database

Write `supabase/migrations/add-payroll.sql`. I run SQL by hand in the Supabase SQL editor, so make it idempotent (`IF NOT EXISTS`, drop and recreate policies). Tell me when to run it.

- `instructor_pay_rates`: `profile_id` (PK, FK profiles), `rate_per_class numeric(8,2)`, `updated_at`, `updated_by`. Keep rates in their own table, not on `profiles`, so instructors and the public staff page can never read them.
- `payroll_settings`: a single row with `anchor_date` (2026-09-05), `period_days` (14), `due_offset_days` (7), `payday_offset_days` (14), `reminder_emails text[]`, and `reminders jsonb` (which reminders are on). Seed it.
- `payroll_periods`: `id`, `start_date`, `end_date`, `due_date`, `payday`, `status` ('open' | 'approved' | 'paid'), `approved_at`, `approved_by`, `paid_at`, `total numeric(10,2)`. Unique on `start_date`. Create rows on demand when the page loads. Don't add a cron job just for this.
- `payroll_line_overrides`: `period_id`, `profile_id`, `class_id`, `session_date`, `pay boolean`, `reason`. Unique on (period, profile, class, date). This only holds Don't pay choices for open periods.
- `payroll_adjustments`: `id`, `period_id`, `profile_id`, `amount numeric(10,2)`, `label`, `note`, `created_by`, `created_at`.
- `payroll_lines`: the locked snapshot written at approval. Columns: `period_id`, `profile_id`, `instructor_name`, `class_id`, `school_name`, `program`, `session_date`, `session_time`, `slot_type`, `rate`, `amount`, `paid boolean`, `reason`. Once a period is approved, history reads **only** from here, so later schedule edits, deleted classes or rate changes can't change past payroll.
- `payroll_activity`: `period_id`, `kind`, `text`, `actor`, `created_at`. This feeds the Activity list in the history drawer: "Period closed", "Reminder emailed to Heather and Destiny", "Approved by Heather", "CSV exported", "Instructors paid", "Overdue reminder emailed". It also serves as the reminder log, so each reminder sends once.

RLS: all of these tables are admin-only for select, insert, update and delete. Check admin by `profiles.user_id = auth.uid()`, and also allow `profiles.id = auth.uid()` for legacy profiles (the existing migration already does this). Block updates and deletes on `payroll_lines`, and on adjustments for approved periods, with a policy or trigger. Corrections go on the next period as an adjustment, exactly as the mockup note says.

## Server code

- `lib/payroll/schedule.js`: pure date functions, no database. `getPeriodForDate(date, settings)`, `getPeriodsBetween(...)`, `getDueDate`, `getPayday`. Add a small `scripts/check-payroll-dates.mjs` that asserts the dates above (Sep 5–18 → due Sep 25 → paid Oct 2; Sep 19–Oct 2 → due Oct 9 → paid Oct 16; a date like Oct 22 falls in Oct 17–30). There's no test runner, so make it runnable with `node`.
- `lib/payroll/compute.js`: builds the period view (instructor rows, lines, totals, needs-review flags) for an open period, or reads the snapshot for an approved one.
- `lib/payroll/actions.js`: server actions, each re-checking admin the same way `lib/instructors/actions.js` does. `setLinePay`, `setRate`, `addAdjustment`, `removeAdjustment` (open periods only), `approvePeriod` (recompute on the server, write `payroll_lines` and the total, set status and log activity, all in one go so a double click can't approve twice), `markPaid`, `saveSettings`.
- `app/api/admin/payroll/export/route.js`: CSV for a period. One row per instructor (name, paid classes, rate, adjustments, total), then a detail section with one row per line. Log "CSV exported".

**Settings changes:** saving the Pay schedule modal only affects periods after the last approved one. Never rewrite dates on approved periods. If the new anchor or length would leave a gap or overlap with the last approved period, show an error instead of saving.

## Reminder emails

Add `sendPayrollReminderEmail({ to, period, total, instructorCount, paidClasses, needsReview, kind })` to `lib/email/index.js`, built with `buildEmailHTML`, `emailButton` and `emailInfoBox` from `template.js`, like the other emails. Copy and subject should match the email preview in the mockup ("Payroll due Fri, Sep 25: Sep 5 – 18 needs your approval"). The button goes to `/admin/payroll`.

Reminders, each sent once per period and logged in `payroll_activity`:
- **Period closed**: the day after the period ends.
- **Due soon**: 2 days before the due date.
- **Overdue**: the day after the due date if it's still not approved, then every 2 days until it is.

Send to `payroll_settings.reminder_emails`. Default to the two addresses in the mockup and let the modal edit the list.

There's no scheduler in this repo yet. Add `app/api/cron/payroll-reminders/route.js` that checks a `CRON_SECRET` bearer header, works out which reminders are due today in Los Angeles time, and sends them. Add a `vercel.json` cron that calls it daily at 15:00 UTC (8am Pacific). Add `CRON_SECRET` to `.env.example`, and tell me to set it in Vercel.

## Sidebar

Add **Payroll** to `NAV_OPERATIONS` in `app/admin/components/Sidebar.jsx`, after Programs and Schedule Board. Use the icon from the mockup, and add a badge with the count of periods waiting for approval. Load that count in `app/admin/layout.jsx` the way `incidentCount` is loaded, inside a try/catch so the layout still works before the migration is run.

## Copy rules

Use the wording from the mockup. No em dashes in any UI text or emails. Use an en dash for date ranges ("Sep 5 – 18") as the mockup does. Money is `$1,240.00`.

## When you're done

1. List the files you changed.
2. Tell me exactly which SQL to run and in what order.
3. Run `node scripts/check-payroll-dates.mjs` and `npm run build`, and show me both results.
4. Walk me through checking it by hand:
   - set a rate for Roger Williams
   - open Sep 5–18
   - switch one session to Don't pay
   - add a $25 supply reimbursement
   - approve
   - export the CSV
   - edit that class on the Programs page and confirm the approved period didn't change
   - add a PM-only holiday on a day with an afternoon class and confirm that session drops out of the open period

Don't commit or push. I'll review first.
