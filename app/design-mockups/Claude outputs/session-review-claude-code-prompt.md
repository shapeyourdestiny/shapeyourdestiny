# End of session review (required): email, app reminder screen, Inbox card and review page

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, server actions or cron routes.

## Goal

When an instructor teaches their last class of a session at a school, they get a short **session review**. **It's required**, due 7 days after their last class. It reaches them four ways:
1. **An email** after their last class.
2. **A card at the top of their Inbox** (Updates tab), until they finish the review.
3. **A review page** in the app. This is a full page, not a pop-up.
4. **A reminder screen** when they open the app while a review is pending (section 5b).

Admins see the answers.

The design is on my canvas: "End of session review (required)". It has six boards:
- Emails
- Inbox card
- Review page
- After sending
- App open, before the due date
- App open, after the due date

**Style:**
- navy/teal tokens
- Baloo 2 headings, Nunito body text
- CSS Modules
- 44px tap targets

**Reuse:**
- `getPeriodSessions` / `getSessionStaff`, to work out last classes and counts
- Resend helpers in `lib/email/index.js`
- the existing cron route pattern with `CRON_SECRET`
- `inbox_reads` and the Inbox v3 layout
- shout-out queries
- `verifyAdmin`

## 1. What counts as "a session"

A session is one class (school + program) from its start date to its `end_date`.

**The instructor's last class:** the last date they actually taught that class, as a teacher or co-teacher. Use the same helpers as payroll, which account for holidays, days off, absences and subs. That way the date matches the rest of the app.

**Who gets a review:**
- Only someone who taught at least **3** classes of that session. If they only subbed once or twice, they get no review.
- If someone was out for the final class and a sub covered it, they still get their review after the class's last date.

**No end date:** if a class has no `end_date`, it never triggers a review. List those classes in your report so I can add end dates.

## 2. Database

Write `supabase/migrations/add-session-reviews.sql`. Make it idempotent, and tell me when to run it.

```sql
CREATE TABLE IF NOT EXISTS session_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  class_id UUID NOT NULL,                 -- reference the real classes table
  session_start DATE NOT NULL,
  session_end DATE NOT NULL,
  classes_taught INT NOT NULL,            -- saved when the review is created
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted')),
  overall SMALLINT CHECK (overall BETWEEN 1 AND 5),
  kids_growth SMALLINT CHECK (kids_growth BETWEEN 1 AND 5),
  support SMALLINT CHECK (support BETWEEN 1 AND 5),
  went_well TEXT,
  change_next TEXT,
  needs TEXT,
  due_date DATE NOT NULL,                 -- last class + 7 days
  emailed_at TIMESTAMPTZ,
  reminders_sent INT NOT NULL DEFAULT 0,  -- 0 to 3
  reminded_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, class_id, session_end)
);
```

Also add a table for co-instructor ratings:

```sql
CREATE TABLE IF NOT EXISTS session_review_coworkers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES session_reviews(id) ON DELETE CASCADE,
  coworker_id UUID NOT NULL REFERENCES profiles(id),
  classes_together INT NOT NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  UNIQUE (review_id, coworker_id)
);
```

**RLS:**
- An instructor can read their own reviews. They can update a review only while it's `pending`, and only the answer fields.
- Admins can read all reviews.
- `session_review_coworkers` follows the same rules as its review: the writer can read their own rows, and admins can read all of them. **The co-instructor being rated can never read rows about themselves.** Test this.
- Only the server creates reviews.
- No deletes from the app.

## 3. Creating and sending (daily cron)

Add the work to the existing daily cron, or to a new `app/api/cron/session-reviews/route.js` with the same `CRON_SECRET` check. Run it in the evening, Pacific time. **It must be safe to run twice.**

**Each run does three things:**
1. **Finds sessions that just ended.** For each class whose last class date was today or earlier and has no review yet, it creates a `pending` review for each instructor who qualifies.
   - Only look back 14 days, so turning this on doesn't flood everyone with old sessions.
   - Before turning it on, tell me how many reviews the first run would create.
2. **Sends the email** for each new review, then sets `emailed_at`.
   - **Several reviews at once:** if one person has several reviews created on the same day, send them **one** email listing each school, with a button for each.
3. **Sends reminders** while the review is still `pending`:
   - 3 days after `emailed_at`
   - on the due date
   - **one overdue email** the day after the due date

   That's three at most. Track which ones went out (for example a `reminders_sent INT` column, plus `reminded_at`) so none repeats. After the overdue email there are no more emails; the reminder screen in the app takes over.

## 4. Emails

Match the "Emails" board.

**After the last class**
- **Subject:** "{School} is a wrap! How did it go?"
- **Heading:** "Thanks for a great session, {first name}!"
- **Text:** "You just wrapped up {Program} at {School}. Tell us how it went so we can make the next session even better. It takes about 2 minutes."
- **Small facts box:**
  - Classes taught
  - Due ("Thu, Nov 26"), as the first line
  - Dates ("Sep 10 – Nov 19")
  - Shout-outs ("{n} from your teammates"). Leave this line out if they got none.
- **Button:** "Start review", linking to `/instructor/review/{id}`.
- **Footer:** "You can also find this in your Inbox in the app."

**Reminders**
- **Subject:** "Reminder: your {School} review is due {Day, Mon D}"
- **Heading:** "Your session review is due {Day, Mon D}"
- **Text:** "Please take 2 minutes to tell us how your {School} session went. Your feedback helps us plan the next one."
- **Button:** "Start review".
- **Footer:** "You can also find it at the top of your Inbox in the app."

**Overdue (the day after the due date, once)**
- **Subject:** "Your {School} review is overdue"
- **Heading:** "Your session review is overdue"
- **Text:** "Your {School} review was due {Day, Mon D}. Please take 2 minutes to finish it today."
- **Button:** "Finish review".
- **Footer:** "This is the last email about it. You'll also see it when you open the app."

**Rules for both:**
- No pay information.
- No other people's data. The shout-out count is fine, but no names.
- These emails are required. They still send even if the instructor turns off optional notifications.

## 5. Inbox card

At the top of the **Updates** tab, above Pinned, show one card for each `pending` review.

**Card design:**
- A navy-to-teal gradient card with a star tile.
- **Label:** "SESSION REVIEW".
- **Title:** "{School} is a wrap!"
- **Text:** "You taught {n} classes this session. Tell us how it went. It takes about 2 minutes."
- **Button:** a white "Start review ›" button that opens the review page, with an amber "Due {Day, Mon D}" pill next to it. After the due date the pill turns red: "Overdue".

**Behavior:**
- Pending reviews count toward the unread badge on the Inbox tab until they're submitted.
- Once submitted, the card disappears.
- Optional: after submitting, a normal read row can sit in Earlier: "You reviewed your {School} session".
- **The card doesn't expire.** It stays until submitted and keeps counting toward the badge.

## 5b. Reminder screen when they open the app

When an instructor with a pending review opens the app (or comes back to it after more than an hour away), show a full-screen reminder **once per app session** before their normal page. Match the two "App open" boards.

**Before the due date:**
- "BEFORE YOU JUMP IN"
- "How did {School} go?"
- "Your session review takes about 2 minutes. We read every one."
- an amber "Due {Day, Mon D}" pill
- a white **"Start review"** button, and a text button **"Later"** that goes to the page they were opening

**After the due date:**
- "REVIEW OVERDUE"
- "Your {School} review is overdue"
- "Please finish your session review. It takes about 2 minutes, and the rest of the app opens right after."
- a red "Was due {Day, Mon D}" pill
- **"Start review"**, and instead of "Later", a text button **"View today's schedule"**

**After the due date, "View today's schedule" is the only way around the reminder screen.** It opens only today's Schedule. Every other page sends them back to the reminder screen until the review is sent. **Never block them from seeing where they need to be today.** The Schedule page also shows a small red banner: "Your {School} review is overdue · Finish it ›".

**Never tie the review to pay.** Don't hold, delay or change pay, and don't block the payroll class check because a review is missing. In California, wages have to be paid on time no matter what. The review is required through reminders and the app screen only.

**Admins:** the class panel and instructor page show overdue reviews in red. Add an admin Inbox item when a review becomes overdue, one per review.

## 5c. Due date on their synced calendar

If the instructor has calendar sync turned on (the existing `calendar_feeds` feed from the calendar sync prompt), add the review due date to their feed.

**The event:**
- An **all-day event** on the due date.
- **Title:** "Session review due: {School}"
- **Description:** "Takes about 2 minutes." plus a link to `/instructor/review/{id}`.
- **Nothing else:** no answers, no co-instructor names, no ratings.
- **A stable UID**, such as `review-{id}@shapeyourdestiny`, so updates replace the event instead of creating a duplicate.

**When it shows up and disappears:**
- It's added when the review is created, so it appears in their calendar right after their last class.
- Once the review is submitted, it's removed from the feed at the next refresh. Google can take up to 12–24 hours to refresh, so it may linger briefly. That's fine.
- If the due date changes, update the event using the same UID.
- It follows the same on/off setting as classes. If calendar sync is off, nothing is added.

**Build it into the feed.** Generate this event in the same feed code as classes. Don't create a separate calendar. If the feed has a helper per event type, add a `review_due` type.

## 6. Review page (`/instructor/review/[id]`)

This is a full page under Inbox. The bottom nav shows Inbox as active.

**Header:** the navy band with:
- "‹ Inbox"
- "SESSION REVIEW"
- the title "You finished your {School} session!"
- "{Program} · {start} – {end}"

**Stats card:** a white card overlapping the header with three numbers:
- **classes taught**
- **teammates:** how many different co-teachers and subs they taught with
- **shout-outs:** approved shout-outs they received for that class during the session

**Intro:** "Thank you for a great session. Tell us how it went so we can make the next one even better. It takes about 2 minutes and is due {Day, Mon D}."

**Card 1: three star rows, 1 to 5 stars.** Tapping the same star again clears it. **All three are required.**
- "How was this session overall?"
- "How much did the kids grow?"
- "How supported did you feel by our team?"

**Card 2: "Working with your co-instructor"** (only if they taught with someone)
- Under the title: "Only the admin team sees this. Your co-instructor never does."
- **One block per co-instructor** who taught at least 2 classes of that session with them. Use `getSessionStaff`. Subs who covered once don't count.
- **Each block has:**
  - their avatar, name and "{n} classes together"
  - **"How was working with {name}?"** 1 to 5 stars, **required**
  - an optional text box: "What was it like teaching together? (optional)"
- If they taught alone, hide this card.

**Card 3: three text boxes,** 1000 characters max each.
- "What went well?" (placeholder: "A moment or lesson you were proud of"). **Required.**
- "What should we change next time?" (placeholder: "Lessons, timing, space, anything"). **Required.**
- "Anything you need from us? (optional)" (placeholder: "Training, supplies, support")

**Submit:**
- The navy **"Send my review"** button stays disabled until **everything required** is answered: all three star rows, each co-instructor rating, and the first two text boxes.
- Under it, while something's missing: "Answer every question to send. Only the admin team sees this." in amber. Once everything is answered: "Only the admin team sees this." in gray.
- Check the same requirements on the server.
- **Save a draft as they go,** so leaving and coming back keeps their answers. Use the `pending` row, or local state saved every few seconds.

**After sending:**
- The form is replaced with:
  - a check
  - "Thanks, {first name}!"
  - "Your review helps us plan the next session. We'll reach out if we have questions."
- **A "Shout-outs you got this session" card,** in warm cream, showing up to 3 approved shout-outs. Each shows the quote, the sender's first name and the date. Hide the card if there are none.
- A "Back to Inbox" link.

**Once submitted, it can't be edited.** If they open the link again, they see the thank-you view.

**Access:**
- If the review belongs to someone else, or doesn't exist, show "We couldn't find this review", with a link back to Inbox.
- Never show another person's review.

## 7. Admin side

Keep it simple. No new page.

- **Programs page, class panel:** a "Session reviews" section for each ended session.
  - **Summary:** the average of each star row. For example: "Overall 4.5 · Kids grew 4.0 · Support 3.5".
  - **Each submitted review:** the instructor's name, the stars and the three answers.
  - **Still waiting:** list who hasn't submitted yet, with their names.
- **Instructor page:** their session reviews, newest first.
- **Co-instructor ratings:** on each instructor's page, show a "From co-instructors" section with ratings *about* them: the stars, the comment, who wrote it, the session and the date. Also show their average over the last 12 months. **Admins only.** On the class panel, show each review's co-instructor rating inside that review.
- **Admin Inbox:**
  - An item when a review is submitted with **overall at 2 stars or less**, **support at 2 stars or less**, **a co-instructor rating at 2 stars or less**, or anything written in "Anything you need from us?".
  - **No item for normal reviews.** Use the existing done pattern.
- **Optional, only if it's easy:** a "Remind" button next to each pending person. It resends the reminder email, once per day at most.

**Keep these separate:**
- `class_notes`, from Past classes, are per-class feedback.
- `session_reviews` are end-of-session feedback.
- `instructor_notes` are admins' private notes about instructors. Don't copy co-instructor ratings into them automatically.

Don't mix them.

## Copy and checks

- **Copy:** no em dashes in UI or emails (en dashes in date ranges are fine). Use the copy above exactly, with no extra lines. Don't name seasons ("Fall"). Use the school and dates, so it works all year.
- **Accessibility:** star rows are labelled groups of `aria-pressed` buttons. Every text box has a real label. Everything works with the keyboard.
- **Phones:** the page is full width with 16px padding.

## When you're done

1. List the files you changed, the SQL to run, and any classes missing an `end_date`.
2. Run `npm run build` and `npm run lint`, and show me the results.
3. Give me a click-through using a test class with an end date of today:
   - Run the cron. One review is created per qualifying instructor, and someone who subbed only once gets none.
   - The email arrives. For a person with two sessions ending the same day, there's one email with two buttons.
   - The Inbox shows the review card at the top, and the Inbox tab badge counts it.
   - Leave halfway and come back: answers are kept. "Send my review" stays disabled until every required answer is filled in, including the co-instructor stars.
   - Open the app before the due date: the reminder screen shows once, and "Later" works. After the due date: only "Start review" and "View today's schedule" work, and other pages send them back to the reminder.
   - Log in as the co-instructor: they can't see the rating about them anywhere, including through the API.
   - Pay and the payroll class check aren't affected by a missing review.
   - With calendar sync on, the feed (`.ics`) has an all-day "Session review due: {School}" event on the due date. After submitting, it's gone from the feed. With sync off, it's not there.
   - Submit: the thank-you and the shout-outs card show, the Inbox card disappears and the badge drops.
   - Run the cron again: no duplicates. Move `emailed_at` back 3 days and run it: one reminder goes out. On the due date, one more. The day after, the overdue email. After that, no more emails.
   - A review with overall at 2 stars creates an admin Inbox item, and the class panel shows the summary and who's still pending.
   - Instructor A opening instructor B's review link sees "We couldn't find this review".

Don't commit or push. I'll review first.
