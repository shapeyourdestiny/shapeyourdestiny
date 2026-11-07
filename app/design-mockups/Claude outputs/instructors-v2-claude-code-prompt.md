# Instructors v2: cleaner list and one profile page

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, server actions or route handlers.

## Goal

The admin Instructors section feels cluttered:
- The same person can be seen two ways: a slide-out drawer (`InstructorDrawer.jsx`) and a full page (`app/admin/instructors/[id]`), which show different information.
- The profile content sits in a narrow strip with empty space beside it.
- The "Admins only" note shows on every tab.
- The Notes tab filter chips wrap onto three rows.

Redesign it as **one list → one profile page**, with contact info visible at a glance on both.

**This is mostly layout.** Keep these as they are:
- the data, actions and permissions
- the notes system (`lib/instructor-notes`, `NotesHistory.jsx`, `AddNotePopup.jsx`)
- invite, archive and delete
- password reset

The design is on my canvas ("Instructors v2: list and profile, contact at a glance", four screens). Everything you need from it is written out below.
- **Colors:** use the navy/teal tokens in `app/globals.css`, with no orange or gold.
- **Look:** match Programs and Schedule Board v2. White cards with 16px radius, soft shadows and no borders, one solid navy primary button per screen, and ghost buttons for everything else.
- **Type and styling:** Baloo 2 headings, Nunito body text, CSS Modules.

## 0. Check first: am I in the list twice?

"Heather Swear" shows twice on the Instructors list: once with the Admin tag and my photo, once as a plain instructor with no photo. **Don't change any data.**
1. Find both `profiles` rows and tell me how they differ: `id`, `user_id`, `role`, `status`, `created_at`, which one has class assignments, notes, `session_changes` and invite codes.
2. Write a merge script, `supabase/migrations/merge-duplicate-heather.sql`, that I can review and run myself. It keeps the account I log in with (the one whose `user_id` matches auth), moves every reference from the other row to it, then archives the extra row. Don't delete it.

## 1. Instructors list (`app/admin/instructors`)

**Remove the drawer.** Clicking a row opens `/admin/instructors/[id]`.
- Before deleting `InstructorDrawer.jsx`, move anything that only exists there into the profile's **Edit info** popup: name, phone, email, programs, headshot and any staff-page fields still in use.
- Then delete the drawer and its CSS, and tell me what moved where.

**Header:**
- "Instructors" (Baloo 2, 32px), with a live subtitle under it: "{n} active · {n} teaching this week".
- On the right: a 280px search box, "Search name, school or phone". It matches name, phone digits, email and school.
- Then the solid navy "+ Add instructor" button, which opens the existing add flow.

**Status tabs:** a segmented control on a white track: **All · Active · Invited · Not invited · Archived**, each with a count. Active is selected by default. The selected tab is navy with white text.

**Table** (one white card). Columns:
1. **Instructor:**
   - A 38px avatar, using the headshot if there is one, otherwise initials on a navy/teal shade picked from the profile id.
   - The name in 15px bold, with a small "Admin" tag if `role = 'admin'`.
   - Under it, their programs in muted 13px text ("Wellness", "Soccer", "Wellness, Soccer").
2. **Contact:**
   - The phone formatted as `(832) 314-4803`, in 14px bold. When a row is hovered or keyboard-focused, small Call (`tel:`) and Text (`sms:`) icon buttons appear next to it. They mustn't also open the profile.
   - The email under it, in muted 13px text, cut off with an ellipsis if it's too long.
   - If there's no phone or email, show "No phone" or "No email" in light gray.
3. **Teaches at:** a comma list of the schools where they're a regular instructor on a current class, or "Not on a class yet" in light gray.
4. **Next class:** "Thu, Nov 12" with "2:45 pm · Shadow Hills" under it, or "Nothing scheduled" in light gray. Work out who's actually teaching with `getSessionStaff`, so subs and absences count.
5. **Status:** a pill. Active is green, Invited is light navy, Not invited is gray, Archived is gray and faded.

The whole row is a link. It shows a hover background `#F5F8FE`, and Enter opens it. Under the table, add the small line "Click anyone to open their profile. Hover a row to call or text."

**Phone formatting:** add `formatPhone()` in `lib/format.js` and use it everywhere a phone shows, including the instructor app. Store numbers as entered. Display US 10-digit numbers as `(xxx) xxx-xxxx`, and leave anything else as entered.

## 2. Profile page (`app/admin/instructors/[id]`)

Content can use the full width (max about 1180px). No more narrow column.

**Back link:** "‹ Instructors", navy, bold.

**Header card** (white, full width):
- **Top row:**
  - A 72px avatar (headshot or initials).
  - The name in Baloo 2, 30px.
  - Pills: the status (Active in green), "Admin" if they're an admin, and one per program (Wellness on light teal, Soccer on light navy).
  - On the right: an "Edit info" button (white with a light border) and a "⋯" button that opens a menu.
- **The "⋯" menu** (`role="menu"`, arrow keys, Escape to close). Each item has a bold label and a muted sub-line:
  - **Send password reset:** "Emails a link to {email}"
  - **Archive instructor:** "Takes them off scheduling and the staff page. Keeps their history." It asks for confirmation. For archived people this becomes **Restore**.
  - A divider, then **Delete instructor** in red. When it isn't allowed, it's faded and not clickable, with the sub-line "Not available. They have {n} sessions of history, so archive instead." Keep the existing delete rules.
- **Contact tiles:** three tiles side by side, each with a light tint background, a white icon square, a small uppercase label, a bold value and action buttons:
  - **Phone:** formatted, with Call and Text buttons.
  - **Email:** with Email (`mailto:`) and Copy buttons. Copy changes to "Copied" for 2 seconds.
  - **Joined:** "Oct 23, 2026". No buttons.
  - A missing phone or email shows "Add phone" or "Add email", which opens Edit info.

**Tabs** under the header card: **Overview · Schedule · Notes & history**. The selected tab gets a teal 3px underline, and keep `?tab=` in the URL as you do now. The **lock icon** sits only on the Notes & history tab label, with `aria-label` "Admins only". Remove the "Admins only. {name} never sees this tab." line from the tab row. It moves into the Notes tab (section 2c).

### 2a. Overview tab

Two columns: about 60% on the left and 40% on the right, stacking on narrow screens.

**Left column:**
- **"Coming up" card:**
  - A heading row with "Full schedule ›" on the right, which switches to the Schedule tab.
  - The next 3 sessions they're actually teaching. Each row has a date block (weekday in small caps over the day number in Baloo 2, 22px, on a light tint tile), the school name in bold, "{Program} · {District} · with {co-instructor}" or "teaching alone" in muted text, and the time on the right.
  - Include sessions where they're the sub, labelled "Subbing for {name}". Leave out the ones where they're out.
  - With nothing coming up: "Nothing scheduled."
- **"Teaches" card:** one row per current class where they're a regular instructor. Each row has a teal stripe on the left, the school name in bold, "{Program} · {Days} {time}" in muted text, and on the right "with {co-instructor}" or "Instructor 2 open".

**Right column:**
- **At-a-glance box:** a 2×2 grid of white cells with 1px gaps, each a big Baloo 2 number over a 13px label:
  - "Sessions taught": past sessions they actually taught, including ones they subbed.
  - "Coming up": the next 30 days.
  - "Days out this school year": from `session_changes`, Aug 1 to Jul 31.
  - "Pay per class": from the latest pay note or `instructor_pay_rates`. "Not set" in red if there's none.
- **"Can sub in" card:** district chips, each with its color dot, from `instructor_districts`, with an "Edit" link that uses the existing districts editor. Under them, in muted text: "Used to suggest subs on the Schedule Board."
  - If they have none: "No districts yet. Add some so they show up as a sub."
- **"Latest note" card:** the most recent non-archived note, showing its type tag, title, date and the first 2 lines of the body. "All notes ›" opens the Notes tab.
  - With no notes: "No notes yet." and a light "+ Add a note" button that opens the Notes tab with the add popup open.

Remove the old Overview layout: the three centered stat cards, the narrow Contact and Districts cards, and the "Account Actions" card. Those now live in the header and the "⋯" menu.

### 2b. Schedule tab

- **Top row:** an **Upcoming / Past** segmented control. Next to it, in muted text: "{n} sessions taught · {n} days out this school year".
- **Week cards:** one card per week, titled "This week", "Next week" or "Week of Nov 16", with the date range in muted text. Each row has the same date block, school, program and co-instructor, plus the time and a ghost "Mark out" button. "Mark out" opens the Schedule Board's Mark someone out popup for that session, so reuse that component.
- **Upcoming** shows the next 8 weeks. **Past** shows the school year so far, newest first.
- **Absent days:** a light red row reading "Out · {reason}", then "{sub} subbed" or "No sub".
- **Days they subbed:** a light teal row reading "Subbed for {name}".

### 2c. Notes & history tab

Keep the existing notes features. Only change the layout:
- **Top row:** on the left, a small muted line with a lock icon, "Only admins can see notes." On the right, the solid navy "+ Add note" button. It goes in the same row and should never wrap into the middle of the chips.
- **Filter chips:** one row that scrolls sideways if it has to, never wrapping. Always show "All". Show other types only when they have at least one note.
- **Summary column:** on the left as before, but only show cards that have something to say. Hide "Disciplinary" when there are none, and show Pay as "Not set" with an "Add pay change" link.
- **Empty state, when there are no notes and no attendance entries:** one centered white card containing:
  - a teal document icon in a light teal rounded square
  - "No notes for {first name} yet" (Baloo 2, 22px)
  - the line "Keep reviews, pay changes, training, disciplinary steps and anything else worth remembering in one place. Days out from the Schedule Board show up here on their own."
  - four quick-add pill buttons, Review, Pay change, Training and Disciplinary, each opening the add popup with that type picked

  Hide the summary column in the empty state.

## 3. Check it

- **Copy:** no em dashes in UI text (en dashes in date ranges are fine). Use the copy above exactly.
- **Narrow screens:** check at 1440px and at about 900px wide. The table can scroll sideways on small screens, and the profile columns stack.
- **Keyboard:**
  - Tab through a list row. Enter opens the profile, and the Call and Text buttons work without opening it.
  - The "⋯" menu works with the keyboard.
  - Every icon-only button has an `aria-label`.

## When you're done

1. Tell me what you found about the duplicate Heather, and give me the merge script to review.
2. List the files you changed and deleted, and what moved out of the drawer.
3. Run `npm run build` and `npm run lint` and show me the results.
4. Give me a click-through:
   - search by phone
   - switch the status tabs
   - call or text from a row
   - open a profile
   - copy an email
   - archive, then restore
   - try Delete on someone with history
   - each tab
   - Mark out from the Schedule tab
   - the Notes empty state's quick-add buttons

Don't commit or push. I'll review first.
