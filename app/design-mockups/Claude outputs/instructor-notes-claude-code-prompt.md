# Instructor notes & history (admins only)

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, server actions or route handlers.

## Goal

Add a private, admin-only record for each instructor: notes, training, communication, behavior, recognition, pay changes, performance reviews and disciplinary actions, plus their attendance history pulled from the Schedule Board. **Every admin can see and add notes. Instructors can never see any of it**, in the app, in the API or in the database.

The design is on my canvas ("Admin: instructor notes & history", four screens: the tab, adding a review, adding a pay change, adding a disciplinary action). Everything you need from it is written out below.
- **Colors:** use the navy/teal tokens in `app/globals.css`, with no orange or gold.
- **Look:** match the Programs and Schedule Board v2 pages. White cards with soft shadows and no borders, one solid navy primary button, ghost buttons for everything else.
- **Type and styling:** Baloo 2 headings, Nunito body text, CSS Modules.

## 1. Where it goes

`app/admin/instructors/[id]/InstructorDetail.jsx` already has Contact, Districts, a placeholder "Reviews & Audits" card, Upcoming Sessions and Account Actions.

**Tabs:** add a tab row under the instructor's name and status: **Overview** (what's there now) · **Schedule** (Upcoming Sessions) · **Notes & history**. Remove the placeholder "Reviews & Audits" card.

**Selected tab:** a teal 3px underline. Keep the tab in the URL (`?tab=notes`) so it survives a refresh.

**Lock pill:** next to the tabs, a small gray pill with a lock icon: "Admins only. {First name} never sees this tab."

## 2. Database

Write `supabase/migrations/add-instructor-notes.sql`. I run SQL by hand in the Supabase SQL editor, so make it idempotent and tell me when to run it.

```sql
CREATE TABLE IF NOT EXISTS instructor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('review','pay','training','communication','behavior','disciplinary','recognition','other')),
  title TEXT NOT NULL,
  note_date DATE NOT NULL,
  body TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,  -- type-specific fields, see below
  follow_up_date DATE,
  follow_up_done_at TIMESTAMPTZ,
  follow_up_note TEXT,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instructor_note_versions (   -- edit history
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES instructor_notes(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,      -- the row as it was before the edit
  edited_by UUID REFERENCES profiles(id),
  edited_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instructor_note_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES instructor_notes(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
```

**`details` by type:**
- **review:** `{ ratings: { reliability, class_management, communication, lesson_delivery } (1–5), doing_well, work_on_next, next_review_date }`
- **pay:** `{ rate_from, rate_to, effective_date }`. `effective_date` is the first day of the chosen pay period.
- **training:** `{ expires_on }`, optional.
- **disciplinary:** `{ step: 'verbal'|'written'|'final'|'suspension', about, what_happened, expectation, if_repeated, talked_on, also_present, acknowledged (bool), suspension_start, suspension_end }`
  - `about` is one of: `punctuality`, `conduct_students`, `conduct_staff`, `communication`, `safety`, `dress_code`, `other`.
  - `suspension_start` and `suspension_end` are used for suspensions only.

**Indexes:** on `(profile_id, note_date DESC)` and `(follow_up_date) WHERE follow_up_done_at IS NULL`.

**Security** (this matters more than anything else in this task):
- **RLS on all three tables:** admins only, for select, insert and update. Check admin the same way `verifyAdmin` does in `lib/instructors/actions.js` (`profiles.user_id = auth.uid()` or the legacy `profiles.id = auth.uid()`, plus `role = 'admin'`). There's no instructor policy at all.
- **No hard deletes:** no `DELETE` policy on `instructor_notes`. Notes are archived, not deleted. Versions are insert-only.
- **Edit history:** a trigger on `instructor_notes` updates `updated_at` and writes the old row to `instructor_note_versions` before each update.
- **Files:** a private Storage bucket, `instructor-notes`, with admin-only policies. Files are only ever shown through short-lived signed URLs made on the server. Store them as `{profile_id}/{note_id}/{filename}`.
- **No public routes:** nothing in `public_staff()`, the staff page, the instructor app or any instructor-facing query touches these tables. Grep to confirm, and tell me what you checked.

## 3. Server code

- **`lib/instructor-notes/queries.js`:** `getInstructorFile(profileId)` returns:
  - **Notes:** active notes, newest first (archived ones only when asked), with the author's name and file list.
  - **Attendance entries**, built from `session_changes` where this person was absent. Read `supabase/migrations/add-session-changes.sql` for the real column names. Each one has the date, school, program, time, reason, who subbed (or "no sub") and who entered it.
  - **Summary numbers** for the left column (section 4).
- **`lib/instructor-notes/actions.js`:** `createNote`, `updateNote`, `archiveNote`, `restoreNote`, `completeFollowUp`, `uploadNoteFile` and `removeNoteFile`. Each one checks admin on the server first with `verifyAdmin`. Validate `details` per type, trim text, and turn empty strings into null.
- **Pay changes:** a pay note only records the change for now. If the `instructor_pay_rates` table exists (from `add-payroll.sql`), also upsert `rate_per_class = rate_to`. Don't build any payroll screens. Tell me whether that table exists in the code's expectations, so I know whether to run `add-payroll.sql`. The payroll build will use `effective_date` later, so pay periods before it keep the old rate.
- **Suspensions:** a suspension with dates only records it. Don't change the schedule automatically. In the save confirmation, say: "Use Mark someone out on the Schedule Board to cover their classes."

## 4. The tab layout

Two columns: a 300px summary column on the left and the timeline on the right.

**Summary cards** (white, 16px radius, each with a small uppercase label, a big Baloo 2 value and a couple of lines):
- **Pay:** the current rate ("$28 per class") from the latest pay note, or `instructor_pay_rates`. Under it: "Since {effective date}" and "Before: $25 per class". If there's no rate: "Not set".
- **Attendance this school year:** "{n} days out". Lines: a count per reason, and "Classes left without a sub", which is green at 0 and red above 0. The school year is Aug 1 to Jul 31 (America/Los_Angeles).
- **Reviews:** "Next {date}" from the latest review's `next_review_date`. It's red with "Overdue" if the date has passed. Lines: the last review date, and the average rating of the latest review ("4.0 of 5").
- **Disciplinary** (only if they have any active ones): the latest step ("Verbal warning", in red text), "Last step {date}" and "About {topic}".
- **Open follow-ups:** a count, or "None" in green. List each with its date, and click one to jump to its note. Also show "Training expiring" with the nearest training `expires_on` within 90 days.

**Timeline header:** filter chips (All · Reviews · Pay · Attendance · Training · Communication · Behavior · Disciplinary · Recognition). Each chip has a colored dot and a count, and the selected chip gets a white background and a navy border. On the right is a solid navy "+ Add note" button. Under the chips, a small "Show archived" toggle.

**Timeline entry** (one card each):
- **Left column, 70px:** month (small caps), day (Baloo 2, 22px), year.
- **Top line:** the type tag (a colored 6px-radius tag), then the title (15px, bold), with an "Edit" button that shows on hover or focus.
- **Below:** the body text (14px), then the type-specific block:
  - **Pay:** a light green block, "~~$25.00~~ → **$28.00 per class** from the {pay period} pay period".
  - **Review:** four small boxes, each with the rating name and a 5-segment teal bar, then "Doing well" / "Work on next", and a "Next review {date}" pill.
  - **Disciplinary:** a light red block with the step ladder "Verbal › Written › Final › Suspension" (current step in solid red, earlier steps in light red, later steps in gray). Then three label/value rows: What happened, What we expect, If it happens again. Then a pill, "Talked in person on {date} · {name} acknowledged" (or "not acknowledged"), plus "Also present: {name}" when given.
  - **Training:** an "Expires {date}" pill.
  - **Follow-up:** a pill. Open: "Follow up by {date}", with a "Mark done" button that asks for an optional note. Done: green, "Follow-up done {date} · {note}".
  - **Files:** file names that open through signed URLs.
- **Bottom line:** "{Author} · {date, time}". Add "· edited" if it has versions, and clicking that opens a small history list of who changed it and when.
- **Attendance entries** come from the Schedule Board and can't be edited here. They have a dashed outline, a faint background, "From the Schedule Board", a title like "Out · Sick" and a body like "Palmetto Elementary, Wellness 12:00 pm. Leila subbed." or "No sub found."
- **Archived notes** (when shown) are faded, with an "Archived {date} by {name}" line and a "Restore" button.

**Edit menu:** Edit, Archive (with a confirm: "Archived notes are hidden but kept. You can restore them."), and for files, Remove file.

## 5. "Add note" popup

A centered popup, 720px wide. It scrolls inside, closes with the X, Cancel, the overlay or Escape, and traps focus.
- **Title:** "Add a note for {first name}"
- **Subtitle:** "Only admins can see notes. Stick to what happened and what was agreed."

**Fields:**
- **Type:** pill radios: Review, Pay change, Training, Communication, Behavior, Disciplinary, Recognition, Other.
- **Title and Date** side by side. The date defaults to today.
  - Title placeholder: "Short summary", or "e.g., Raise after review" for a pay change.
- **Then the fields for the chosen type:**
  - **Review:**
    - Four rating rows (Reliability, Class management, Communication, Lesson delivery), each with 1–5 square buttons. The hint reads "(1 needs work, 5 excellent)".
    - "Doing well" and "Work on next" textareas, side by side.
    - "Next review" date, defaulting to 6 months out, with "Shows as a reminder on the summary".
  - **Pay change** (a light green box):
    - "Current rate", read-only.
    - "New rate".
    - "Starts with pay period": a select of the next few pay periods. Periods are 14 days, Saturday to Friday, anchored on Sat Sep 5, 2026. Use `lib/payroll/schedule.js` if it exists.
    - The line "Saving updates {first name}'s rate in Payroll from that period on. Earlier periods don't change."
  - **Disciplinary:**
    - **Earlier steps line:** "Earlier steps for {first name}: {step} · {date} · {about}", or "None" if there aren't any.
    - **Step:** four cards to pick from:
      - Verbal warning: "Talked it through"
      - Written warning: "Signed copy on file"
      - Final warning: "Next step is suspension"
      - Suspension: "Off the schedule for a set time". This one shows start and end dates.
      - Preselect the step after their latest one.
    - **About:** a select.
    - **What happened:** a textarea.
    - **What we expect** and **If it happens again:** side by side. "If it happens again" prefills with the next step's name.
    - **A light red box:** "Talked with {first name} on" (date), "Also present" (text), a "{First name} acknowledged it" checkbox and "Attach signed copy" (file).
  - **Training:** "What happened" and an optional "Expires" date.
  - **Communication, Behavior, Recognition, Other:** "What happened", with the placeholder "Facts first: what happened, who was involved, what you talked about".
- **Bottom row:** a "Follow up on" checkbox with a date, and "Attach a file". This is the generic attachment for every type. For a disciplinary note, "Attach signed copy" in the light red box is the same upload, labelled for that step.

**Footer:** "Saved with your name and the time. Edits are kept in history." on the left, then Cancel and a navy "Save note".

**Editing:** reuse the same popup, titled "Edit note". The type can't be changed once a note is saved.

## 6. Also

- **Instructors list:** on `app/admin/instructors`, show a small red dot on an instructor's row if they have an overdue follow-up or review. Its `aria-label` is "Needs attention".
- **Copy:** no em dashes anywhere in UI text (en dashes in date ranges are fine). Use the copy above exactly. Dates look like "Nov 6, 2026", and money looks like "$28.00".

## When you're done

1. List the files you changed, plus the SQL and Storage setup I need to do, in order.
2. Run `npm run build` and `npm run lint` and show me the results.
3. Tell me how to confirm an instructor can't read notes. Give me a short SQL check I can run as an instructor user, or the exact test you used.
4. Give me a click-through:
   - add one of each type
   - edit a note and see "edited" and its history
   - archive and restore
   - complete a follow-up
   - attach and open a file
   - add a pay change and see the Pay card update
   - add a disciplinary step and see the ladder and the summary card
   - mark someone out on the Schedule Board and see it show up under Attendance

Don't commit or push. I'll review first.
