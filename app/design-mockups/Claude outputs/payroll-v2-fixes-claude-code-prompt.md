# Payroll page: fix the bugs, then redesign it to be more helpful

Read `AGENTS.md` first. This is about `/admin/payroll` (`app/admin/payroll/*`, `lib/payroll/*`). The design is on my canvas: "Admin · Payroll v2: timeline, checklist, only people being paid".

**Do Part 1 first and show me what you found before starting Part 2.**

## Part 1: bugs (these matter more than the design)

### 1. Wrong pay period dates

The page shows **Oct 19 – Nov 1, 2026, due Sun Nov 8, payday Sun Nov 15.** That's wrong. Periods are 14 days, **Saturday to Friday**, anchored on **Sat Sep 5, 2026**:
- Oct 17 – 30 is due Fri Nov 6 and paid Fri Nov 13.
- **Oct 31 – Nov 13** is due Fri Nov 20 and paid Fri Nov 27.

What to do:
- **Find the cause.** Check `payroll_settings` (`anchor_date`, `period_days`, offsets), `lib/payroll/schedule.js`, and any `new Date()` / UTC conversion that shifts days.
- **Run the date check:** `node scripts/check-payroll-dates.mjs`. Make it fail on the bug if it doesn't already.
- **Fix the code.**
- **Settings data:** if the bad dates come from the stored settings, give me the exact `UPDATE` to run. Don't run it yourself.
- **Check approvals:** confirm no period has been approved with wrong dates. If one has, tell me. Don't change it.
- **Check the class check:** confirm `lib/payroll/checks.js` and Past classes use the same corrected periods.

### 2. Alexis De La Cruz shows 0 classes

She co-teaches Palmetto Elementary (Wednesdays, 12:00 pm) with Heather Swear, but payroll shows her at 0 while Heather has classes. Trace why:
- **Her assignments:** is she in `class_assignments` for that class, and in which slot?
- **Profile ids:** does `getPeriodSessions` / `getSessionStaff` look her up by a different id than the one her assignment uses? Pre-created profiles use `profiles.id`, and linked ones may differ through `user_id`.
- **Duplicate profiles:** is this related to the duplicate Heather Swear profile?

Tell me the cause and fix the code. Don't change data without asking me.

**Then check every instructor:** for each one, compare the number of sessions in Past classes, Payroll and the class check for the same period. List any that don't match.

### 3. People with no classes are listed as problems

Instructors with 0 classes show "No rate" in red, "No reply", and an amber needs-review dot. They count toward "Instructors: 8". All of this is wrong:
- **Who's listed:** only people with at least one taught, subbed or upcoming session in the period.
- **"No rate":** a problem only when the person has classes to be paid for.
- **"No reply" in the class check:** only for people who had classes. Everyone else is `no_classes`.

## Part 2: redesign (match the canvas)

Navy/teal tokens, white cards with soft shadows and no borders, Baloo 2 headings, Nunito body text, CSS Modules.

### Header (one row)

- "Payroll" (Baloo 2, 32px), then ‹ **Oct 31 – Nov 13** › and a status pill:
  - **In progress:** light navy.
  - **Needs approval:** amber.
  - **Approved:** teal.
  - **Paid:** green.
  - **Nothing to pay:** gray.
- On the right:
  - a **This period / History** segmented control (replaces the current tabs)
  - a ghost **Export CSV** button
  - a gear icon button, labelled "Pay schedule settings", that opens the existing settings modal

### Timeline card (full width, 4 steps)

**Period ends** → **Class check due** → **Approve by** → **Payday**. Each step has:
- a dot
- a connecting line
- a small uppercase label
- the date in bold ("Fri, Nov 13")
- a muted sub-line:
  - Period ends: "{n} days left", or "Ended"
  - Class check due: "Instructors confirm", or "{n} of {n} confirmed"
  - Approve by: "You approve here", or "Overdue by {n} days" in red
  - Payday: "Instructors paid", or "Paid {date}"

**Step styling:**
- **Current step:** a solid teal dot, and a teal label.
- **Done steps:** teal ring, with a check.
- **Future steps:** gray.

### Stat tiles (4)

1. **"Pay so far"**, with the money total for taught sessions only. Sub-line: "${projected} after {last upcoming date}". If there are people with no rate, add ", plus {first name}" (or "plus {n} people").
2. **"Classes taught"**. Sub-line: "+{n} coming up".
3. **"People getting paid"**. Sub-line: "{n} had no classes".
4. **"Needs attention"**, with the count shown in red when it's above 0. Sub-line: the main reason, like "Missing a pay rate", "Open class-check issue" or "Don't pay lines".

### Table (people with classes only)

Columns: **Instructor · Classes · Rate · Adjust. · Total · Class check · ›**

- **Instructor:**
  - an avatar and their name
  - under the name: the problem in red or amber text if there is one ("No pay rate set", "2 issues flagged", "1 line set to Don't pay"). Otherwise, their schools in muted text.
- **Classes:** "{n} classes", with "{taught} taught · {subbed} subbed · {upcoming} coming up" under it. Leave out zero parts. Count 2-hour sessions as 2.
- **Rate:**
  - The rate ("$65.00"). If it changed during the period: "$65 → $70".
  - If they have no rate: a small red **"Set rate"** button that opens the drawer's rate field. Saving creates a pay note, as before.
- **Adjust.:** the total of their adjustments, or "–".
- **Total:** right-aligned and bold, from taught sessions only. Under it, muted: "${projected} after {date}" while the period is running. With no rate, show "–" with "needs a rate".
- **Class check:** a status pill:
  - **Opens {date}:** gray, before the period ends.
  - **Waiting:** gray.
  - **Confirmed:** green.
  - **{n} issues:** amber.
  - **No reply:** gray, only after the deadline.
- **The whole row is clickable** and opens the existing pay drawer.

**At the bottom of the table:** a collapsed row, "{n} instructors had no classes this period". Expanding it shows the names in one muted line, ending "Not paid this period, nothing to do."

### Right column: "Before you approve" (sticky)

A checklist of what's left. Each item has:
- a colored circle: red "!" for blockers, gray "…" for waiting, green "✓" for done
- a bold title
- a muted detail line
- an action link where one makes sense

**The items:**
- **Pay rates:**
  - Red, a blocker: "{n} people have no pay rate", listing their names, with a "Set rate ›" action.
  - Green: "Everyone has a rate".
- **Period:**
  - Gray: "Period still running", with "{n} classes left: {dates}".
  - Green: "Period ended".
- **Class check:**
  - Gray: "Class check opens {date}", or "{x} of {y} confirmed", with "Instructors confirm by {deadline}".
  - Green: "Class check done".
- **Issues:**
  - Amber: "{n} open issues", with a "Review ›" action that opens the first drawer.
  - Green: "No open issues".
- **Don't pay lines and adjustments,** only if there are any: gray, "{n} changes to review".

**At the bottom of the checklist:** the big navy **"Approve {range}"** button.
- **Disabled** while the period is running, or while a blocker is open. Under it, a small muted reason: "Opens after the period ends Fri, Nov 13", or "Set Alexis's rate first".
- **Open issues are a warning, not a block:** the confirm says "{n} open issues. Approve anyway?"
- **After approval,** the button becomes "Mark paid", and once it's used, "Paid {date}".

### Under it: "Last period" card

If an earlier period still needs approval, a small card:
- "Oct 17 – 30" and its total
- an amber "Needs approval" pill
- "Due Fri, Nov 6 · overdue"
- "Review Oct 17 – 30 ›", which switches to that period

**The sidebar badge and the page's default period** should both point at the oldest period that needs approval, which is what the current spec already says.

### Breaks

During a "Nothing to pay" period, replace the stat tiles and table with one friendly card: "No classes this period", plus "Next classes start {date}" if there are any. Then a muted "Nothing to approve." Hide the timeline's approve and payday steps.

## Copy and checks

- **Copy:** no em dashes (en dashes in date ranges are fine). Money looks like `$1,240.00`.
- **Keyboard:** rows and buttons work with the keyboard. "Set rate" doesn't also open the row.

## When you're done

1. Report Part 1 (causes, fixes, any SQL for me to run) before starting Part 2.
2. Run `npm run build`, `npm run lint` and `node scripts/check-payroll-dates.mjs`, and show me the results.
3. Give me a click-through:
   - the current period shows Oct 31 – Nov 13, with Friday dates
   - Alexis shows her Palmetto classes
   - people with no classes are only in the collapsed row
   - "Set rate" clears the blocker
   - the checklist and Approve state match each step of the timeline
   - Oct 17 – 30 shows up as needing approval
   - a break period shows "Nothing to pay"

Don't commit or push. I'll review first.
