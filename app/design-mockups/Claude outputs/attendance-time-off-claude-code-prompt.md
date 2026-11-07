# Instructor profile: Attendance & time off tab

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, server actions or route handlers.

## Goal

Add an **Attendance & time off** tab to the admin instructor profile (`app/admin/instructors/[id]`, redesigned in commit 3578fd9). Put it between Schedule and Notes & history. It shows each instructor's attendance track record and lets admins log and decide time off requests.

**How this works in real life:** instructors text us to ask for time off, so there's no instructor-side request form. An admin logs the request here, then approves or declines it. **Approving marks them out on the Schedule Board** for every class in those dates, using the same `session_changes` records and logic as `MarkOutModal.jsx`. Classes are never cancelled. Each one either gets a sub or stays red as "needs a sub".

The design is on my canvas ("Instructor profile v2 · attendance & time off"). Everything you need from it is written out below.
- **Look:** match the redesigned profile. White cards with 16px radius, soft shadows and no borders, navy/teal tokens from `app/globals.css`, Baloo 2 headings, Nunito body text, CSS Modules.
- **Primary buttons:** one solid navy primary button per card, ghost buttons for the rest.

## 1. Database

Write `supabase/migrations/add-time-off.sql`. I run SQL by hand in Supabase, so make it idempotent and tell me when to run it.

**New table:**

```sql
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('vacation','sick','appointment','personal','emergency','other')),
  note TEXT,
  requested_on DATE NOT NULL,          -- when they asked (defaults to today, editable)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  decided_by UUID REFERENCES profiles(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,                  -- e.g. "only instructor that day"
  absence_group_id UUID,               -- the session_changes group created on approval
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (end_date >= start_date)
);
```

**Changes to `session_changes`** (so we can measure notice):
- Add `notified_on DATE`. It holds when the instructor told us they'd be out. Backfill it with `created_at::date` for existing rows.
- Add `time_off_request_id UUID REFERENCES time_off_requests(id) ON DELETE SET NULL`.
- Allow `'appointment'` and `'personal'` as reasons alongside the existing ones, and add them to the reason pills in `MarkOutModal.jsx`.

**RLS on `time_off_requests`:**
- Admins only, for select, insert and update. Use the same admin check as `verifyAdmin`.
- No delete policy. Requests are cancelled, not deleted.
- Instructors get no access for now.

## 2. Mark out popup

Add a small "They told us on" date field to `MarkOutModal.jsx`. It defaults to today and saves to `notified_on`. Put it next to the note input, labelled "They told us on".

## 3. Data (`lib/instructors/attendance.js`)

`getAttendance(profileId)` covers the current school year: Aug 1 to Jul 31, America/Los_Angeles, `YYYY-MM-DD` like the rest of `lib/schedule`.

**Days out:** one item per date they were absent, from `session_changes` where `absent_profile_id = profileId`. Group same-day rows. Each item has:
- the date and the school(s) and class(es)
- the reason
- the sub's name, or none
- **notice**, worked out from `session_date - notified_on`:
  - 0 days: **"Same day"**
  - 1–6 days: **"{n} days ahead"**
  - 7 days or more: **"{n} weeks ahead"**, rounded down

**Stats:**
- **Days out:** the count, plus "about 1 in {n} classes": the classes they were scheduled to teach divided by the classes they missed, rounded. Use `getSessionStaff` and the occurrence logic to count scheduled classes.
- **"With a week or more notice":** written as "{x} of {y}", with a sub-line listing same-day absences by reason ("1 was same day (sick)").
- **Classes left without a sub:** sessions where they were out and `sub_profile_id` is null and the date has passed.
- **Times subbed for others:** sessions where `sub_profile_id = profileId`.

**Month by month:** days out per month from Aug to Jul. Months that haven't happened yet come back as `null`.

**By reason:** counts per reason.

**Covered for others:** a list of the dates they subbed, with school and "for {first name}".

**Requests:** all `time_off_requests` for them, sorted pending first, then upcoming approved, then past (newest first). For each, also return which of their classes fall in the date range and whether each one has a sub.

## 4. Actions (`lib/instructors/time-off-actions.js`)

Every action checks admin on the server with `verifyAdmin` first.

- **`logTimeOffRequest`:** profile, dates, reason, note and `requested_on`. It creates the request as `pending`.
- **`approveTimeOffRequest(id, { subs? })`:**
  - Set the request to `approved`, with `decided_by` and `decided_at`.
  - Create `session_changes` rows for every class session they teach in the range. Use the same logic `MarkOutModal` uses for several days: skip holidays, cover both slots correctly, use one shared `absence_group_id`, set `notified_on = requested_on`, and set `time_off_request_id`.
  - Leave `sub_profile_id` null unless subs were passed in.
  - Do it all in one go, so a double click can't create rows twice.
  - If a session in the range already has a change row, leave it alone and report it back.
- **`declineTimeOffRequest(id, decision_note)`:** set the request to `declined`, with the decision note.
- **`cancelTimeOffRequest(id)`:** for when they change their mind. If it was approved, remove the `session_changes` rows it created, but only rows whose dates haven't passed yet. Set status to `cancelled`.

## 5. The tab layout

**Tabs:** Overview · Schedule · **Attendance & time off** · Notes & history. Keep `?tab=attendance` in the URL.

**Stat row:** four white tiles. Each has a big Baloo 2 number (26px), a bold label and a muted sub-line.
1. **Days out:** "{n}", sub-line "Since Aug 1 · about 1 in {n} classes".
2. **With a week or more notice:** "{x} of {y}". Green when everything had 7+ days of notice, otherwise ink. The sub-line names any same-day ones, like "1 was same day (sick)".
3. **Classes left without a sub:** green at 0, red above 0. Sub-line: "Every day out was covered", or "{n} classes ran short".
4. **Times subbed for others:** "{n}", sub-line "Since Aug 1".

When they have no absences at all, tiles 1–3 read 0 and the sub-line under tile 1 says "No days out this school year."

**Two columns below**, about 60/40, stacking on narrow screens.

**Left column, card 1: "Time off"**
- **Header:** "Time off", with a solid navy "+ Log a request" button on the right.
- **Each request row** (rows separated by thin lines):
  - **Line 1:** the dates in bold ("Thu, Jan 14" or "Dec 21 – Jan 4"), then a status pill:
    - **Waiting on you:** `#FDF0DF` background, `#8A4A12` text.
    - **Approved:** green.
    - **Declined** and **Cancelled:** gray.
  - **Line 2,** muted: "{Reason} · texted {requested_on} · {notice} notice". For decided requests, add "· approved {date} by {first name}", or "· declined, {decision_note}".
  - **Line 3,** what it affects:
    - "{n} class(es): {School}, {Day} {time}", in ink.
    - "{n} class needs a sub: …", in red.
    - "Winter break, no classes affected", in green.
    - For declined requests: "Taught as scheduled", in muted text.
  - **On the right:**
    - **Pending:** Approve (solid navy) and Decline (white with a light border). Decline asks for an optional reason in a small popup.
    - **Approved with classes still missing a sub:** a ghost "Find subs" button. It opens the Schedule Board's mark-out popup in several-days mode for that absence group, so subs can be picked per class.
    - **Approved and upcoming:** a "⋯" menu with "Cancel time off". It asks for confirmation and explains that classes already marked out will be put back.
- **Empty state:** "No time off logged. When {first name} texts asking for time off, log it here."
- **Past requests:** show the last 5, then "Show all".

**Left column, card 2: "Days out"**
- **Header:** "Days out", with "This school year, newest first" in muted text on the right.
- **Each row:**
  - A date tile: the month in small caps over the day in Baloo 2, 22px, on a light tint.
  - "Out · {Reason}" in bold, with "{School} · {Program} {time}" in muted text under it.
  - On the right, stacked: a notice pill (amber `#FDF0DF` / `#8A4A12` for "Same day", green for a week or more, light navy for 1–6 days), then "{Sub} subbed" in teal-dark, or "No sub" in red.
- **Empty state:** "No days out this school year."

**Right column**
- **"Month by month":** a 6×2 grid of small tiles, Aug to Jul. Each tile shows the month in small caps and the number of days out.
  - Months with 1 or more: light teal background, teal-dark number.
  - Months with 0: light tint, muted number.
  - Future months: a faint tile with "·".
  - Caption: "Days out each month. Blank months haven't happened yet."
- **"Why they were out":** a row per reason that has at least one absence: the reason, a thin teal bar sized to its share, and the count.
- **"Covered for others":** a list of "{date} · {school}" and "for {first name}", newest first. Show the last 6, then "Show all".

## 6. Overview tab tie-in

In the Overview "At a glance" box, the "Days out this school year" cell links to this tab. Under its number, add a small muted line: "{x} of {y} with a week's notice". It's hidden when there are 0 days out.

**Copy:** no em dashes in UI text (en dashes in date ranges are fine). Use the copy above exactly.

## When you're done

1. List the files you changed and the SQL to run, in order.
2. Run `npm run build` and `npm run lint` and show me the results.
3. Give me a click-through:
   - log a request with a date 2 weeks out, then approve it: the Schedule Board should show those classes needing a sub, and Days out should show "2 weeks ahead" after the date passes
   - log another request and decline it with a reason
   - cancel an approved future request: its classes go back to normal
   - mark someone out same day on the Schedule Board: it should appear here as "Same day"
   - check the stats on someone with no absences

Don't commit or push. I'll review first.
