# Schedule Board v2: easier to read, absences and subs, Saturday support

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, server actions or route handlers.

## Goal

Redesign the admin Schedule Board (`app/admin/schedule`) so it's easier to read. Add a way to mark an instructor out for a day or a date range and put a sub in, without changing who normally teaches the class. Add Saturday as an option for classes.

**Rules that shape everything below:**
- **Classes never get cancelled.** When someone's out, the class still happens. Either a sub covers it, or it's flagged as needing a sub until we find one.
- **Instructors don't enter absences.** They message us, and an admin enters it here.
- **No sick pay or payroll changes in this task.** Payroll comes later. Just store the data so payroll can use it: who was out, who subbed, and on what date.

The design is on my canvas ("Schedule Board v2: easier to read, absences and subs"). Everything you need from it is written out below. Use the navy/teal theme and tokens in `app/globals.css` (`--navy`, `--navy-deep`, `--navy-mid`, `--teal`, `--teal-dark`, `--red`, `--tint`, `--ink`, `--ink-soft`), with no orange or gold. Match the look of the redesigned Programs page: white cards with soft shadows and no borders, one solid navy primary button, and ghost buttons for everything else. Baloo 2 headings, Nunito body text, CSS Modules.

**Reuse, don't rebuild:**
- `lib/schedule/occurrences.js` and `lib/schedule/sessions.js`: they decide whether a class meets on a date, including scoped holidays, AM/PM partial holidays and program days off.
- The existing assign and unassign actions.
- `BottomSheet.jsx` and `useIsMobile` for mobile.
- `app/admin/components/Modal.jsx` for popups.

## 1. Database

Write `supabase/migrations/add-session-absences.sql`. I run SQL by hand in the Supabase SQL editor, so make it idempotent and tell me when to run it.

```sql
CREATE TABLE IF NOT EXISTS session_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('instructor_1','instructor_2')),
  absent_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- null when filling an empty slot for one day
  sub_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,    -- null = still needs a sub
  reason TEXT CHECK (reason IN ('vacation','sick','emergency','other')),
  note TEXT,
  absence_group_id UUID,          -- ties together rows made by one "several days" entry
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, session_date, slot_type)
);
```

- **RLS:**
  - **Admins** can do everything. Check admin with the same `verifyAdmin` pattern as `lib/instructors/actions.js`, which matches `profiles.user_id` or the legacy `profiles.id`.
  - **Instructors** can read a row only if they're the absent person or the sub, and they never see `reason` or `note`. Do this with a view or a function that leaves those columns out, not by trusting the client.
- **Saturday:** check whether `classes.days` has a constraint limiting it to Mon–Fri. If it does, extend the constraint to allow `Sat` too. Also update the comment in `supabase/schedule-schema.sql`.

## 2. "Who teaches this session" helper

Add `lib/schedule/session-staff.js` with `getSessionStaff(classes, assignments, sessionChanges, date)`. For each class meeting on that date, it returns each slot's **regular** instructor and **actual** instructor for that day, plus a status:
- `normal`
- `sub` (someone's out and a sub is covering)
- `needs_sub` (someone's out and there's no sub yet)
- `one_time` (an empty slot filled for this day only)

The board, the instructor app and, later, payroll all use this one helper. Never work out "who's teaching" anywhere else.

## 3. Saturday support

- **Day pickers:** add `Sat` to the options in `app/admin/programs/ClassPanel.jsx` (`DAY_OPTIONS`), `app/admin/schedule/AddClassModal.jsx` and the Programs page class form. Don't add Sunday.
- **The board shows Saturday only when that week actually has a Saturday session.** Use the occurrence logic, so a class whose days include `Sat` but that doesn't meet that Saturday (because of a holiday, or it hasn't started) doesn't count. In normal weeks the board stays Mon–Fri with 5 columns. When Saturday appears, use 6 equal columns, and the week label stretches to "Nov 16 – 21, 2026".
- **Month view:** shows Saturday only for weeks that have a Saturday session. If that's awkward in the layout, show a small dot on that week's row instead and tell me what you chose.
- **One-time Saturday events:** use a class that starts on that Saturday with 1 session. No new feature is needed. If a class has only one session, show "One-time" in small navy text under the district on its card.
- **Payroll** periods already run Sat–Fri, so nothing changes there.

## 4. Week view layout

**Header** (one row):
- "Schedule Board" (Baloo 2, 32px).
- Right after it: ‹ week label › and a small "This week" pill that jumps back to the current week.
- On the right: the Week/Month segmented toggle, a ghost "Mark someone out" button (opens section 6 in several-days mode) and a solid navy "+ Add class" button.
- The old "Programs" button can go, since it's in the sidebar.

**Week summary strip** (a white rounded bar under the header):
- "This week" in bold, then "{n} classes · {n} instructors" in muted text.
- Then one chip per absent person: teal, "Heather Swear out Wed – Thu (vacation)".
- Then, if any session needs a sub, a red chip: "{n} class(es) need a sub". Clicking it scrolls to the first one.

**Day columns:**
- **Days with classes** get a soft column background (`rgba(255,255,255,0.55)`, 16px radius).
- **Days with no classes** have no background and just say "No classes" in small muted text, so the eye goes to the busy days.
- **Column header:** the weekday in small caps, then the date number big (Baloo 2, 22px). Today's column gets a navy "Today" pill. A day with a session that needs a sub gets a red "Needs a sub" pill.

**Class card:** white, 14px radius, soft shadow. Inside:
- **Top line:** the time big (Baloo 2, 20px), with the program tag on the right (Wellness on a light teal tag, Soccer on a light navy tag).
- **Below:** the school name (15px, bold), then a district dot and name (13px, muted).
- **Instructor slots:** one row each, 44px minimum height. Each row has a 28px avatar with initials, the name and a faint "⋯" that gets darker on hover. **Remove the ✕ remove buttons completely.**

**Slot states (from `getSessionStaff`):**
- **Normal:** light tint background.
- **Sub covering:** light teal background with a teal border. Shows the sub's name, with "Subbing for {first name} · {Reason}" under it.
- **Needs a sub:** light red background with a red border and a red avatar. Shows "{Name} is out", with "{Reason} · no one teaching yet" under it. The card also gets a full-width red "Find a sub" button.
- **One-time fill:** like normal, with "Just this day" under the name.
- **Empty slot:** a dashed outline, a "+" circle and "Add instructor".

**Legend** at the bottom: "Subbing this day" (teal), "Out, needs a sub" (red), and "Click any instructor for options. Reasons are only shown to admins."

## 5. Slot menu (click an instructor)

A small popover menu, about 270px wide, anchored under the slot. It uses `role="menu"`, works with the arrow keys and closes with Escape or a click outside. The header line reads "{Name} · Wed, Nov 18".

- **Normal slot:**
  - "Mark out for Wed, Nov 18" (sub-line: "Pick a reason and a sub. Only this day changes.") opens section 6 in one-day mode.
  - "Swap for Wed, Nov 18 only" (sub-line: "Someone else teaches this one day") opens the same popup, with the reason left blank and optional.
  - A divider, then "Remove from this class" in red (sub-line: "Every week, from today on. Opens Programs."). It goes to `/admin/programs` with that class's panel open. Permanent changes only happen on Programs now.
- **Sub slot:**
  - "Change the sub" opens the popup with the current sub picked.
  - "{Name} is back" deletes that day's change, after a confirm.
- **Needs-a-sub slot:** clicking it opens the popup straight away.
- **Empty slot:**
  - "Every week" (sub-line: "Make them a regular instructor") uses the existing assign flow.
  - "Just Wed, Nov 18" (sub-line: "One-time help for this day") creates a `session_changes` row with no absent person.

On mobile, the menu opens in the existing `BottomSheet`.

## 6. "Mark someone out" popup

A centered popup, 740px wide, 20px radius, scrolls inside, closes with the X, Cancel, the overlay or Escape, and traps focus.

- **Title:**
  - From a slot: "Mark {first name} out"
  - From the header button: "Mark someone out"
- **Subtitle:**
  - One day: "The class still happens. Pick who teaches it instead."
  - Several days: "Every class they have in these dates is listed. Give each one a sub."
- **Top row:** a "Who's out" select (active and invited instructors) and a "How long" segmented control (**One day / Several days**).
- **One day:** a summary row with a teal stripe, "{School} · Wed, Nov 18", and under it "Wellness · 12:00 pm · co-teaching with Alexis De La Cruz" (or "teaching alone").
- **Several days:** "First day out" and "Last day out" date inputs.
- **Reason, marked "(only admins see this)":** pill buttons for Vacation, Sick, Emergency and Other, plus an optional note input, "Note, optional (e.g., texted at 7am)".
- **One day, "Who's subbing":** a radio list in two groups.
  - **"Free then":** instructors with no session that overlaps this one on that date, and who aren't out that day. Each gets a muted line under the name, like "Free · teaches in Fontana" (from `instructor_districts`), or "teaches in Rialto" when they're from another district. Put people from the same district first.
  - **"Can't sub":** greyed out and not selectable, with the reason in red: "Already teaching this class", "Out that day ({reason})" or "Teaching at {school} at {time}". Use `hours_per_day` or the class time to detect overlaps. If a class has no length, treat any session that day within 2 hours as overlapping.
  - Nobody is required. Saving with no sub leaves the session as "needs a sub".
- **Several days:**
  - A heading, "{Name} has {n} classes in these dates", with a "Same sub for all" select on the right.
  - One row per session in the range, from the occurrence logic: date, school, "{Program} · {time} · with {co-instructor}" or "teaching alone", and a sub select. Holidays that cancel their usual class show as a muted row, "No class".
  - Rows with no sub get a light red background and a red "Needs a sub" select.
  - Under the list: "You can save now and pick the rest later. Classes without a sub stay red on the board."
  - Save one `session_changes` row per session, all sharing one `absence_group_id`.
- **Email checkbox,** checked by default:
  - One day: "Email {sub} the class details"
  - Several days: "Email each sub their class details"
  - Add `sendSubAssignedEmail` to `lib/email/index.js` using `buildEmailHTML`, `emailButton` and `emailInfoBox`. Include the school, address, date, time and co-instructor, plus a link to `/instructor/dashboard`. **Never include the reason.** Group a person's several days into one email.
- **Footer:**
  - On the left, a live summary: "{Sub} will see it on My Schedule." / "No sub yet. It will show in red on the board." / "{n} class still needs a sub" (in red).
  - Cancel and a navy Save.

## 7. Instructor app (keep it small)

So subs actually know, update the instructor queries (`lib/schedule/instructor-queries.js`) to use `getSessionStaff`:

- **Subs:** sessions where they're the sub show on My Schedule and in the next-class card, with a teal "Covering for {first name}" label.
- **Absent instructors:** their sessions for those dates show "You're off" and drop out of "next class".
- **Class details sheet:**
  - **Coming up:** shows these per date.
  - **Teaching with:** shows the actual co-instructor for that day.
- Instructors never see the reason or note.

## 8. Clean up

- Remove the ✕ unassign buttons and their handlers from the board. Assigning and removing regular instructors happens on Programs, plus "Every week" in the empty-slot menu.
- Delete `ManageModal.jsx` and its CSS if nothing imports it anymore (the Programs page replaced it). Tell me before deleting anything else.
- **Copy:** no em dashes in any UI text or emails (en dashes in date ranges are fine). Use the copy above exactly.

## When you're done

1. List the files you changed and the SQL I need to run.
2. Run `npm run build` and `npm run lint` and show me the results.
3. Give me a click-through to test:
   - mark someone out for one day with a sub
   - mark someone out with no sub (it should show red, the summary chip should count it, and the day pill should appear)
   - mark a vacation across two weeks that includes a holiday
   - change a sub
   - "is back"
   - fill an empty slot for one day
   - "Remove from this class" goes to Programs
   - add a one-time Saturday class (the Saturday column should appear only that week)
   - check the sub's My Schedule and the absent instructor's "You're off" on a phone

Don't commit or push. I'll review first.
