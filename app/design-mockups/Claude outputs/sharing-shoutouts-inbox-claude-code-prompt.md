# Sharing reviews, team shout-outs, and inboxes

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, server actions or route handlers.

## Goal

Four connected features. Build them **in this order**, run `npm run build` after each one, and fix anything broken before moving on:

1. **Sharing notes with instructors.** Admins can share a review, a recognition note or a disciplinary note with the instructor it's about. The instructor reads it in the app and acknowledges it, with an optional comment.
2. **Team shout-outs.** Instructors send a short thank-you to someone they've worked with. An admin approves it, and then the recipient sees it.
3. **Admin Inbox.** One page for everything waiting on an admin: shout-outs to approve, time off requests, and instructor replies and acknowledgments. Admins can also send announcements from here.
4. **Instructor Inbox.** A new tab in the instructor app with two tabs, **Updates** and **Shout-outs**.

The designs are on my canvas under "Sharing reviews with instructors" and "Team shout-outs and the admin Inbox". Everything you need from them is written out below.
- **Look:** navy/teal tokens from `app/globals.css`, with no orange or gold. White cards with soft shadows and no borders, one solid navy primary button per screen, and ghost buttons for everything else.
- **Type and styling:** Baloo 2 headings, Nunito body text, CSS Modules. The instructor app uses the floating bottom nav and bottom sheets that already exist.

**Privacy rules, which matter more than anything else here:**
- **Notes stay admin-only by default.** An instructor only ever sees a note an admin explicitly shared, only the fields listed below, and only their own.
- **Instructors never read `instructor_notes` directly.** They get shared notes through a database function that returns only the safe fields.
- **Senders never learn a shout-out was held back.** Their copy always just says it was sent.
- **Nothing is anonymous** and nothing is ranked. Never show instructors shout-out counts or leaderboards.

Check admin with the existing `verifyAdmin` pattern. Work out "who teaches what on a date" with `lib/schedule/session-staff.js` (`getSessionStaff`). Instructor-side data comes from the logged-in user's own profile (match `profiles.user_id`, or the legacy `profiles.id`).

Write one migration, `supabase/migrations/add-sharing-shoutouts-inbox.sql`. Make it idempotent, and tell me when to run it.

---

## 1. Sharing notes with instructors

### Database

Add columns to `instructor_notes`:
- `shared_at TIMESTAMPTZ`, `shared_by UUID`, `unshared_at TIMESTAMPTZ`
- `first_viewed_at TIMESTAMPTZ`
- `acknowledged_at TIMESTAMPTZ`
- `instructor_comment TEXT`, `instructor_commented_at TIMESTAMPTZ`

**Which notes can be shared:** only `review`, `recognition` and `disciplinary`. Enforce this with a CHECK constraint or a trigger.

**Function: `my_shared_notes()`** (`SECURITY DEFINER`, `search_path` set). It returns, for the calling instructor's own profile, notes where `shared_at IS NOT NULL` and `unshared_at IS NULL` and `archived_at IS NULL`. Return only these fields:
- id, type, title, note_date
- shared_at, first_viewed_at, acknowledged_at, instructor_comment
- **review:** `details.ratings`, `details.doing_well`, `details.work_on_next`, `details.next_review_date`
- **recognition:** `body`
- **disciplinary:** `details.step`, `details.about`, `details.what_happened`, `details.expectation`, `details.if_repeated`, `details.talked_on`

Never return the note `body` for reviews or disciplinary notes. Never return files, `also_present`, the author's internal fields or version history.

**Function: `acknowledge_shared_note(note_id, comment)`** (`SECURITY DEFINER`).
- It only works on a shared note about the caller. It sets `acknowledged_at` (and `instructor_comment` if given, max 500 characters).
- An acknowledgment can't be undone, and the comment can only be set once.
- Opening a note also sets `first_viewed_at` if it's empty. Use a small `mark_shared_note_viewed(note_id)` function.

**Review in the SQL that** an instructor has no select policy on `instructor_notes`, `instructor_note_versions` or `instructor_note_files`.

### Admin side (the Notes & history timeline)

On review, recognition and disciplinary notes, add a sharing strip at the bottom of the card:
- **A switch** (`role="switch"`) labelled "Share with {first name}", or "Shared with {first name}" when it's on.
- **When off,** a muted status line:
  - Most notes: "Private. Only admins can see this."
  - Disciplinary notes: "Private. Share it so {first name} can acknowledge it in the app."
- **When on,** the strip turns light teal (`#E8F4F6`) and shows the status:
  - "Shared {date} · not opened yet", in amber `#8A4A12`.
  - "Shared {date} · {first name} read it {date}", in teal-dark.
  - For disciplinary notes: "Shared {date} · {first name} acknowledged {date}".
- **If they commented,** show a reply bubble under the strip: their avatar, then "{First name}: {comment}" on a white rounded bubble.
- **Turning sharing off** asks for confirmation ("{First name} won't see this anymore. Their acknowledgment and comment are kept.") and sets `unshared_at`. Turning it back on clears `unshared_at`.

**In the Add note popup,** for those three types only, add a checkbox in the footer: "Share with {first name} after saving".

**When a note is shared,** send a short email with the existing email helpers:
- Subject: "You have a new {review / note} from Shape Your Destiny"
- Body: one line and a button to `/instructor/inbox`.
- **Never put the content in the email.**

### Instructor side (their profile page, from the avatar)

Add two sections to `/instructor/profile`, under the existing profile card:

- **Needs acknowledgment banner** (only if there's an unacknowledged disciplinary note): a card with a 2px `#F3C1BC` border on a `#FDF6F5` background, with a red dot, "Please read and acknowledge", "{Step label} · {date}" and a chevron. It opens that note.
- **"Shout-outs" section:** approved shout-outs from section 2, plus shared recognition notes, newest first, showing the 3 latest with "See all ›" (which opens the Inbox on the Shout-outs tab). Each card:
  - a soft teal gradient background
  - a small teal star tile
  - the title: "A parent wrote in" for a shared recognition note's title, or "From {first name}" for a teammate
  - the date on the right
  - the message
  - under it, "From {first name}", plus the tag if there is one
- **"My reviews" section:**
  - Each shared review is a card with:
    - the title and a "Read" or "New" pill
    - a 2×2 grid of the four ratings, each as a 5-segment teal bar
    - "{date} · with {admin first name}"
    - "Open ›"
  - Under the cards, a light navy info strip: "Next review around {next_review_date}".
  - At the bottom, the muted line: "Only things {admin first name} shares with you show up here."

**Opening a shared note** brings up a bottom sheet with a grab handle, the type pill, the title and the date line.
- **Review:**
  - The four ratings, each with a label, a word on the right and a wide 5-segment bar. The words are 5 Excellent, 4 Strong, 3 Getting there, 1–2 Needs work.
  - Then "DOING WELL" and "WORK ON NEXT", each a small uppercase heading with 16px text under it.
  - Then the next review strip.
- **Disciplinary:**
  - A `#FDF6F5` box with "WHAT HAPPENED", "WHAT WE EXPECT" and "IF IT HAPPENS AGAIN".
  - Under it, the line "Acknowledging means you've read this. It doesn't mean you agree. You can add your side below, and {admin first name} will see it."
- **Recognition:** just the message.
- **If it isn't acknowledged yet** (reviews and disciplinary notes), show an optional comment box:
  - Reviews: label "Anything you want to say", placeholder "Thanks, a question, or what you'll work on".
  - Disciplinary: label "Anything you want to add", placeholder "Your side, or what you'll do differently".
  - Then a big navy button: "Got it" for reviews, "I've read this" for disciplinary notes.
- **Once acknowledged,** show a green box: "You read this {date}" / "You acknowledged this {date}", then "You said: “{comment}”" if they commented.
- **Recognition notes** count as read as soon as they're opened, with no button.

---

## 2. Team shout-outs

### Database

```sql
CREATE TABLE IF NOT EXISTS shout_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag TEXT CHECK (tag IN ('saved_the_day','great_with_kids','team_player','made_it_fun','super_prepared')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 300),
  approved_message TEXT,                     -- admin's edited version, if changed
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','held')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  context_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  context_date DATE,
  context_session_change_id UUID REFERENCES session_changes(id) ON DELETE SET NULL,
  recognition_note_id UUID REFERENCES instructor_notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (from_profile_id <> to_profile_id)
);

CREATE TABLE IF NOT EXISTS shout_out_nudge_dismissals (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_change_id UUID NOT NULL REFERENCES session_changes(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, session_change_id)
);
```

**RLS:**
- **Admins:** all access.
- **Instructors:** no direct select on `shout_outs`. Use these functions instead:
  - `my_sent_shout_outs()` returns id, to name, tag, message, created_at, and a `status` that is always `'sent'`. Never expose `held` or `pending`.
  - `my_received_shout_outs()` returns approved ones only, with `approved_message` (or `message` if that's empty), tag, the sender's first name and avatar, `reviewed_at`.
- **Inserts** go through a server action only, never straight from the client.

### Who an instructor can send to

`getShoutOutRecipients(profileId)` returns people they taught a session with (either regular or sub), or who subbed for them or they subbed for, in the last 45 days. Use `getSessionStaff` over past sessions. Exclude themselves and archived people. If the list is empty, the send option doesn't appear.

### Server actions (`lib/shout-outs/actions.js`)

- **`sendShoutOut({ toProfileId, tag, message, contextClassId?, contextDate?, contextSessionChangeId? })`:**
  - Check that the recipient is in `getShoutOutRecipients`, then trim and validate the message.
  - Limit each sender to 5 shout-outs a day.
  - Status starts as `pending`.
- **`dismissShoutOutNudge(sessionChangeId)`**
- **Admin only:**
  - **`approveShoutOut(id, { editedMessage?, saveToNotes })`:** set `approved`. If `saveToNotes` is on, create an `instructor_notes` row for the recipient with type `recognition`, title "Shout-out from {sender first name}", body = the approved message, and `details = { from_profile_id, tag, shout_out_id }`. Mark it shared, so it also shows in their Shout-outs, then link `recognition_note_id`. Don't show it twice in the recipient's list.
  - **`holdShoutOut(id)`:** set `held`. Don't notify anyone.

### Instructor app

- **Nudge card at the top of My Schedule,** shown when someone subbed for them in the last 7 days, they haven't sent that person a shout-out for that day, and they haven't dismissed it.
  - The card: soft teal gradient, the sub's avatar, "{Sub first name} covered your {School} class", with "{Day, Mon D} · want to thank her?" under it. Write "thank them?" if you can't be sure of pronouns, and keep it neutral by default.
  - Buttons: a solid navy "Send a shout-out" and a ghost "Not now", which dismisses it.
  - Show at most one nudge at a time.
- **Class card and class details sheet:** under "Teaching with", add a link, "Send {first name} a shout-out ›", when that person is a valid recipient.
- **Compose sheet** (a bottom sheet):
  - The recipient's avatar, then "Shout-out for {first name}", with "Say thanks or tell them what they did great." under it, and a close button.
  - "Pick one (optional)": pill radios for Saved the day, Great with the kids, Team player, Made it fun, Super prepared. Tapping the selected one clears it.
  - "Your note": a textarea with a live "{n} / 300" counter.
  - A big navy "Send shout-out" button, disabled until there's text.
- **Sent screen:** a teal star in a light teal circle, "Shout-out sent", and a light "Done" button. **Don't mention approval anywhere on the instructor side.**

---

## 3. Admin Inbox (`/admin/inbox`)

### Sidebar

Add **Inbox** as the first item in `NAV_OPERATIONS`, with an inbox-tray icon and a teal count badge. The count is the number of open inbox items. Load it in `app/admin/layout.jsx` the way `incidentCount` is loaded, inside a try/catch.

### Data

`lib/inbox/admin.js` builds the open items:
- **Shout-outs:** status `pending`.
- **Time off:** `time_off_requests` with status `pending` (from `add-time-off.sql`).
- **Replies:** notes with an `acknowledged_at` or `instructor_comment` that an admin hasn't marked done yet.

Add a table `admin_inbox_done (item_type TEXT, item_id UUID, done_by UUID, done_at TIMESTAMPTZ, PRIMARY KEY (item_type, item_id))` for marking replies done. Shout-outs and time off leave the Inbox when they're decided.

### Layout

**Header:**
- "Inbox" (Baloo 2, 32px), with "{n} things waiting on you · {n} shout-outs to approve" under it.
- On the right: a navy "+ Announcement" button (section 3b).

**Segmented control:** All · Shout-outs · Time off · Replies, each with a count.

**Two columns:**
- **Left, 420px, the list.** A white card headed "NEEDS YOU". Each item has:
  - a type tile: a teal star for shout-outs, an amber calendar for time off, a navy speech bubble for replies
  - a title ("Alexis → Leila", "Jordan Ellis · Thu, Jan 14", "Jordan replied to a review"), with the time on the right
  - a one-line preview
  - a small type pill

  The selected item gets a 4px teal left edge and a light background. At the bottom: "Done items move to History", where History is a link to a filtered list of decided and done items from the last 90 days.
- **Right, the detail panel** (white card):
  - **Shout-out:**
    - A "Shout-out to approve" pill and "Sent {date, time}".
    - **From → To:** two avatars with names and an arrow between them.
    - The tag pill, plus context when there is any: "Leila subbed at Palmetto on Wed, Nov 4".
    - An editable "Message" textarea, hinted "(you can fix typos before sharing)".
    - A light teal "{FIRST NAME} WILL SEE" preview that updates live: the quoted message, then "From {first name} · {tag}".
    - A checkbox, on by default: "Also save to {first name}'s notes as Recognition".
    - Buttons: a ghost "Don't share", and a navy "Approve and send".
    - The muted note: "If you don't share it, {sender} just sees 'Sent'. Nobody gets told it was held back."
  - **Time off:** a pill, "{Name} · {dates}" as the title, "{Reason} · logged from a text on {date} · {notice} notice", a box listing the affected classes and whether they'll need a sub, then Decline and Approve. Reuse the time off actions that already exist.
  - **Reply:** a pill, "{Name} read their {review title}" or "{Name} acknowledged a {step}", their comment in a reply bubble, then "Open note" (to their profile's Notes tab) and a navy "Mark done".
  - **Nothing selected or nothing open:** "You're all caught up."

### 3b. Announcements

```sql
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 1000),
  audience JSONB NOT NULL,     -- {"type":"all"} | {"type":"program","program":"wellness"} | {"type":"school","school_ids":[...]}
  send_email BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);
```

- **Who can read them:** admins have all access. Instructors read announcements through `my_announcements()`, which only returns ones whose audience includes them. That means all, their program, or a school where they're a regular instructor on a current class.
- **"+ Announcement" popup** (640px):
  - "Title", and "Message" with a 1000-character counter.
  - "Send to": a segmented control of Everyone / A program / Specific schools. The last two show a select or a school checklist.
  - A live "{n} instructors will get this" count.
  - A "Also email it" checkbox.
  - Cancel and a navy Send.
  - The email uses the existing helpers, with the title as the subject, the message, and a button to the Inbox.
- **History:** sent announcements show in the Inbox History with their audience and read count ("6 of 8 read").

---

## 4. Instructor Inbox (`/instructor/inbox`)

### Nav

The floating bottom nav becomes **Schedule · Inbox · Forms**, with Inbox using an inbox-tray icon. Inbox gets a red badge (white text, 2px ring the color of the nav) with the number of **unread Updates only**. Shout-outs never count toward it. Add it to the desktop sidebar too.

### Read state

`inbox_reads (profile_id UUID, item_type TEXT, item_id TEXT, read_at TIMESTAMPTZ, PRIMARY KEY (profile_id, item_type, item_id))`. RLS: instructors read and insert their own rows only. An item is read once it's opened, or after "Mark all read".

### Items (`lib/inbox/instructor.js`)

**Updates tab:**
- **"Needs you"** (always pinned at the top, and never cleared by "Mark all read"): shared disciplinary notes that haven't been acknowledged.
  - Red alert tile, "Please read and acknowledge", "{Step} from {admin first name} · {date}", and a red "Needs you" pill.
- **Subbing:** any session where they're the sub with a date of today or later, created or changed in the last 14 days.
  - Teal swap tile, "You're covering {School}", "{Day, Mon D} · {time} · for {first name}. Directions and school notes are in the class.", and a "See class" pill that opens the class details sheet for that date.
- **Time off:** requests that were approved or declined in the last 60 days.
  - "Time off approved" (green calendar tile) or "Time off not approved" (gray), plus the dates and "{n} classes affected" or "No classes affected".
- **Shared reviews:** "Your {title} is ready", "Tap to read and reply.", and a pill: "New", or "Read" in green.
- **Announcements:** a navy send tile, "From {admin first name}: {title}" and the first line of the message.

**Shout-outs tab:** approved shout-outs to them, with the sender's avatar, "Shout-out from {first name}", the quoted message (2 lines max) and the tag pill. Plus shared recognition notes, with a teal star tile and their title.

### Layout

- **Header:** "Inbox" (Baloo 2, 32px), with "{n} new updates" or "All caught up" under it. "Mark all read" on the right marks the current tab.
- **Two-tab segmented control on a white track: Updates · Shout-outs.** It opens on Updates. Each tab has its own unread count: red for Updates, light teal for Shout-outs, hidden at 0.
- **Groups:** "NEEDS YOU" (Updates only), "NEW" (unread) and "EARLIER" (read). Each group is one white rounded card with rows split by thin lines.
- **Unread rows:** a teal dot on the left, a bold title and a faint background.
- **Tapping a row** opens the right thing: the shared note sheet, the class details sheet, or the full shout-out in a small sheet.
- **Empty states:**
  - Updates: "Nothing new. Schedule changes and notes from the office show up here."
  - Shout-outs: "No shout-outs yet. When a teammate thanks you, it shows up here."
- **Ordering and paging:** sort by date, newest first. Show 50 items, then "Show older".

---

## Copy and checks

- **Copy:** no em dashes in any UI text or emails (en dashes in date ranges are fine). Use the copy above exactly. Use first names in instructor-facing text.
- **Accessibility:**
  - Every icon-only button has an `aria-label`.
  - Sheets and popups trap focus and close with Escape.
  - Switches use `role="switch"`.
  - Instructor app tap targets are at least 44px.

## When you're done

1. List the files you changed and all the SQL to run, in order.
2. Run `npm run build` and `npm run lint` and show me the results.
3. **Privacy checks.** Give me exact SQL I can run while signed in as an instructor test user, to show that:
   - they can't select from `instructor_notes`
   - `my_shared_notes()` returns only shared notes about them, without bodies for reviews or disciplinary notes
   - they can't see pending or held shout-outs, or anyone else's
4. Give me a click-through:
   - share a review, and as the instructor read it and comment: the admin sees "read" and the comment, and a Reply appears in the admin Inbox
   - share a written warning, and as the instructor acknowledge it with a comment
   - unshare a note
   - mark someone out with a sub, and as the absent instructor see the nudge, send a shout-out and see "Shout-out sent"
   - as an admin, edit a typo and approve: the recipient sees it in Shout-outs and on their profile, and it's saved to their notes
   - hold one: the sender still just sees it as sent
   - approve a time off request from the Inbox
   - send an announcement to one program: only those instructors see it
   - check that the Inbox badge only counts Updates

Don't commit or push. I'll review first.
