# Instructor calendar sync (Google, Apple, Outlook)

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing route handlers.

## Goal

Let instructors opt in to having all their classes in their own calendar app. It's a **private, auto-updating calendar feed (iCalendar / .ics subscription)** per instructor:
- **Subscribing:** one tap subscribes Google Calendar, Apple Calendar or Outlook.
- **Staying current:** after that, classes stay up to date on their own. Classes they sub get added, and days off and holidays drop off.

No Google or Microsoft account connection, no OAuth, no new packages unless they're needed for the ICS text. A small hand-written ICS builder is fine.

The design is on my canvas ("Instructor app: classes in your calendar", two phone screens). Everything you need is written out below.
- **Look:** navy/teal tokens from `app/globals.css`, Baloo 2 headings, Nunito body text, CSS Modules.
- **Instructor app:** the floating nav and bottom sheets.

**Reuse:**
- **Who teaches what on each date:** `lib/schedule/session-staff.js` (`getSessionStaff`), plus the occurrence logic in `lib/schedule/occurrences.js` and `sessions.js`. That covers holidays, AM/PM partial holidays, program days off, `end_date` and ongoing classes. **Don't add new date logic.**
- **Class times:** `classes.time`, `end_time` and `hours_per_day`.
- **School details:** `schools.address`, `instructions`, `office_contact` and `office_phone`.

## 1. Database

Write `supabase/migrations/add-calendar-feeds.sql`. Make it idempotent, and tell me when to run it.

```sql
CREATE TABLE IF NOT EXISTS calendar_feeds (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,            -- 32+ random bytes, base64url
  enabled BOOLEAN NOT NULL DEFAULT true,
  calendar_app TEXT,                     -- 'apple' | 'google' | 'outlook' | 'other', for display only
  created_at TIMESTAMPTZ DEFAULT now(),
  rotated_at TIMESTAMPTZ,
  last_fetched_at TIMESTAMPTZ
);
```

**RLS:**
- **Instructors** can select, insert and update only their own row.
- **Admins** can select any row, but they never see the token in the UI.
- **The feed route** reads tokens server-side with the admin client.

## 2. The feed route

`app/api/calendar/[token]/route.js` (GET). The `.ics` extension is optional, so `/api/calendar/{token}.ics` should also work.

**Rejecting bad requests:**
- Look up the token. If it's missing, disabled, or the profile is archived, return `404` with no detail.
- Compare tokens in constant time.

**Building the feed:**
- Build their sessions from **30 days ago to 120 days ahead**, from `getSessionStaff`:
  - sessions they actually teach, as a regular instructor or a one-day fill
  - sessions they **sub**
  - **not** sessions where they're marked out
  - **not** holidays or program days off that cancel the class
- Return `text/calendar; charset=utf-8` with `Cache-Control: private, max-age=900`. Set `last_fetched_at`, at most once an hour to avoid write spam.

**Calendar settings:**
- `X-WR-CALNAME:Shape Your Destiny classes`
- `X-WR-TIMEZONE:America/Los_Angeles`
- `REFRESH-INTERVAL;VALUE=DURATION:PT1H`
- `X-PUBLISHED-TTL:PT1H`
- A `VTIMEZONE` for America/Los_Angeles

**Each event (`VEVENT`)** is one per session, not a repeating event, so subs, absences and holidays are always exact:
- **`UID`:** `{class_id}-{YYYYMMDD}@shapeyourdestiny.co`. It must be stable, so updates replace the event instead of duplicating it.
- **`DTSTART` / `DTEND`:** local time with `TZID=America/Los_Angeles`. The end comes from `end_time`. If there's no end time, use start + `hours_per_day` hours, or 1 hour.
- **`SUMMARY`:** "{Program} · {School}", like "Wellness · Palmetto Elementary". If they're subbing: "Sub: {Program} · {School}".
- **`LOCATION`:** the school's full address (or the school name if there's no address).
- **`DESCRIPTION`** (plain text, with lines joined by `\n`):
  - "Teaching with {name}", or "Teaching alone". If they're subbing: "Covering for {first name}".
  - The school's arrival instructions as numbered lines, if there are any.
  - "Front office: {contact} {phone}", only including whichever parts exist.
  - "Open in the app: {site}/instructor/dashboard".
  - **Never include** absence reasons, notes or anything admin-only.
- **`STATUS:CONFIRMED`** and **`TRANSP:OPAQUE`**.
- **`LAST-MODIFIED` / `DTSTAMP`:** now.
- **No alarms by default.** Instructors can set their own reminders in their calendar app.

Escape text correctly (commas, semicolons, backslashes, new lines) and fold lines at 75 octets. Add a small unit check in `scripts/check-ics.mjs` that builds a sample feed and validates the folding and escaping, so I can run it with `node`.

## 3. Instructor UI

### Settings: "Add classes to my calendar" card

Put it on the instructor profile/settings page (`/instructor/profile`), at the top. It's a white card with a calendar-check icon tile, the title **"Add classes to my calendar"**, a description, and a switch (`role="switch"`) on the right.

**When it's off:**
- **Description:** "Turn on to put every class in Google, Apple or Outlook. Subs and changes update on their own."
- **Turning the switch on:** create the feed row if there isn't one, with a fresh token. Then open the **"Which calendar do you use?"** sheet.

**When it's on:**
- **Description:** "Your classes show up in your calendar and stay up to date."
- **Status:** a light green line with a green dot, "Added to {Apple Calendar / Google Calendar / Outlook / your calendar}".
- **Three checkmark lines:**
  - "✓ Classes you teach and sub"
  - "✓ Address, time and who you're with"
  - "✓ Days off and holidays drop off on their own"
- **Buttons:**
  - **"Add to another calendar"** reopens the sheet.
  - **"Reset link"** is a ghost button. It confirms first: "Your old calendar link stops working. You'll need to add it again." Then it rotates the token, sets `rotated_at`, and reopens the sheet.
- **Small muted note:** "Google can take up to a day to show changes. Last-minute changes always show in the app first."
- **Turning the switch off:** set `enabled = false`, so the feed returns 404. Confirm first: "Classes will stop updating in your calendar. You can remove the calendar there too." Turning it back on reuses the token unless it was reset.

### "Which calendar do you use?" sheet

A bottom sheet with a grab handle. Title "Which calendar do you use?", then "Pick one. Your classes stay up to date on their own." Four rows, each 60px tall with a letter tile, a name, a sub-line and a chevron:

1. **Apple Calendar** ("iPhone, iPad and Mac") opens `webcal://{host}/api/calendar/{token}.ics`. On iOS and macOS this asks to subscribe.
2. **Google Calendar** ("Opens Google in your browser") opens `https://calendar.google.com/calendar/r?cid=` + `encodeURIComponent('webcal://{host}/api/calendar/{token}.ics')` in a new tab.
   - Under it, add the small line "If it doesn't open, copy the link and add it in Google under Other calendars → From URL."
3. **Outlook** ("Outlook.com or Microsoft 365") opens `https://outlook.live.com/calendar/0/addfromweb?url=` + `encodeURIComponent('https://{host}/api/calendar/{token}.ics')` + `&name=` + `encodeURIComponent('Shape Your Destiny classes')`.
4. **Something else** ("Copy your private calendar link") copies `https://{host}/api/calendar/{token}.ics` and shows "Copied. Paste it into your calendar app as a subscription." for 3 seconds.

Tapping a row saves `calendar_app`, opens the link and closes the sheet. Use the site's real host (`NEXT_PUBLIC_SITE_URL`, or the request host).

### Small entry point on My Schedule

If they haven't turned it on, show a slim, dismissible teal row under the next-class card: "Put your classes in your calendar ›". It opens the settings card with the sheet. Dismissing it is remembered in `localStorage` (inside a try/catch). Never show it again once they've turned sync on.

## 4. Admin

On the instructor profile's Overview tab, add a small muted line: "Calendar sync: on (Google)" or "off". Never show the link or token to admins.

## 5. Privacy and safety

- **Treat the token like a password.**
  - Never log it, and never send it to analytics.
  - Never put it in emails.
  - The UI only builds links from it in the instructor's own session.
- **Keep the feed minimal.** It's reachable by anyone with the link, so it holds only what the instructor sees in the app about their own classes. No other instructors' absence reasons, no notes, no pay.
- **Rate-limit the route lightly,** for example 60 requests per hour per token, returning `429` beyond that.
- **Archiving an instructor** makes their feed return 404 right away.

## 6. Adding a holiday or day off after classes already exist

Admins often add a class first and enter a holiday, school closure or program day off later. Today that silently changes several things at once. Handle it on purpose.

Build one shared helper, `previewDayOffImpact({ date, scope, timePeriod, program? })`, in `lib/schedule/day-off-impact.js`. It returns:
- every session that would be cancelled, using the same occurrence and AM/PM logic, so a PM-only holiday only catches afternoon classes
- who was teaching each one
- any `session_changes` on those sessions (subs already assigned, people marked out)
- whether the date falls in a pay period that's approved or whose class check is open
- whether the date is in the past

**Use the helper in two places:**
- the Holidays & days off tab on Programs, both when adding (school closures and program days off) and when removing
- any other place holidays are created, such as "Add typical holidays"

### A. Confirm before saving

If the preview finds any affected sessions, show a confirm popup instead of saving straight away.
- **Title:** "This cancels {n} classes".
- **The list:** date, school, program, time and instructor(s), with sub badges where relevant.
- **Nothing affected:** save as normal with no popup.

### B. Session counts and end dates

Classes store a fixed `end_date` (commit fd6320a), so a new holiday means that class gets **one fewer session**. That may break what was promised to a school. For each affected class that has an end date, the popup shows a choice:
- **Keep the end date** (the default): "{School} will have {n-1} sessions instead of {n}."
- **Add a make-up week:** "Push the end date to {next valid class day} so {School} still gets {n} sessions." Work out the next valid date with the occurrence logic, skipping other holidays.

Ongoing classes have no choice to make. Apply the choice per class on save. Log it in the class's activity if one exists.

### C. Subs and absences already on that date

- **`session_changes` rows on a cancelled session stay in the database,** so they come back if the holiday is removed. They don't count anywhere while the date is a holiday: not in pay, Past classes, attendance or nudges.
- **The confirm popup lists them:** "Leila was going to sub at Palmetto on Wed, Nov 25. She'll be told it's cancelled."
- **On save,** every affected instructor gets an Inbox Update: "No class {Day, Mon D} at {School} · {Holiday name}". That includes regular instructors, subs and anyone marked out. Calendar apps can lag, so the app is the reliable place for this.
- **Shout-out nudges** for a cancelled session never show.
- **Days out and attendance stats** don't count a cancelled date as a day off.

### D. Past dates and payroll

- **Date in the past:** a warning in the popup: "This date has passed. {n} classes on it were taught and will be removed from Past classes and pay." It needs an extra checkbox to confirm.
- **Date in an approved or paid pay period:** a warning that pay won't change, because approved periods are locked: "Add an adjustment on the next pay period if pay needs fixing."
- **Pay period is open and someone already confirmed their classes:** recompute automatically. Show those instructors a small line on their check card: "Updated after you confirmed: {date} cancelled ({holiday})." They don't need to confirm again.

### E. Calendar feeds

- **Feeds** drop cancelled sessions on their next refresh. Nothing else to do, since the feed reads the same logic.
- **The class details sheet and My Schedule** show the cancelled day as "No class · {holiday name}", which they already do for holidays.

### F. Removing a holiday later

- **The same preview runs in reverse:** "This brings back {n} classes".
- **The end-date question flips:** "Pull the end date back to {date}?", with No as the default.
- **Old `session_changes` rows** for those dates come back into effect.
- **The popup lists any subs that come back** ("Leila is subbing again on Wed, Nov 25"), and those people get an Update.

## Copy

No em dashes in UI text or calendar events (en dashes in date ranges are fine). Use the copy above exactly.

## When you're done

1. List the files you changed and the SQL to run.
2. Run `npm run build`, `npm run lint` and `node scripts/check-ics.mjs`, and show me the results.
3. Tell me how to test:
   - subscribe on an iPhone (Apple) and in Google Calendar on a laptop
   - mark the instructor out for a class: it disappears from the calendar on the next refresh
   - assign them as a sub: it appears as "Sub: …"
   - add a holiday: that day's class is removed
   - reset the link: the old link returns 404
   - turn sync off: the link returns 404
   - archive the instructor: the link returns 404
   - **add a holiday after a class exists:**
     - the popup lists the cancelled classes
     - "Add a make-up week" moves the end date
     - a sub already assigned that day gets an Update
     - the calendar drops the event
   - **then remove the holiday:**
     - the classes come back
     - the sub is restored and notified
   - **add a holiday on a past date inside an approved pay period:**
     - both warnings show
     - pay doesn't change

Don't commit or push. I'll review first.
