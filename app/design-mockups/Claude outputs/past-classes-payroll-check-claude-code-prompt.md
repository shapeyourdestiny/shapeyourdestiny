# Instructor Past classes + payroll class check

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, server actions or route handlers.

## Goal

1. **Past classes (instructor app).** Instructors can see their own record: classes they taught, classes they subbed, and their days off with the reason. They see it by pay period or for the whole school year.
2. **Payroll class check.** When a pay period ends, each instructor who had classes is asked to confirm the list or flag what's missing or wrong, by a deadline before payroll approval. Flags come to the admin Inbox. If an instructor doesn't answer, we go with what's listed.
3. **Breaks.** Pay periods with no classes for someone (winter break, between programs, sometimes up to 3 months) must never ask them to check anything, never send reminders, and never show up as "No reply".

The designs are on my canvas ("Instructor app: past classes and payroll check", six phone screens). Everything you need from them is written out below.
- **Look:** navy/teal tokens from `app/globals.css`, Baloo 2 headings, Nunito body text, CSS Modules.
- **Instructor app:** the floating nav, with the active tab in teal and white text, and the existing bottom sheets.

**Reuse, don't rebuild:**
- **Pay periods:** `lib/payroll/schedule.js`, which has 14-day Sat–Fri periods anchored on Sat Sep 5, 2026. Approval is due 7 days after the period ends, and payday is 14 days after. For example, Oct 31 – Nov 13 is due Fri Nov 20 and paid Fri Nov 27.
- **Who taught each session:** `lib/schedule/session-staff.js` (`getSessionStaff`), with the occurrence logic so holidays and program days off are handled.
- **Absences:** `session_changes`.
- **Instructor inbox:** the existing `lib/inbox/instructor.js`.
- **Admin inbox:** the existing `lib/inbox/admin.js`.
- **Shout-outs:** the existing compose sheet.

Payroll itself isn't built yet. **Don't build payroll screens.** Store the check results so the payroll build can use them later.

## 1. Database

Write `supabase/migrations/add-payroll-checks.sql`. Make it idempotent, and tell me when to run it.

```sql
CREATE TABLE IF NOT EXISTS payroll_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed','flagged')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, period_start)
);

CREATE TABLE IF NOT EXISTS payroll_check_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES payroll_checks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('missing','wrong','other')),
  issue_date DATE,                 -- for "missing"
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  session_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,  -- for "wrong"
  session_date DATE,               -- for "wrong"
  note TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution_note TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_check_settings (   -- single row
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  confirm_offset_days INT NOT NULL DEFAULT 3,   -- deadline = period end + 3 days (Fri → Mon)
  reminder_enabled BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO payroll_check_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
```

**RLS:**
- **Admins:** all access.
- **Instructors:**
  - They can select and insert their own `payroll_checks` rows, for their own profile only.
  - They can select and insert issues on their own checks.
  - They can't update anything once it's sent. That applies to checks and to issues.
  - Do the inserts through server actions that validate the period. It must be a real period that has ended and isn't past its deadline.

## 2. When an instructor has something to check

Add `lib/payroll/checks.js`.

**`getPeriodSessions(profileId, period)`** returns every session in the period where they actually taught, subbed, or were scheduled and out. Each one is marked `taught`, `subbed` (with who they covered), `off` (with reason and who covered), `holiday` (a class of theirs that didn't meet because of a holiday or program day off) or `upcoming`.

**`needsCheck(profileId, period)`** is true only when all of these hold:
1. the period has ended
2. today is on or before the deadline (`period_end + confirm_offset_days`)
3. they have at least one `taught` or `subbed` session in it
4. there's no `payroll_checks` row yet

**Breaks:** if someone has zero taught or subbed sessions in a period, they're never asked. There's no Inbox item, no reminder, no check card, and they never show as "No reply". It doesn't matter whether that's because of a break, being newly added, or having no classes assigned. This also covers instructors with no schools at all.

**`getCheckStatus(period)`** (admin only) returns a status for each active instructor:
- `confirmed`
- `flagged` (with the issue count)
- `no_reply` (only if `needsCheck` would have been true and the deadline has passed or is coming up)
- `no_classes`

## 3. Instructor: Past classes page (`/instructor/past`)

**Getting there:**
- A "Past classes ›" link under My classes on My Schedule.
- A link from the payroll check Inbox item.
- The page has a back button in the header.

**Header:**
- "Past classes" (Baloo 2, 30px).
- Under it: "Your own record. Only you and the office can see it."

**Range switch:** a full-width two-tab segmented control on a white track, **Pay period · School year**. The selected tab is solid navy with white text.

**Navy summary card:**
- **Pay period:**
  - A small caps label: "THIS PAY PERIOD", or "PAY PERIOD" for older ones.
  - The range in Baloo 2, 22px ("Oct 31 – Nov 13"), with ‹ › buttons to step through periods. The › button is disabled on the current period. Don't go back before Sep 5, 2026, or before the instructor's first class.
  - Three tiles in faint white: **Taught**, **Subbed**, **Days off**.
  - A muted line:
    - Open period: "Payday Fri, {date} · {n} classes still coming up this period".
    - Ended period: "Period ended Fri, {date} · Payday Fri, {date}".
- **School year** (Aug 1 – Jul 31): label "SINCE {first class date}" and "2026–27 school year", with the same three totals.

**Check card** (pay period view only, under the summary). Show the state that applies:
- **Needs check** (`needsCheck` is true): a white card with a 2px `#9FD4DE` border and a teal check-box icon tile.
  - Text: "Check your classes by {deadline weekday, Mon D}". Under it: "Make sure every class you taught or subbed is listed below. If we don't hear from you, we'll go with what's here."
  - Buttons: a navy **"Looks right"** and a white **"Something's off"**, both full-width halves and 48px tall.
- **Confirmed:** a light green card with a green check circle, "You confirmed these classes", and "{confirmed date} · Payday is Fri, {date}".
- **Flagged:** a light amber card with an amber dot, "Sent to the office", then their note in quotes, then "We'll fix it before payroll and let you know."
  - Once an admin resolves the issue, the card shows "Fixed by the office", the resolution note, and "{date}".
- **Deadline passed and no answer:** no card. The page just shows the record.

**Break / empty period card** (pay period view, when they have no taught, subbed or off sessions in that period). **Never hard-code break names or dates.** Everything here is worked out from data that already exists, so admins don't edit anything during the year:
- **The card:** a soft navy gradient hero card with a navy rounded icon tile (a sun icon).
- **Break name pill** (optional, above the heading): a small white pill with teal-dark text.
  - Look at the `holidays` and `program_off_days` rows that apply to this instructor's schools and programs.
  - If one name covers at least half of the period's weekdays, show it, as entered (e.g. "Winter break", "Thanksgiving break", "Spring break").
  - If nothing covers it, or several different names do, show no pill.
- **Heading:** "No classes this pay period".
- **Text** is always the same: "Nothing to check this time." Don't mention pay, since there can be exceptions.
- **Admin note** (only if set): if an admin left an announcement note for this period (section 6), show it under the text in 15px ink.
- **A white pill:** "Classes start again {weekday, Mon D}", using their next scheduled session. Leave it out if they have nothing scheduled.
- **Under the hero**, a small white card: "LAST PAY PERIOD WITH CLASSES", then "{range}" with "{n} taught · paid Fri, {date}" on the right. Leave the card out if there isn't one.
- **Exception link:** under that, a centered navy text link, "Did you teach something we don't have? Let us know". It opens the same "Something's off" sheet with "A class is missing" preselected, so one-off events and unscheduled work still get caught before payroll.
  - This creates a `flagged` check for that period even though they had no classes, and it shows in the admin Inbox like any other flag.
  - Keep the link visible until that period's approval due date.

**The list:**
- **Pay period view:** grouped by week ("Week of Nov 9"), newest first.
- **School year view:** grouped by month.
- **Each group** is one white rounded card with thin dividers between rows.
- **Each row:**
  - **Left:** a 46px date tile with the weekday in small caps and the day in Baloo 2, 20px. Holidays and days off use a muted number color. Subbed rows get a light teal tile.
  - **Middle:**
    - **Title:** the school name in bold. For holiday rows, use the holiday name instead.
    - **Muted line:**
      - Taught: "{Program} · {time} · with {co-instructor}" or "taught alone".
      - Subbed: "covered for {first name}".
      - Days off: "{Reason} · {sub first name} covered".
      - Holidays: "{School} would have met".
    - **A small status pill:**
      - **Taught:** green `#E3F1E1` / `#2F6F29`.
      - **You subbed for {first name}:** light teal.
      - **Day off · {Reason}:** gray.
      - **No class:** pale gray.
      - **Coming up:** light navy.
  - **Right:** a small light-teal "★ Thank" pill when there was a co-instructor, or a sub who covered for them. It opens the existing shout-out compose sheet with that person, class and date filled in. If they already thanked that person for that session, show "✓ Thanked".
- **Footer line:** "Something look wrong? Text the office and we'll fix it."

**Never show instructors:** notice given, "classes left without a sub", reliability numbers, other people's absences or reasons, or pay amounts (pay amounts come later with payroll).

## 4. "Something's off" sheet

A bottom sheet titled "What's off?", with "Pay period {range}" under it and a close button.

**Three radio cards:**
- **A class is missing:** "I taught or subbed one that isn't listed". This shows Date (limited to the period) and School (their schools plus every school, then "Other").
- **Something listed is wrong:** "Wrong date, school, or I didn't teach it". This shows "Which class", a select of that period's rows.
- **Something else:** "Hours, a question about pay".

Then a required "Tell us what happened" textarea (500 characters max), then a big navy **"Send to the office"** button.

**Sending:**
- It creates the `payroll_checks` row with status `flagged`, plus one issue, then closes the sheet.
- After sending, they can add another issue ("+ Add another" in the flagged card) until the deadline. They can't edit or delete what's already sent.

## 5. Reminders and Inbox (instructor)

- **When a period ends:** everyone where `needsCheck` is true gets an Updates item: "Check your classes for {range}", "Due {weekday, Mon D}. Takes a few seconds." It opens `/instructor/past` on that period.
  - It goes away once they confirm or flag, or the deadline passes.
- **The day before the deadline:** if `reminder_enabled` is on and they still haven't answered, send one email using the existing helpers:
  - Subject: "Quick check before payday: {range}"
  - Body: a line and a button.
  - No content, no counts.
  - Skip anyone with no classes in the period.
- **When an issue is resolved:** they get an Updates item, "The office fixed your {range} classes", with the resolution note.

## 6. Admin side

- **Admin Inbox:**
  - New item type **"Payroll check"** for each open issue: the instructor, the kind ("Missing class" / "Wrong class" / "Question"), the date and school, and their note.
  - **Buttons:**
    - **Add the class:** for "missing". It opens the Schedule Board's one-day "Swap / just this day" popup prefilled for that date and school, so it becomes a real `session_changes` row.
    - **Open Schedule Board:** for "wrong", jumping to that date.
    - **Mark fixed:** asks for an optional resolution note, which the instructor sees.
  - Add a "Payroll checks" segment with its count.
- **Status card at the top of the Inbox** while a period's check is open (from the day the period ends until its approval due date):
  - "{range} class check · due {deadline}".
  - Counts: "{n} confirmed · {n} flagged · {n} no reply".
  - Then a list showing each person's status: Confirmed (green), Flagged (amber), No reply (gray), and No classes (muted, collapsed under "{n} with no classes this period").
  - If **nobody** had classes that period (a full break), don't show the card at all.
- **Settings:** add the deadline offset and the reminder toggle to the payroll schedule settings if they exist. Otherwise make a small "Class check settings" link in the Inbox header that opens a popup with:
  - "Deadline: {n} days after the period ends" (1–6)
  - "Remind people who haven't checked the day before"

  Saving it updates `payroll_check_settings`.
- **Optional note per pay period:** add `payroll_period_notes (period_start DATE PRIMARY KEY, note TEXT CHECK (char_length(note) <= 200), updated_by UUID, updated_at TIMESTAMPTZ)` to the migration. Admins only can write it, and instructors can read it.
  - **Settings field:** in the class check settings popup, add a small "Note for a pay period" field with a period picker, for things like "Spring program starts Mar 2!"
  - **Where it shows:** on the empty-period card and the check card for that period.
  - **When it's blank,** nothing extra shows.

## 7. Notes for the payroll build later

Leave a comment block at the top of `lib/payroll/checks.js` explaining:
- **No classes means nothing to approve.** Payroll should treat `no_classes` as "nothing to pay" and never block approval on it. A period where nobody had classes should be marked "Nothing to pay" automatically, with no reminder emails to admins.
- **Open issues should warn before approving.** Approving with open issues should show a warning, not a hard block.
- **"No reply" means "went with what's listed."**

## Copy and checks

- **Copy:** no em dashes anywhere (en dashes in date ranges are fine). Use the copy above exactly, and use first names for people in instructor-facing text.
- **Instructor app:** tap targets of at least 44px. Sheets trap focus and close with Escape.

## When you're done

1. List the files you changed and the SQL to run.
2. Run `npm run build` and `npm run lint` and show me the results.
3. Give me a click-through. Use a test date or a dev-only `?today=YYYY-MM-DD` override that only works in development:
   - after a period with classes ends, the Inbox item appears, and "Looks right" turns the card green
   - flag a missing class: the card turns amber, it shows in the admin Inbox, "Add the class" creates it on the board, and "Mark fixed" sends the instructor an Update
   - a period during winter break: no Inbox item, no card, the break hero shows with "Classes start again…", and the admin status card is hidden
   - an instructor with no classes in a normal period shows under "No classes", never "No reply"
   - after the deadline, the check card is gone, and the admin sees "No reply" only for people who had classes
   - the Thank pill opens the shout-out sheet prefilled

Don't commit or push. I'll review first.
