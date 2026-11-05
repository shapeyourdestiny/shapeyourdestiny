-- =============================================================================
-- DATABASE AUDIT CHECKS
-- =============================================================================
-- Run these in the Supabase SQL Editor (read-only queries).
-- Paste each section one at a time and note the results.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CHECK WHICH MIGRATIONS HAVE BEEN RUN
-- -----------------------------------------------------------------------------

-- Check if user_id column exists on profiles (add-unlinked-profiles.sql)
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'user_id'
) AS has_user_id_column;

-- Check if school details columns exist (add-school-details.sql)
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'schools'
    AND column_name = 'instructions'
) AS has_school_instructions,
EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'schools'
    AND column_name = 'office_contact'
) AS has_office_contact,
EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'schools'
    AND column_name = 'office_phone'
) AS has_office_phone;

-- Check if holiday time_period column exists (add-holiday-time-period.sql)
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'holidays'
    AND column_name = 'time_period'
) AS has_holiday_time_period;

-- Check if payroll tables exist (add-payroll.sql)
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_periods') AS has_payroll_periods,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_settings') AS has_payroll_settings,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instructor_pay_rates') AS has_instructor_pay_rates,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_lines') AS has_payroll_lines,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_adjustments') AS has_payroll_adjustments;

-- Check if invite_codes has profile_id column (add-unlinked-profiles.sql)
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'invite_codes'
    AND column_name = 'profile_id'
) AS has_invite_profile_id,
EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'invite_codes'
    AND column_name = 'expires_at'
) AS has_invite_expires_at;

-- -----------------------------------------------------------------------------
-- 2. CHECK RLS POLICIES
-- -----------------------------------------------------------------------------

-- List all RLS policies on key tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'classes', 'class_assignments', 'schools', 'districts', 'holidays', 'incident_reports', 'invite_codes')
ORDER BY tablename, policyname;

-- -----------------------------------------------------------------------------
-- 3. CHECK PROFILES USER_ID STATUS
-- -----------------------------------------------------------------------------

-- Count profiles by user_id status
SELECT
  CASE
    WHEN user_id IS NOT NULL THEN 'has_user_id'
    ELSE 'no_user_id'
  END AS status,
  COUNT(*) as count
FROM profiles
GROUP BY 1;

-- Find profiles where user_id differs from id (should be pre-created profiles)
SELECT id, user_id, full_name, status, role
FROM profiles
WHERE user_id IS NOT NULL AND user_id != id;

-- Find profiles with status 'not_invited' or 'invited' that have no user_id
SELECT id, full_name, status, role, user_id
FROM profiles
WHERE status IN ('not_invited', 'invited')
ORDER BY status;

-- -----------------------------------------------------------------------------
-- 4. CHECK DATA INTEGRITY
-- -----------------------------------------------------------------------------

-- Classes with no instructor assigned
SELECT c.id, s.name AS school_name, c.days, c.time, c.start_date
FROM classes c
JOIN schools s ON s.id = c.school_id
WHERE NOT EXISTS (
  SELECT 1 FROM class_assignments ca
  WHERE ca.class_id = c.id
    AND ca.slot_type IN ('instructor_1', 'instructor_2')
);

-- Schools with no address
SELECT id, name, district_id
FROM schools
WHERE address IS NULL OR address = '';

-- Orphaned class_assignments (no matching class)
SELECT ca.id, ca.class_id, ca.profile_id
FROM class_assignments ca
WHERE NOT EXISTS (
  SELECT 1 FROM classes c WHERE c.id = ca.class_id
);

-- Orphaned class_assignments (no matching profile)
SELECT ca.id, ca.class_id, ca.profile_id
FROM class_assignments ca
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = ca.profile_id
);

-- Invite codes marked as used but no matching profile
SELECT ic.id, ic.code, ic.used_by, ic.role
FROM invite_codes ic
WHERE ic.used_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = ic.used_by
  );

-- Archived profiles still assigned to active classes
SELECT p.id, p.full_name, p.status, c.id as class_id, s.name as school_name
FROM profiles p
JOIN class_assignments ca ON ca.profile_id = p.id
JOIN classes c ON c.id = ca.class_id
JOIN schools s ON s.id = c.school_id
WHERE p.status = 'archived';

-- -----------------------------------------------------------------------------
-- 5. CHECK INCIDENT REPORTS
-- -----------------------------------------------------------------------------

-- Count incident reports by status
SELECT status, COUNT(*) as count
FROM incident_reports
GROUP BY status;

-- Open incident reports
SELECT id, severity, type, occurred_at, school_id
FROM incident_reports
WHERE status = 'open'
ORDER BY occurred_at DESC;

-- -----------------------------------------------------------------------------
-- 6. CHECK HOLIDAYS AND PROGRAM OFF DAYS
-- -----------------------------------------------------------------------------

-- Upcoming holidays
SELECT id, date, name, district_id, school_id, time_period
FROM holidays
WHERE date >= CURRENT_DATE
ORDER BY date
LIMIT 20;

-- Upcoming program off days
SELECT id, date, reason, program
FROM program_off_days
WHERE date >= CURRENT_DATE
ORDER BY date
LIMIT 20;

-- -----------------------------------------------------------------------------
-- 7. ADMIN USERS
-- -----------------------------------------------------------------------------

-- List all admin profiles
SELECT id, full_name, user_id, status
FROM profiles
WHERE role = 'admin';
