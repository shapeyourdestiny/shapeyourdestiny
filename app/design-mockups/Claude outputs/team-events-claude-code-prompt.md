# Team events on the Schedule Board, plus a Directions button

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, server actions or emails.

## Goal

Admins can add team events from the **Schedule Board** (there's no separate page, since we won't have many events). The events show up on everyone's schedule and calendar:
- **Team training:** paid
- **Team meeting:** paid
- **Party or social:** not paid

Paid events count in payroll for the people who attended.

**Also:** add a **Directions** button to every class and event that has an address. It opens the instructor's maps app of choice (section 4b).

The design is on my canvas: "Team events on the Schedule Board + directions button". There are 6 boards:
- Schedule Board with an event
- Event opened
- New event (paid)
- New event (party)
- Instructor Schedule
- Directions

**Style:** navy/teal tokens, Baloo 2 and Nunito, CSS Modules. Instructor screens use 44px tap targets.

**Reuse:**
- `verifyAdmin`
- Resend helpers
- the calendar feed (`calendar_feeds`)
- the Inbox (Updates)
- `getPeriodSessions`, the single source of truth for payroll counts
- pay rate lookup: the latest pay note `effective_date` on or before the event date, falling back to `instructor_pay_rates`

## 1. Database

Write `supabase/migrations/add-team-events.sql`. Make it idempotent, and tell me when to run it.

```sql
CREATE TABLE IF NOT EXISTS team_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('training','meeting','social')),
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,                       -- address or video link
  details TEXT,
  paid BOOLEAN NOT NULL,               -- true for training/meeting, false for social
  pay_classes NUMERIC(4,1),            -- "paid as N classes"; null when unpaid
  required BOOLEAN NOT NULL DEFAULT true,
  audience JSONB NOT NULL DEFAULT '{"type":"all"}',  -- or {"type":"people","profile_ids":[...]}
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS team_event_people (
  event_id UUID NOT NULL REFERENCES team_events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  rsvp TEXT CHECK (rsvp IN ('yes','no')),   -- null = hasn't said
  rsvp_reason TEXT,                          -- admins only
  attended BOOLEAN,                          -- set by admin after the event; null = not marked
  PRIMARY KEY (event_id, profile_id)
);
```

**Type rules:**
- `training` and `meeting` always have `paid = true` and a `pay_classes` of 1 or more. Default it to the event length in hours, rounded to the nearest half, and the admin can change it.
- `social` always has `paid = false`, `pay_classes = null` and `required = false`.

Check these on the server.

**RLS:**
- Admins have full access.
- Instructors can read events they're invited to, and only their own `team_event_people` row.
- Instructors can update only `rsvp` and `rsvp_reason` on their own row, and only before the event starts.
- Instructors never see other people's reasons or attendance.

## 2. Schedule Board (admin)

**No new sidebar item.** If a "Team Events" page or sidebar item was already started, remove it.

**Header:** add a ghost **"+ Team event"** button between "Mark someone out" and "+ Add class". It opens the New event window (section 3).

**Summary bar:** when the week has an event, add a chip, for example "Team meeting Fri".

**Event banner in its day column,** above that day's classes:
- **Look:** a tinted card with a 4px left edge in the type color.

  | Type | Color |
  |---|---|
  | Meeting | navy |
  | Training | teal |
  | Social | amber |

- **Label:** the type in small caps ("TEAM MEETING"), with a pay pill on the right: green "Paid" or gray "Not paid".
- **Title,** then "{start} – {end} · {location}".
- **Count line:**
  - required events: "{n} coming · {n} can't"
  - socials: "{n} going"
- **Days off:** an event can sit on a day with no classes (like a Saturday training). Show that day column when it has an event, the same way Saturdays show only when something is scheduled.

**Clicking a banner** opens a centered **event window**:
- **Header:**
  - a type icon tile
  - "Team meeting · Required" and "Paid as {n} classes"
  - the title
  - "{Day, Mon D} · {start} – {end} · {location}"
  - a close button
- **Counts:** "{n} coming · {n} can't make it · {n} hasn't answered".
- **People list,** one row per person:
  - avatar and name
  - their reason under the name, if they gave one (admins only)
  - a status pill: Coming (green), Can't make it (amber), No answer (gray)
- **Footer:** "Cancel event" (red text), **Duplicate** (opens New event prefilled, with the date cleared), **Edit**.
- **Past paid events:** the footer also shows **"Mark who attended"** (section 5). Once it's saved, the banner shows "{n} attended · in payroll".

**Finding past events:** go back through weeks on the board. Payroll links straight to any event that still needs attendance marked.

## 3. New event window

A centered modal, same style as Add school.

**Type cards** (3 across):
- **Team training:** "Paid"
- **Team meeting:** "Paid"
- **Party or social:** "Not paid"

The selected card has a navy border.

**Fields:**
- **Title:** prefilled by type, and editable. Training: "Team training". Meeting: "Team meeting". Social: "Team get-together".
- **Date, Starts, Ends.** End time must be after start time. Date can't be in the past.
- **Where:** "Address or Zoom link".

**Pay box:**
- **Training and meetings:** a green box with:
  - "Paid as" and a − / + stepper: "2 classes" (half steps allowed)
  - Under it: "Uses each person's class rate. Only people marked as attended get paid."
- **Socials:** a gray box: "Not paid. Instructors can say if they're coming."

**Who:**
- "Everyone ({n} instructors)", meaning active instructors.
- or "Pick people", a searchable multi-select.

**Attendance:**
- **Training and meetings:** Required by default, or Optional.
- **Socials:** "Optional, ask who's coming" by default, or Required.

**Details:** optional, 1000 characters.

**Footer:**
- "Everyone gets an email and an Inbox update. It goes on their calendar if sync is on."
- Cancel
- **"Add to everyone's schedule"**, or "Add to {n} people's schedules" when picking people.

## 4. What instructors get

**Email,** sent right away when the event is created:
- **Subject:** "{Title} on {Day, Mon D}"
- **Text:**
  - "{Type label} · {Day, Mon D}, {start} – {end} · {location}"
  - the details
  - "Paid as {n} classes" for paid events, or nothing for socials
  - "Please let us know if you can't make it" for required events, or "Let us know if you're coming" for optional ones
- **Button:** "Open in the app", which goes to Schedule on that day.

**Inbox:** an Updates item (Inbox v3 style) with a calendar or people icon, and the same info.

**Schedule:** the event shows on its day, mixed in with classes by time, as its own card:
- **Left edge:** navy for meetings, teal for training, amber for socials.
- **Icon tile** to match.
- **Label:** "Team meeting · Required", "Team training · Required" or "Team social · Not paid".
- **Paid events:** a green "Paid" pill.
- **Card text:** the title, "{start} – {end} · {location}", and the details.
- **RSVP buttons:**
  - **Required events:** "I'll be there" / "Can't make it". Picking "Can't make it" shows "Let us know why (only admins see this)". The reason is required for required events.
  - **Optional events:** "Going" / "Can't go".
  - They can change their answer until the event starts.
- **Answers go to admins:** a "Can't make it" on a required event creates an admin Inbox item: "{name} can't make it to {title} on {date}: {reason}".

## 4b. Directions button (classes and events)

**Where it shows:** a **Directions** button on any class card or event card that has a physical address. This includes Schedule, the Inbox items for events, and the class assignment cards.
- If the location is a video link (Zoom, Google Meet), show a **Join** button instead. It opens the link.
- If there's no address, show no button.

**Picking a maps app:**
- **The first tap** opens a small centered window:
  - "Open directions with"
  - the place name
  - three buttons: **Apple Maps**, **Google Maps**, **Waze**
  - a "Remember my choice" checkbox, checked by default
  - "You can change this anytime in your profile."
- **Saving the choice:** store it on their profile in a `maps_app` column (`apple`, `google`, `waze` or null). Add it to the migration. Add a "Directions open in" setting to the instructor profile or settings page.
- **After that,** taps go straight to their app.

**Links:** URL-encode the full address.
- **Apple Maps:** `https://maps.apple.com/?daddr={address}`
- **Google Maps:** `https://www.google.com/maps/dir/?api=1&destination={address}`. This opens the app if it's installed, or the browser if not.
- **Waze:** `https://waze.com/ul?q={address}&navigate=yes`
- **Android:** don't offer Apple Maps. Show only Google Maps and Waze.

**Addresses:**
- Classes use the school's address field. If schools don't have a full address stored yet, tell me which ones are missing, and add an address field to the Add/Edit school window if there isn't one.
- Events use their Where field. If the Where text isn't a link, treat it as an address.

**Calendar feed:** add the event to the existing feed for everyone invited, same as classes.
- **UID:** a stable one, like `event-{id}@shapeyourdestiny`.
- **Title:** "Team meeting: {title}", "Team training: {title}" or "Team social: {title}".
- **Location** and details go in the event.
- **Edits:** keep the same UID and bump the sequence number.
- **Cancelled:** keep it in the feed as cancelled, or remove it. Pick the option that clears it from Google and Apple most reliably, and tell me which.

**Edits and cancelling:**
- **Changing the date, time or place:** send a short "Updated: {title}" email and Inbox item. Show "Edited" on the card.
- **Cancelling:** send "Cancelled: {title} on {date}". The card shows a gray "Cancelled" pill for 7 days, then disappears.
- **Other edits** (details, title wording): no email.

**Past classes:** attended paid events show in the list as a class-style card: "Team training · Paid". There are no notes or thank-you buttons on these.

## 5. Payroll

- **Who gets paid:** only people with `attended = true` on a paid event. RSVP alone doesn't count.
- **Marking attendance:**
  - "Mark who attended" opens a checklist of everyone invited.
  - It's pre-checked for anyone who said "I'll be there" or didn't answer.
  - It's unchecked for anyone who said "Can't make it".
  - Admins can adjust it, then click "Save attendance".
- **Counting:**
  - In `getPeriodSessions` (or right next to it, so there's still one source of truth), add attended paid events as session lines with `pay_classes` as their class count.
  - Use the person's class rate on the event date.
  - Label each line "Team training: {title}" or "Team meeting: {title}".
  - They fall into the pay period the event date falls in.
- **Payroll page and class check:**
  - These lines appear in the person's drawer and totals. They count toward "Classes" as a separate part: "+ 2 for team training".
  - Instructors see them in their class check, where they can flag them if wrong.
- **Not marked yet:**
  - If a paid event in the period still has unmarked attendance, add a **blocker** to the Payroll "Before you approve" checklist: "Mark attendance for {title}". It includes a link.
  - Approval is blocked until it's done.
- **Socials** never touch payroll.

## Copy and checks

- **Copy:** no em dashes (en dashes in time ranges are fine). Use the copy above exactly.
- **Accessibility:** type cards and RSVP buttons are `aria-pressed` buttons in labelled groups. The modal traps focus.
- **Phones:** instructor cards work at 390px.

## When you're done

1. List the files you changed and the SQL to run.
2. Run `npm run build`, `npm run lint` and `node scripts/check-payroll-dates.mjs`, and show me the results.
3. Give me a click-through:
   - Create a 2-hour training for everyone. Pay defaults to 2 classes. Everyone gets the email and the Inbox item, it shows on Schedule, and with calendar sync on it's in the feed.
   - An instructor taps "Can't make it" with a reason. The admin Inbox item shows up. Another instructor can't see that reason.
   - Create a holiday party. It's "Not paid" and has Going / Can't go buttons, and the admin row shows the counts.
   - After the training, "Mark who attended" is pre-checked correctly. Save it. Payroll shows "Team training: Winter lesson training" lines at each person's rate, and people who didn't attend aren't paid.
   - Unmarked attendance blocks payroll approval with a clear reason.
   - Edit the time: people get the updated email, and the calendar updates instead of showing a duplicate. Cancel: they get the cancelled email, and it's gone from calendars.
   - The party never shows up in payroll.
   - The Schedule Board shows the event banner on its day, including a Saturday with no classes. Clicking it opens the event window with people and reasons. Duplicate works.
   - On a phone, Directions on a class asks for a maps app the first time, then opens straight away. Changing the setting in the profile works. A Zoom event shows Join instead.

Don't commit or push. I'll review first.
