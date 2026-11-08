# Admin "Updates" page: send announcements to instructors

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages or server actions.

## Goal

Announcements already exist in the database and in the instructor app:
- `announcements` table and `my_announcements()` in `add-sharing-shoutouts-inbox.sql`
- `getMyAnnouncements` in `lib/instructor/inbox.js`, which shows them under Updates
- `sendAnnouncementEmail` in `lib/email/index.js`

**What's missing is the admin side:** a page to write, target, schedule, pin, edit and track announcements. Build `/admin/updates`, and add the few database fields it needs.

The design is on my canvas ("Admin · Updates: send announcements to instructors").
- **Look:** navy/teal tokens, white cards with soft shadows and no borders, one navy primary button, ghost buttons for the rest.
- **Type and styling:** Baloo 2 headings, Nunito body text, CSS Modules.

**Reuse:**
- the existing announcements table, function and email helper
- `verifyAdmin`
- the existing instructor Inbox read state (`inbox_reads` with item type `announcement`)

**If the old "+ Announcement" popup was built into the admin Inbox,** replace it with a link to this page. Don't keep two ways to send.

## 1. Database

Write `supabase/migrations/update-announcements.sql`. Make it idempotent, and tell me when to run it.

```sql
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent'
  CHECK (status IN ('draft','scheduled','sent'));
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS send_at TIMESTAMPTZ;        -- when it goes out (scheduled)
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS pinned_until DATE;          -- null = not pinned
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;
UPDATE announcements SET sent_at = created_at WHERE sent_at IS NULL AND status = 'sent';
```

**Audience:**
- **Existing types:** `{"type":"all"}`, `{"type":"program","program":"wellness"}`, `{"type":"school","school_ids":[...]}`.
- **New type:** `{"type":"people","profile_ids":[...]}`.
- **Update `my_announcements()`** to:
  - handle `people`
  - return only `status = 'sent'`, with `sent_at` and not archived
  - also return `pinned_until` and `edited_at`

## 2. Admin page (`/admin/updates`)

### Sidebar

Add **Updates** to the sidebar right after Inbox, with a megaphone icon. No badge.

### Header

"Updates" (Baloo 2, 32px), with "Send news to instructors. It lands in their Inbox under Updates." under it.

### Layout: two columns

The composer on the left, a 470px column on the right.

### Left: "New update" composer card

- **Header:** "New update". On the right, a small muted autosave status: "Draft saved" or "Saving…". Autosave as a draft every few seconds while typing, once there's a title or message.
- **"Start from (optional)":** template pills: **No class**, **Schedule change**, **Reminder**, **Welcome**. Picking one fills the title and message, and replaces only empty fields or the last template's text, never the admin's own writing. The templates:
  - **No class:** title "No classes {dates}", message "No classes {dates}. Enjoy the break! Classes pick back up {date}."
  - **Schedule change:** title "Schedule change at {School}", message "Starting {date}, class moves to {day and time}. Your schedule in the app is already updated."
  - **Reminder:** title "Reminder: ", with an empty message.
  - **Welcome:** title "Welcome to the team, {name}!", message "Please give {name} a warm welcome. They start {date} at {school}."
  - Keep the `{…}` placeholders as plain text for the admin to replace. If any `{` is left when they hit send, warn them: "Some {placeholders} are still in the message. Send anyway?"
- **Title:** 80 characters max. **Message:** 1000 characters max, with a live "{n} / 1000" counter.
- **"Send to":** a segmented control, **Everyone · A program · Schools · People**.
  - **A program:** a select (Youth Wellness, Soccer).
  - **Schools:** a checklist of schools that have current classes.
  - **People:** a searchable multi-select of active and invited instructors.
  - Under it, a live teal line: "{n} instructors will get this". The count uses the same logic as `my_announcements()`. Share one helper, or call an RPC.
- **Options box** (light tint, two columns):
  - **"Pin to the top":** a checkbox with a date picker, "Until {date}". It defaults to 2 weeks out, and can't be in the past.
  - **"Also email it":** a checkbox, with "Good for anything important" under it.
- **Bottom row:**
  - A **Send now / Schedule** segmented control. Schedule shows a date and time picker, which must be in the future, in America/Los_Angeles.
  - A ghost **Save draft** button.
  - The navy primary button: "Send to {n}", or "Schedule update" when scheduling.
  - **Sending asks for confirmation:** "Send '{title}' to {n} instructors? {They'll also get an email.}"

### Right column, card 1: "How it looks in their Inbox"

A live preview using the real Updates row styling:
- a "PINNED" label when pinned
- a white card, with a navy left edge when pinned
- the send icon tile
- "From {admin first name}: {title}" in bold
- the first ~110 characters of the message

### Right column, card 2: the list

**Tabs:** **Sent · Scheduled · Drafts**, each with a count.

**Each sent item:**
- the title, a "Pinned" pill if it's pinned, and the sent date on the right
- the audience in muted text: "Everyone", "Youth Wellness", "Palmetto Elementary · 2 people", plus "· emailed" if it was emailed
- a teal read bar with "{read} of {n} read", counted from `inbox_reads`
- under it, "Not read yet: {first names}", or "Everyone has read it". Show up to 5 names, then "+{n} more".
- **Actions:**
  - **Edit:** opens it in the composer. Saving sets `edited_at`, and instructors see "Edited" on it. It doesn't re-notify anyone or reset read state.
  - **"Remind {n}":** sends the email only to people who haven't read it yet. Only once per announcement per day, and logged.
  - **Archive:** removes it from instructors' Inbox, after a confirm.

**Scheduled items:** show "Sends {date, time}", with Edit and "Send now".

**Drafts:** show "Last edited {time}", with Edit and Delete. Drafts are the only thing that can be deleted.

## 3. Instructor side (small changes)

- **Pinned announcements** (`pinned_until >= today`) sit at the top of Updates under a "PINNED" label, as a white card with a 4px navy left edge. They stay pinned even after being read. They drop back into the normal list after their date.
- **Edited announcements** show a small "Edited" next to the date.
- **Opening one** shows the full message in a bottom sheet: the title, "From {first name} · {date}", the message with line breaks kept, and a "Done" button. Opening it marks it read.

## 4. Sending and scheduling

- **`sendAnnouncement(id)`** (server action, admin only):
  - Sets `status = 'sent'` and `sent_at = now()`.
  - If email is on, sends `sendAnnouncementEmail` to each recipient and sets `emailed_at`.
  - It's safe to call twice, so a double click can't send twice.
- **Scheduled updates:** the existing daily cron route (`app/api/cron/payroll-reminders/route.js`) runs once a day, which is too coarse for scheduled announcements.
  - **Preferred:** add a separate `app/api/cron/announcements/route.js` with the same `CRON_SECRET` check, run every 15 minutes from `vercel.json`. It sends anything whose `send_at` has passed.
  - **If the Vercel plan doesn't allow that,** tell me. Then fall back to hourly, and say in the UI: "Scheduled updates go out within an hour of the time you pick."
- **Emails** use the existing helper:
  - Subject: the title.
  - Body: the message, plus a "Open the app" button to `/instructor/inbox`.
  - Never put another person's data in it.

## Copy and checks

- **Copy:** no em dashes in UI text or emails (en dashes in date ranges are fine). Use the copy above exactly.
- **Keyboard:** everything works with the keyboard. The People picker and date pickers have labels.

## When you're done

1. List the files you changed and the SQL to run.
2. Run `npm run build` and `npm run lint` and show me the results.
3. Give me a click-through:
   - use the "No class" template, pin it for 2 weeks, email it, send it to everyone: it shows pinned at the top of a test instructor's Updates
   - send one to just Palmetto: only those instructors get it
   - schedule one for 20 minutes out: it sends on time
   - edit a sent one: it shows "Edited", and nobody is re-notified
   - check the read counts, then "Remind" only the people who haven't read it
   - archive one: it disappears from instructors' Inboxes
   - delete a draft

Don't commit or push. I'll review first.
