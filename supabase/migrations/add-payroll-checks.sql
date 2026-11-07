-- =============================================================================
-- PAYROLL CHECKS TABLES
-- =============================================================================
-- Run this migration in Supabase SQL Editor.
-- It is idempotent - safe to run multiple times.

-- =============================================================================
-- 1. PAYROLL CHECKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed','flagged')),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, period_start)
);

CREATE INDEX IF NOT EXISTS payroll_checks_profile_idx ON payroll_checks(profile_id);
CREATE INDEX IF NOT EXISTS payroll_checks_period_idx ON payroll_checks(period_start, period_end);

-- =============================================================================
-- 2. PAYROLL CHECK ISSUES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_check_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES payroll_checks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('missing','wrong','other')),
  issue_date DATE,                 -- for "missing"
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  session_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,  -- for "wrong"
  session_date DATE,               -- for "wrong"
  note TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution_note TEXT,
  resolved_by UUID REFERENCES profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payroll_check_issues_check_idx ON payroll_check_issues(check_id);
CREATE INDEX IF NOT EXISTS payroll_check_issues_status_idx ON payroll_check_issues(status);

-- =============================================================================
-- 3. PAYROLL CHECK SETTINGS TABLE (single row)
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_check_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  confirm_offset_days INT NOT NULL DEFAULT 3,   -- deadline = period end + 3 days (Fri -> Mon)
  reminder_enabled BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO payroll_check_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. PAYROLL PERIOD NOTES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS payroll_period_notes (
  period_start DATE PRIMARY KEY,
  note TEXT CHECK (char_length(note) <= 200),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 5. RLS POLICIES
-- =============================================================================

-- Enable RLS
ALTER TABLE payroll_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_check_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_check_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_period_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (for idempotency)
DROP POLICY IF EXISTS "Admins can do everything with payroll_checks" ON payroll_checks;
DROP POLICY IF EXISTS "Instructors can read own payroll_checks" ON payroll_checks;
DROP POLICY IF EXISTS "Instructors can insert own payroll_checks" ON payroll_checks;

DROP POLICY IF EXISTS "Admins can do everything with payroll_check_issues" ON payroll_check_issues;
DROP POLICY IF EXISTS "Instructors can read own payroll_check_issues" ON payroll_check_issues;
DROP POLICY IF EXISTS "Instructors can insert own payroll_check_issues" ON payroll_check_issues;

DROP POLICY IF EXISTS "Admins can do everything with payroll_check_settings" ON payroll_check_settings;
DROP POLICY IF EXISTS "Anyone authenticated can read payroll_check_settings" ON payroll_check_settings;

DROP POLICY IF EXISTS "Admins can do everything with payroll_period_notes" ON payroll_period_notes;
DROP POLICY IF EXISTS "Anyone authenticated can read payroll_period_notes" ON payroll_period_notes;

-- PAYROLL_CHECKS policies

-- Admin full access
CREATE POLICY "Admins can do everything with payroll_checks"
  ON payroll_checks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Instructors can read their own checks
CREATE POLICY "Instructors can read own payroll_checks"
  ON payroll_checks
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles p
      WHERE p.user_id = auth.uid() OR p.id = auth.uid()
    )
  );

-- Instructors can insert their own checks
CREATE POLICY "Instructors can insert own payroll_checks"
  ON payroll_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles p
      WHERE p.user_id = auth.uid() OR p.id = auth.uid()
    )
  );

-- PAYROLL_CHECK_ISSUES policies

-- Admin full access
CREATE POLICY "Admins can do everything with payroll_check_issues"
  ON payroll_check_issues
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Instructors can read issues on their own checks
CREATE POLICY "Instructors can read own payroll_check_issues"
  ON payroll_check_issues
  FOR SELECT
  TO authenticated
  USING (
    check_id IN (
      SELECT pc.id FROM payroll_checks pc
      WHERE pc.profile_id IN (
        SELECT id FROM profiles p
        WHERE p.user_id = auth.uid() OR p.id = auth.uid()
      )
    )
  );

-- Instructors can insert issues on their own checks
CREATE POLICY "Instructors can insert own payroll_check_issues"
  ON payroll_check_issues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_id IN (
      SELECT pc.id FROM payroll_checks pc
      WHERE pc.profile_id IN (
        SELECT id FROM profiles p
        WHERE p.user_id = auth.uid() OR p.id = auth.uid()
      )
    )
  );

-- PAYROLL_CHECK_SETTINGS policies

-- Admin full access
CREATE POLICY "Admins can do everything with payroll_check_settings"
  ON payroll_check_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Anyone authenticated can read settings
CREATE POLICY "Anyone authenticated can read payroll_check_settings"
  ON payroll_check_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- PAYROLL_PERIOD_NOTES policies

-- Admin full access
CREATE POLICY "Admins can do everything with payroll_period_notes"
  ON payroll_period_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Anyone authenticated can read period notes
CREATE POLICY "Anyone authenticated can read payroll_period_notes"
  ON payroll_period_notes
  FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- DONE
-- =============================================================================
-- After running this migration:
-- 1. payroll_checks stores instructor confirmations/flags for each pay period
-- 2. payroll_check_issues stores individual issues raised by instructors
-- 3. payroll_check_settings stores global settings (deadline offset, reminder toggle)
-- 4. payroll_period_notes stores admin notes per pay period
-- 5. RLS policies ensure:
--    - Admins have full access to everything
--    - Instructors can read/insert their own checks and issues
--    - Instructors cannot update once submitted
--    - Everyone can read settings and period notes
