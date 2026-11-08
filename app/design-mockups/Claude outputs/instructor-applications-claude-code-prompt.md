# Instructor applications: simple apply page with resume upload, admin review page, emails

Read `AGENTS.md` first. This repo's Next.js version has breaking changes, so check `node_modules/next/dist/docs/` before writing pages, route handlers, server actions or file uploads.

## Goal

People apply to be instructors from the public site with a short form and their resume. Admins get an email for each new application and review them on a new **Applications** page in the admin app. Someone we hire can be turned into an instructor profile in one click.

**Keep the public page simple:** just the form and the resume upload. Don't add perks, requirements, pay info, school names or anything else.

The design is on my canvas, under "Hiring: Join Our Team page and applications". The boards are:
- Public · Join Our Team (desktop, phone, after they apply)
- Admin · Applications (review, and hired)
- Emails

**Look:**
- **Public page:** match the existing public site's header, footer and fonts. "Join Our Team" goes in the main nav.
- **Admin page:** navy/teal tokens, white cards with soft shadows and no borders, one navy primary button, Baloo 2 headings, Nunito body text, CSS Modules.

**Reuse:**
- `verifyAdmin`
- the Resend helpers in `lib/email/index.js`
- the admin sidebar and the admin Inbox
- whatever the Instructors page already does to pre-create a `not_invited` profile and an invite code. Don't write a second version of that.

## 1. Database

Write `supabase/migrations/add-applications.sql`. Make it idempotent, and tell me when to run it.

```sql
CREATE TABLE IF NOT EXISTS instructor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,                      -- optional "anything else"
  resume_path TEXT NOT NULL,         -- storage path, never a public URL
  resume_name TEXT NOT NULL,
  resume_size INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','reviewing','interview','hired','not_a_fit')),
  opened_at TIMESTAMPTZ,             -- first time any admin opened it
  status_changed_at TIMESTAMPTZ,
  profile_id UUID REFERENCES profiles(id), -- set by "Add as instructor"
  ip_hash TEXT                       -- for rate limiting only
);

CREATE TABLE IF NOT EXISTS instructor_application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES instructor_applications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Hiring setting:** add a `hiring_open BOOLEAN NOT NULL DEFAULT true` setting. Put it in an existing settings table if one fits; otherwise create a one-row `hiring_settings` table.

**Access rules (RLS):**
- RLS is on for both tables.
- Admins can read and update.
- Nobody inserts from the browser. The submit route inserts using the service role.
- Instructors can never read these tables.

**Storage:**
- Make a **private** `resumes` bucket.
- Store files at `applications/{application_id}/{random}-{safe file name}`.
- Admins open resumes through 10-minute signed URLs, created on the server after `verifyAdmin`.

## 2. Public page (`/join`)

If there's an existing "Join Our Team" or careers link, point it here.

### Hero

A short navy hero, centered:
- Eyebrow: "Now hiring instructors".
- H1: "Join our team".
- One line under it: "Teach wellness, yoga and sports to kids at schools across the Inland Empire."

### Form card

One white card.
- **Title:** "Apply to teach with us".
- **Under the title:** "Send us your info and resume. We'll be in touch."

**Fields:**
- **Name, email, phone:** first name, last name, email and phone. All required, with proper `autocomplete` values. Two columns on desktop, one on phones.
- **Resume (required):**
  - Before a file is picked: a dashed drop zone with "Upload your resume" and "or drag it here". It works as a normal file picker too.
  - After a file is picked: show the file name, size and a "Replace" link.
  - Under it: "PDF or Word, up to 10 MB."
- **"Anything else you'd like us to know? (optional)":** a textarea, 1000 characters max.
- **A required checkbox:** "I'm 18 or older."
- **The navy button:** "Send my application".

**Errors:**
- Show them inline under each field: "Add your email", "Upload your resume".
- Focus the first field with an error.
- Keep everything they typed if the submit fails.

### Thank-you state

Replace the form on the same page:
- a check icon
- "Thanks, {first name}!"
- "We got your application and sent a copy to {email}. We'll be in touch."

### Hiring paused

When `hiring_open` is false, keep the hero and replace the form with: "We're not hiring right now. Check back soon." The submit route refuses too.

### Don't ask

Don't ask for criminal history, date of birth, SSN, address or a photo. Under the California Fair Chance Act, criminal history only comes up after an offer, through the background check.

### Update links across the site

- **Find every link pointing somewhere else.** Search the public site for any link or button about joining, applying, careers, hiring or "work with us". Check everywhere: the Our Team page, home page sections, CTAs, the contact page, and the header and footer. Some of these probably point to `/team`, `#`, a contact form or a `mailto:`. Change them all to `/join`.
- **Leave "Our Team" alone.** Links that are actually about meeting the team stay on the Our Team page. Only the ones about joining or applying change.
- **Add a CTA on the Our Team page.** Near the bottom, add one if there isn't one already. Use one line and one button: "Want to work with us?" with a "Join Our Team" button that goes to `/join`.
- **Header nav:** add "Join Our Team", as in the design.
- **Footer nav:** add "Join Our Team", in the same style as the other footer links, and next to Our Team if there is one.
- **Mobile menu:** include it there too.
- **Report back.** List every link you changed, with the file, the old target and the new target.

## 3. Submit route

Write `app/api/apply/route.js`, or a server action if that's cleaner in this Next version.

### Validate on the server

- Required fields, field lengths and email format.
- **The resume file:**
  - Up to 10 MB.
  - `.pdf`, `.doc` or `.docx` only.
  - Check the real file type from its first bytes (`%PDF`, the OLE header, the ZIP header), not just the extension.
  - Rename it to a safe name.

### Compress PDF resumes

Shrink every PDF before saving it, so storage stays small and resumes open fast.

- **Where:** on the server, in the submit route, after validation and before upload.
- **How:** use `pdf-lib`. Load the PDF and save it again with `useObjectStreams: true`. This keeps the text, links and layout exactly the same.
- **Big files:** if the PDF is still over 2 MB after that, it's usually scanned or full of photos. Downsample the images inside it to about 150 DPI (JPEG, quality around 75).
  - Check whether that can run on Vercel. Ghostscript and qpdf usually aren't available there.
  - If it can't, tell me the options before adding anything: a small compression API, or doing it in the browser before upload. Don't add a paid service without asking.
- **Keep whichever is smaller.** If compression fails or makes the file bigger, save the original. Never block an application because compression failed. Log it.
- **Word files:** `.doc` / `.docx` are saved as they are. They're already compressed.
- **Limits:** the 10 MB limit applies to the file they upload. Save the final size in `resume_size`, and show that size on the admin page.
- **Logging:** log the size before and after (for example, `resume 4.2 MB → 1.1 MB`) so I can see it's working.

### Spam protection

- **Hidden honeypot field:** if it's filled, show the normal success screen and save nothing.
- **Too-fast submits:** if the form is sent less than 3 seconds after the page loads, treat it the same way.
- **Per-IP limit:** at most 3 applications per IP per hour. Store only a salted hash of the IP.
- **Per-email limit:** at most 1 per email per 24 hours.
  - A second one inside that window replaces the resume and message on the first application instead of creating a duplicate.
  - It also adds a system note: "Applied again on {date}".

### Order of operations

1. Upload the file.
2. Insert the row.
3. Send the emails.

### Failures

- **Upload or insert fails:** clean up anything already saved, then show: "Something went wrong. Please try again."
- **An email fails:** keep the application, log the error, and still show success.

## 4. Emails (Resend, in `lib/email/index.js`)

Add `sendNewApplicationEmail(application)` and `sendApplicationReceivedEmail(application)`. Match the "Emails" board.

### To admins, for each new application

- **Recipients:**
  - The email goes to a **"Send new applications to"** list stored with `hiring_open`, as a `notify_emails TEXT[]` setting.
  - If the list is empty, send to every admin.
  - The list is set in a small **"Email settings"** popover, opened from a gear button next to "Copy page link" on the Applications page.
  - In the popover, you add or remove addresses, with email validation and at least one address required, then "Save".
  - The email is sent the moment an application is saved, with no batching or delay.
- **Subject:** "New instructor application: {First} {Last}"
- **Heading:** "New application from {First} {Last}"
- **Text:** "{First} applied on the Join Our Team page. Open it to see their resume and add notes."
- **Small facts box:** Email, Phone, Resume (Yes (PDF) or Yes (Word)).
- **Button:** "Open application", linking to `/admin/applications?id={id}`.
- **Reply-To:** the applicant's email. Add the line: "You can reply to this email to write to {First} directly."
- **No resume:** don't attach the resume or link to the file. It stays behind admin login.

### To the applicant

- **Subject:** "We got your application"
- **Heading:** "Thanks for applying, {First}!"
- **Text:** "We got your application to teach with Shape Your Destiny. We'll be in touch."
- **Footer:** "Questions? Just reply to this email." Reply-To is the team's contact email.

**No status-change emails.** Admins reach out themselves.

## 5. Admin page (`/admin/applications`)

### Sidebar

Add **Applications** right after **Instructors**, with a document icon. Its badge counts `new` applications that no admin has opened yet. Use the same badge style as Inbox.

### Admin Inbox

Add an `application` item: "New application from {First} {Last}", linking to the application. Mark it done (using `admin_inbox_done`) once any admin opens the application.

### Header

- **Title:** "Applications", in Baloo 2 at 32px.
- **Under the title:** "People who applied on the Join Our Team page. You get an email for each new one."
- **On the right:**
  - **"Hiring is Open / Paused":** a pill toggle, green when open and gray when paused. Pausing asks for confirmation: "Pause hiring? The Join Our Team page will say you're not hiring right now."
  - **"Copy page link":** a ghost button that copies the full `/join` URL and shows "Copied".

### Tabs

**New · Reviewing · Interview · Hired · Not a fit**, each with a count. Open on New, or on the tab of `?id=` if one is given.

### Layout

A 400px list on the left and a detail card on the right.

### List cards

Each card shows:
- an avatar initial
- their name
- a teal dot if no admin has opened it yet
- when it came in, on the right ("2h ago", "Yesterday", "Nov 4")
- their email
- "Resume attached"

**Behavior:**
- The selected card gets a navy ring.
- Newest cards are first.
- An empty tab shows "Nobody here right now."
- Selecting a card updates `?id=`.
- Every card can be reached and opened with the keyboard.

### Detail card

**Top:**
- avatar and name (Baloo 2, 26px)
- "Applied {Sat, Nov 7}"
- a **Status** select on the right, tinted by status:

  | Status | Tint |
  |---|---|
  | New | teal |
  | Reviewing | navy tint |
  | Interview | amber |
  | Hired | green |
  | Not a fit | gray |

**Main column:**
- **Email and phone tiles:** `mailto:` and `tel:` links.
- **"What they wrote":** their message, with line breaks kept. If they left it blank, show a muted "Nothing added."
- **Resume row:**
  - a file type tile, the file name and its size
  - **"Open resume":** gets a signed URL and opens it in a new tab
  - **"Download"**

**Right column (300px), "Notes":**
- A textarea, "Add a note for the team". It saves on Enter or with a small "Add" button.
- Notes are listed newest first, with "{first name} · {date}".
- All admins see all notes.
- System notes are muted.

**Buttons at the bottom of the notes column:**

| Status | Buttons |
|---|---|
| New | "Move to Reviewing", plus a red text button "Not a fit" |
| Reviewing | "Move to Interview", plus "Not a fit" |
| Interview | "Mark hired", plus "Not a fit" |
| Hired | "Add as instructor", with "Creates their profile and an invite code. Nothing is sent until you send the invite." under it. Once added, the button becomes "View instructor ›". |
| Not a fit | No main button. The Status select can still move them back. |

**Behavior:**
- The first time any admin opens an application, set `opened_at`. This clears the dot and the badge.
- Changing the status sets `status_changed_at` and adds a system note: "{name} moved this to Interview". It doesn't email anyone.

### "Add as instructor"

- Uses the existing pre-create flow. Name, email and phone are copied over.
- It doesn't send the invite. It takes me to their new instructor page.
- It saves `profile_id` on the application.
- **If an instructor with that email already exists,** say "There's already an instructor with this email", link to them, and don't create a second profile.

### Clean-up

- In the existing daily cron, delete **Not a fit** applications and their resume files after 1 year, and log how many were deleted.
- Never auto-delete **Hired** applications.

## Copy and checks

- **Copy:** no em dashes in UI text or emails. Use the copy above exactly, and don't add lines that aren't in the design.
- **Forms:** every field has a real `<label>`. Everything works with the keyboard.
- **Phones:** the public page works at 390px wide with no sideways scrolling.
- **Resumes stay private:** a resume URL can't be guessed or opened without being logged in as an admin.

## When you're done

1. List the files you changed, the SQL to run, and any steps I need to do in the Supabase dashboard (such as the storage bucket).
2. Run `npm run build` and `npm run lint`, and show me the results.
3. Give me a click-through:
   - apply on a phone with a PDF: the thank-you shows, I get the admin email, and the applicant gets theirs
   - add a second address in "Email settings": the next application emails both addresses
   - try submitting without a resume: blocked with "Upload your resume"
   - try a `.png` renamed to `.pdf`, then a 12 MB file: both refused with a clear message
   - upload a large PDF (a scanned or photo-heavy resume): show me the before and after sizes, and that it still opens and looks right
   - upload a PDF that's already small: it isn't made bigger
   - fill in the honeypot: success shows, but nothing is saved
   - apply twice with the same email: still one application, with an "Applied again" note
   - the badge and Inbox item show up, then clear after I open the application
   - open the resume, add a note, and move it Reviewing → Interview → Hired
   - "Add as instructor" creates a not-invited profile, and using an email that already exists is blocked
   - pause hiring: `/join` shows the paused message
   - "Join Our Team" in the header, footer and mobile menu, and the Our Team page button, all go to `/join`
   - logged in as an instructor: I can't see applications or resumes

Don't commit or push. I'll review first.
