# Class assignment emails: one email per instructor with all their changes

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing server actions or emails.

## Goal

When I assign instructors to classes on the Programs page, they should get an email about it. **If someone gets several classes, they get one email listing all of them**, not one email per class.

**Admins decide when it goes out.** Assigning someone doesn't send anything right away. Changes collect into a "waiting to be sent" list, and I send them when I'm ready. That way I can set up a whole season over a few days without people getting half-finished schedules.

The design is on my canvas: "Class assignment emails: one email per instructor with all their changes". It has 3 boards:
- Programs bar
- Review and send
- The email

**Style:** navy/teal tokens, Baloo 2 and Nunito, CSS Modules.

**Reuse:**
- `verifyAdmin`
- Resend helpers in `lib/email/index.js`
- the existing class assignment tables (`class_assignments`)
- the Inbox (Updates) and the admin Inbox
- `getSessionStaff` for co-teachers

## 1. What gets collected

**Every time an admin changes a class assignment, record a pending change.** This covers Programs and anywhere else assignments are edited.

**Count these:**
- **New:** an instructor is added to a class, as lead or co-teacher.
- **Changed:** the class's day, time, start date or school changes for an instructor who's already assigned.
- **Removed:** an instructor is taken off a class.

**Don't count these:**
- Single-day subs and absences. Those already have their own notifications (`session_changes`).
- Changes to classes that have already ended.

**Changes cancel each other out before sending:**
- Added, then removed again before sending: nothing is sent.
- Several edits to the same class: one "Changed" line showing the latest version. The "was" part shows how it looked when the person was last told.
- Added, then edited before sending: it stays "New", with the latest details.

Write `supabase/migrations/add-assignment-notices.sql`. Make it idempotent, and tell me when to run it.

```sql
CREATE TABLE IF NOT EXISTS assignment_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  class_id UUID NOT NULL,              -- reference the real classes table
  kind TEXT NOT NULL CHECK (kind IN ('new','changed','removed')),
  before JSONB,                        -- what they were last told (for "changed")
  after JSONB,                         -- current details
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,                 -- null = waiting to be sent
  sent_by UUID REFERENCES profiles(id)
);
```

Admins only, through RLS. Instructors never read this table directly.

## 2. Programs page: "waiting to be sent" bar

When there are unsent changes, show a light teal bar at the top of Programs, under the header:
- **Icon:** a mail icon tile.
- **Title:** "{n} instructors have class changes that haven't been sent"
- **Under it:** "Each person gets one email with all their changes."
- **Button:** a teal **"Review and send"**.

**On class rows:** each class row with an unsent change for someone shows a small amber "Not sent yet" pill.

**After sending:** the bar goes away. A green confirmation shows for a few seconds: "Sent to {n} instructors."

**Admin Inbox:** if changes have been waiting for more than 24 hours, add one item: "{n} instructors haven't been told about their class changes". It links to Programs with the send window open. Only one item at a time.

## 3. "Review and send" window

This is a centered modal, like the Add school one.

**Header:**
- Title: "Send class assignments"
- Under it: "Uncheck anyone you're not ready to tell yet."

**One row per instructor:**
- a checkbox, checked by default
- their avatar, name and email
- their changes, one per line, each with a colored label:

  | Label | Color | Example |
  |---|---|---|
  | **New** | green | "Cypress Elementary · Soccer · Mon & Wed 3:00 pm, starts Jan 12" |
  | **Changed** | navy | "Citrus Elementary · Yoga · now Tue 1:30 pm" |
  | **Removed** | gray | "Cypress Elementary · Soccer · no longer on your schedule" |

**Footer:**
- muted text: "They'll also see it in their app Inbox."
- a ghost **"Preview email"** button. It shows the exact email for the first checked person, with a dropdown to pick someone else.
- the navy **"Send to {n}"** button, counting only the checked people

**When I click Send:**
- Each checked person gets **one** email.
- Each change of theirs gets `sent_at` and `sent_by`.
- Unchecked people stay waiting.
- **Double-click safe:** a second click doesn't send twice.

**If someone has no email or hasn't accepted their invite yet,** show "Not invited yet, will be included in their welcome" in muted text and leave their checkbox unchecked. Their changes stay waiting. If the invite or welcome flow can include their classes, have it do that, and tell me what you did.

## 4. The email

Match "The email" board.

**Subject:**
- only new classes: "Your new classes" (or "Your new class" for one)
- anything else: "Updates to your classes"

**Heading:**
- only new: "You have {n} new classes, {first name}!" (for one class: "You have a new class, {first name}!")
- otherwise: "Your schedule has updates, {first name}"

**Intro line:** "Here's what's been added to your schedule." or "Here's what changed."

**Sections, in order. Leave out any that are empty.**
- **NEW CLASSES:** a card per class, light green with a green left edge:
  - school name (bold)
  - "{Program} · {days}, {time}"
  - "Starts {Day, Mon D}", plus " · with {co-teacher first names}" if there are any
- **CHANGED:** a light navy card with a navy left edge:
  - school name
  - "{Program} · now {new day/time}"
  - "Was {old day/time} · starting {Mon D}"
- **NO LONGER ON YOUR SCHEDULE:** a light gray card with:
  - school name
  - "{Program} · {days}, {time}"
  - "Last class {Day, Mon D}"

**Button:** "View my schedule", linking to `/instructor/schedule`.

**Footer:**
- "If calendar sync is on, these will show up in your calendar too." (For changes: "your calendar will update too.")
- "Questions? Just reply to this email."

Reply-To is the team's contact email.

**Rules:**
- Include a school's address only if it's already stored. Otherwise leave it out.
- No pay or rate information.
- Nothing about other instructors except their first names as co-teachers.

## 5. In the app

When the email is sent, also add an item to their Inbox **Updates** tab. Use the Inbox v3 styling, with the "Schedule change" style and the calendar icon.
- **Title:** "Your new classes" or "Updates to your classes"
- **Open card:** the same list as the email, plus a "View schedule ›" link.
- It counts toward the unread badge like any other update.

**Their Schedule and calendar feed update as soon as the assignment is saved,** same as now. Only the email and the Inbox item wait for Send. (If you think the schedule should also wait until it's sent, tell me why. Don't change it on your own.)

## Copy and checks

- **Copy:** no em dashes (en dashes in date ranges are fine). Use the copy above exactly, and don't add extra lines.
- **Keyboard and labels:** the modal traps focus, closes with Escape, and every checkbox has a label.

## When you're done

1. List the files you changed and the SQL to run.
2. Run `npm run build` and `npm run lint` and show me the results.
3. Give me a click-through:
   - Assign Maya to 2 new classes. Nothing is sent, the bar shows "1 instructor…", and both rows show "Not sent yet".
   - Assign Alexis to a class and change the time of another class she's on. Remove Leila from one class.
   - Add someone and remove them again before sending: they don't appear.
   - Open "Review and send" and uncheck Leila. Preview Maya's email, then send to 2.
   - Maya gets one email with 2 new classes. Alexis gets one email with a New section and a Changed section. Leila gets nothing and is still waiting.
   - Both see an Inbox item, and the badge counts it.
   - Double-clicking Send doesn't send twice.
   - Leave a change waiting for over 24 hours: one admin Inbox item appears.

Don't commit or push. I'll review first.
