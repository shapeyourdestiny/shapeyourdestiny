# Shape Your Destiny Codebase Audit

**Date:** November 4, 2026
**Build Status:** Passes with 3 warnings (no errors)
**Lint Status:** 4 warnings (no errors)

> **UPDATE:** All critical issues have been fixed. See "Fixes Applied" section below.

---

## Fixes Applied

The following issues have been fixed:

1. **Pre-created profiles can now log in** - Added `user_id: userId` to registration route when linking profiles (`app/api/auth/register/route.js`)

2. **Debug endpoints deleted** - Removed `app/api/debug-auth` and `app/api/test-db`

3. **Dead code removed:**
   - Deleted `lib/certifications/status.js`
   - Removed coverage email functions from `lib/email/index.js`
   - Deleted `app/design-mockups/` folder (30 HTML files)

4. **WhatsApp button hidden** - Removed placeholder button from instructor mobile header until real link is available

5. **Mobile tap targets fixed** - Increased to 44px minimum:
   - Header icon button (was 36px)
   - Front office call button
   - Co-teacher contact buttons

6. **Lint warnings fixed** - Removed unused variables in:
   - `app/api/auth/upload-avatar/route.js`
   - `lib/instructors/actions.js`
   - `lib/instructors/queries.js`
   - `lib/payroll/schedule.js`

7. **Gitignore updated** - Added rule to block PDFs in `public/Images/`

### Still needs manual action:
- **Move the PDF** - `public/Images/Coach Swear - American Express - Account Activity.pdf` must be moved out of the repo manually
- **Run db-checks.sql** - Verify migrations in Supabase

---

## Summary

The codebase is generally functional but has one critical bug that breaks the "add instructor before sign-up" flow, plus debug endpoints that should be removed before production. The coverage feature was cleanly removed but left some unused email functions. Payroll tables exist but no UI was built. Mobile tap targets on some buttons are below the 40px minimum.

---

## Step 0: Safety Check Results

### Files in `public/` (Served to Anyone)

| File | Status | Action |
|------|--------|--------|
| `public/Images/Coach Swear - American Express - Account Activity.pdf` | **Untracked** - Never committed | **Move out of repo now.** Added `.gitignore` rule to prevent future commits. |
| `public/Images/Palmetto-12p-1pm10-16.pdf` | **Committed** in HEAD | This appears to be a class schedule (2-page PDF). If sensitive, consider removing from git history with `git filter-branch` or BFG. |

### Secrets Check

- `.env.local` is gitignored and was never committed.
- No hardcoded API keys, tokens, or passwords found in source files.
- All secrets are loaded from `process.env.*`.

### Debug Endpoints

| Endpoint | What It Does | Auth Required | Recommendation |
|----------|--------------|---------------|----------------|
| `GET /api/debug-auth` | Returns full profile data (including `is_admin`) for authenticated user | Yes (auth cookie) | **Delete** - leaks role info, not needed in production |
| `GET /api/test-db` | **Writes** to a `ping` table and reads it back | **No** | **Delete immediately** - allows unauthenticated DB writes |

---

## Fix Now (Critical / Blocking)

### 1. Pre-created profiles cannot access instructor dashboard

**Area:** Auth / Registration
**Files:**
- `app/api/auth/register/route.js:85-107`
- `app/instructor/dashboard/page.jsx:36-54`

**What's wrong:** When an admin creates a profile before sign-up (the "add before invite" flow), the profile gets a random UUID for `id` and `user_id = null`. When the instructor registers using the invite code, the registration route updates the profile but **never sets `user_id`**. The instructor dashboard tries to find the profile by `user_id = auth.uid()`, then falls back to `id = auth.uid()`. Both fail because `user_id` is still null and `id` is the random UUID, not the auth user's ID.

**What a user would see:** After registering with an invite code tied to a pre-created profile, the instructor sees "Unable to load your profile" on their dashboard.

**Confidence:** Checked in code - definite bug.

**Fix:** In `app/api/auth/register/route.js`, when `profileId` exists (lines 85-107), add `user_id: userId` to the `updateData` object:

```javascript
const updateData = {
  status: "active",
  phone: phone.trim(),
  user_id: userId,  // <-- ADD THIS LINE
};
```

### 2. WhatsApp link is a placeholder

**Area:** Instructor App
**File:** `app/instructor/components/InstructorShell.jsx:8`

**What's wrong:**
```javascript
const WHATSAPP_LINK = "https://chat.whatsapp.com/YOUR_COMMUNITY_LINK"; // TODO: Replace with actual link
```

**What a user would see:** Tapping the WhatsApp button opens an invalid URL.

**Confidence:** Checked in code.

**Fix:** Replace `YOUR_COMMUNITY_LINK` with the actual WhatsApp community invite link.

### 3. Debug endpoints must be deleted

**Area:** API Routes
**Files:**
- `app/api/debug-auth/route.js`
- `app/api/test-db/route.js`

**What's wrong:** `test-db` allows unauthenticated writes to the database. `debug-auth` exposes profile data including admin status.

**Fix:** Delete both files.

---

## Half Built

### 1. Payroll System

**Area:** Admin
**Files:**
- `lib/payroll/schedule.js` - Date calculation logic (works)
- `scripts/check-payroll-dates.mjs` - Test script (passes)
- `supabase/migrations/add-payroll.sql` - Tables and RLS (complete)

**What's missing:**
- No `app/admin/payroll/page.jsx` exists
- No sidebar link to payroll
- No UI to view periods, set rates, approve pay

**Size:** Medium-large feature. Tables are ready; need full UI.

### 2. Coverage Feature (Removed)

**Status:** Intentionally removed in commit `666ab44`.

**What's left:**
- `sendCoverageClaimNotification()` in `lib/email/index.js:295-370`
- `sendCoverageClaimAdminNotification()` in `lib/email/index.js:375-446`
- Both functions reference `/admin/coverage` which doesn't exist

**Fix:** Delete the two unused email functions.

---

## Leftovers to Remove

| File/Code | Reason | Safe to Delete |
|-----------|--------|----------------|
| `lib/certifications/status.js` | Not imported anywhere. Certification fields were removed. | Yes |
| `lib/email/index.js:295-446` | `sendCoverageClaimNotification` and `sendCoverageClaimAdminNotification` - coverage feature removed | Yes |
| `app/api/debug-auth/route.js` | Debug endpoint, leaks profile data | Yes |
| `app/api/test-db/route.js` | Debug endpoint, allows unauth DB writes | Yes |
| `app/design-mockups/` | 30 HTML mockup files and images. Not served by Next.js but adds to repo size | Yes (or move outside repo) |
| `public/Images/Palmetto-12p-1pm10-16.pdf` | Committed PDF, appears to be a schedule. Delete from repo if not needed. | Check with Heather |

### Build/Lint Warnings to Address

| File | Line | Issue |
|------|------|-------|
| `app/admin/instructors/InstructorDrawer.jsx` | 88 | Use `<Image />` instead of `<img>` |
| `app/admin/instructors/InstructorsList.jsx` | 199 | Use `<Image />` instead of `<img>` |
| `app/components/SplitSection.jsx` | 31 | Use `<Image />` instead of `<img>` |
| `app/api/auth/upload-avatar/route.js` | 55 | Unused variable `uploadData` |
| `lib/instructors/actions.js` | 178 | Unused variable `e` |
| `lib/instructors/queries.js` | 144 | Unused variable `e` |
| `lib/payroll/schedule.js` | 77 | Unused variable `anchorDate` |

---

## Confusing or Rough

### 1. Mobile tap targets below 40px

| Element | File | Size | Fix |
|---------|------|------|-----|
| WhatsApp header button | `InstructorShell.module.css:197-214` | 36x36px | Increase to 44x44px |
| Front office call button | `ClassDetailsSheet.module.css:418-432` | ~28px height | Add `min-height: 44px` |
| Co-teacher contact buttons | `ClassDetailsSheet.module.css:503-525` | ~32px height | Add `min-height: 44px` |

### 2. Empty states without next steps

| State | File | Issue |
|-------|------|-------|
| "No upcoming classes" | `InstructorSchedule.jsx:180-194` | Shows last class ended date but no CTA to contact admin |
| "No classes yet" | `InstructorSchedule.jsx:282-291` | Says "will show once assigned" but no help link |
| Coming-soon resources | `forms/page.jsx:8-33` | "Lesson plans" and "Instructor handbook" show "Coming soon" with no timeline |

### 3. Em dashes for "no data"

Multiple places use `"---"` as fallback. This is intentional design but inconsistent with the rest of the UI. Consider using "Not set" or leaving fields blank.

**Files:**
- `InstructorDrawer.jsx:20,222,235`
- `ProfileClient.jsx:15`
- `admin/dashboard/page.jsx:71,91`

---

## Route Test Results

All routes tested with `curl` while logged out:

| Route | Status | Notes |
|-------|--------|-------|
| `/` | 200 | Home page |
| `/contact` | 200 | Contact form |
| `/corporate-training` | 200 | |
| `/intramural-sports` | 200 | |
| `/our-team` | 200 | Static staff page |
| `/youth-program/yoga-breathwork` | 200 | Dynamic program page |
| `/instructor-login` | 200 | Login page |
| `/forgot-password` | 200 | Password recovery |
| `/admin/dashboard` | 307 -> `/instructor-login` | Correct redirect |
| `/instructor/dashboard` | 307 -> `/instructor-login` | Correct redirect |
| `/api/debug-auth` | 200 | Returns `{authenticated: false}` when logged out |
| `/api/test-db` | **200** | **Writes to DB without auth - DELETE THIS** |

---

## Checked and Working

- **Public site:** Home, Youth Program pages, Corporate Training, Intramural Sports, Our Team, Contact form with both emails (notification + confirmation)
- **Auth flows:** Login, Register (with invite code), Forgot password, Reset password, Auto sign-in after registration
- **Admin sidebar:** All 5 links valid (Invite Codes, Instructors, Programs, Schedule Board, Incident Reports)
- **Admin features:** Create/resend/delete invite codes, Instructor list/detail/edit/archive/delete, District management, Class management, Holiday management with AM/PM support
- **Instructor app:** Dashboard with schedule, Forms page, Incident Report form, Profile photo upload
- **Schedule calculation:** `lib/schedule/sessions.js` and `occurrences.js` properly handle holidays, program off days, and AM/PM partial days
- **Logout:** Works on both admin and instructor
- **Footer/header links:** All internal links valid

---

## Needs Heather to Test

### Admin Portal (Desktop)

1. **Pre-created profile flow:**
   - Go to Instructors > Add Instructor (the "Add before sign-up" flow if it exists)
   - Create a profile with name "Test Instructor"
   - Send invite email
   - Check email arrives
   - Register as that instructor using the invite code
   - After registration, verify the instructor dashboard loads (currently broken - see Fix Now #1)

2. **Password reset from admin:**
   - Go to Instructors > select an instructor > Reset Password
   - Verify the instructor receives reset email
   - Complete reset flow and verify login works

3. **Archive and restore:**
   - Archive an active instructor
   - Verify they disappear from active list
   - Show archived instructors
   - Restore them
   - Verify they can still log in

### Instructor App (Mobile - 390px width)

1. **Class details sheet:**
   - Tap a class card
   - Verify sheet slides up and can be scrolled
   - Tap "Get Directions" - verify Maps opens
   - Tap "Call Front Office" - verify phone dialer opens
   - Close sheet with X button and swipe-down gesture

2. **WhatsApp button (after fix):**
   - Tap WhatsApp icon in header
   - Verify it opens the community chat

3. **Incident report:**
   - Go to Forms > Report an Incident
   - Fill out form and submit
   - Verify success state shows
   - Verify email arrives to admins

---

## Database

### Required Migrations (in order)

1. `supabase/schema.sql` - Base tables
2. `supabase/schedule-schema.sql` - Classes, assignments
3. `supabase/add-class-schema.sql` - Additional class fields
4. `supabase/staff-page-schema.sql` - Staff page fields on profiles
5. `supabase/migrations/add-unlinked-profiles.sql` - Adds `user_id` column, `not_invited` status, `profile_id` on invite_codes
6. `supabase/migrations/add-school-details.sql` - Adds `instructions`, `office_contact`, `office_phone` to schools
7. `supabase/migrations/add-holiday-time-period.sql` - Adds `time_period` column to holidays
8. `supabase/migrations/allow-instructors-read-offdays.sql` - RLS for instructor read access
9. `supabase/migrations/add-payroll.sql` - Payroll tables (optional until UI is built)

### What `audit/db-checks.sql` Will Tell You

Run each section in the Supabase SQL Editor:

1. **Migration status:** Which columns/tables exist. If `has_user_id_column` is `false`, the critical registration fix won't work until `add-unlinked-profiles.sql` is run.

2. **RLS policies:** Lists all row-level security policies. Check that instructors can only read their own profile and their class assignments.

3. **Profile user_id status:** Shows how many profiles have `user_id` set. If any pre-created profiles show `no_user_id` but status is `active`, they're broken.

4. **Data integrity:** Classes with no instructor, schools with no address, orphaned records.

5. **Incident reports:** Count by status. Open reports show in the sidebar badge.

6. **Admin users:** Lists all admins. Verify this matches expectations.

---

## Files Referenced

| Path | Description |
|------|-------------|
| `app/api/auth/register/route.js` | Registration API - has critical bug |
| `app/instructor/dashboard/page.jsx` | Instructor dashboard - profile lookup |
| `app/instructor/components/InstructorShell.jsx` | Shell with WhatsApp placeholder |
| `app/admin/components/Sidebar.jsx` | Admin sidebar navigation |
| `lib/email/index.js` | All email functions |
| `lib/instructors/actions.js` | Server actions for instructor management |
| `lib/schedule/sessions.js` | Session calculation with holidays |
| `lib/schedule/occurrences.js` | Date occurrence computation |
| `lib/certifications/status.js` | Dead code - can delete |
| `supabase/migrations/*.sql` | Database migrations |
