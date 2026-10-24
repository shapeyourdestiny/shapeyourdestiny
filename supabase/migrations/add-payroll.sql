-- =============================================================================
-- Payroll System Tables
-- =============================================================================
-- Run this migration in the Supabase SQL editor.
-- It is idempotent: safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. instructor_pay_rates
-- Stores per-instructor rates, separate from profiles for privacy
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructor_pay_rates (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  rate_per_class numeric(8,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE instructor_pay_rates ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure clean state
DROP POLICY IF EXISTS "Admins can read pay rates" ON instructor_pay_rates;
DROP POLICY IF EXISTS "Admins can insert pay rates" ON instructor_pay_rates;
DROP POLICY IF EXISTS "Admins can update pay rates" ON instructor_pay_rates;
DROP POLICY IF EXISTS "Admins can delete pay rates" ON instructor_pay_rates;

CREATE POLICY "Admins can read pay rates" ON instructor_pay_rates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert pay rates" ON instructor_pay_rates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update pay rates" ON instructor_pay_rates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete pay rates" ON instructor_pay_rates
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. payroll_settings
-- Single-row config table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  anchor_date date NOT NULL DEFAULT '2026-09-05',
  period_days int NOT NULL DEFAULT 14,
  due_offset_days int NOT NULL DEFAULT 7,
  payday_offset_days int NOT NULL DEFAULT 14,
  reminder_emails text[] NOT NULL DEFAULT ARRAY['heather@shapeyourdestiny.co', 'destiny@shapeyourdestiny.co'],
  reminders jsonb NOT NULL DEFAULT '{"period_closed": true, "due_soon": true, "overdue": true}'::jsonb
);

ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read payroll settings" ON payroll_settings;
DROP POLICY IF EXISTS "Admins can update payroll settings" ON payroll_settings;

CREATE POLICY "Admins can read payroll settings" ON payroll_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update payroll settings" ON payroll_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Seed the settings row if it doesn't exist
INSERT INTO payroll_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. payroll_periods
-- Tracks each pay period's status
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date date NOT NULL UNIQUE,
  end_date date NOT NULL,
  due_date date NOT NULL,
  payday date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'paid')),
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id),
  paid_at timestamptz,
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read payroll periods" ON payroll_periods;
DROP POLICY IF EXISTS "Admins can insert payroll periods" ON payroll_periods;
DROP POLICY IF EXISTS "Admins can update payroll periods" ON payroll_periods;

CREATE POLICY "Admins can read payroll periods" ON payroll_periods
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert payroll periods" ON payroll_periods
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update payroll periods" ON payroll_periods
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Index for finding periods by date
CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(start_date, end_date);

-- -----------------------------------------------------------------------------
-- 4. payroll_line_overrides
-- "Don't pay" choices for open periods
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_line_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL,
  session_date date NOT NULL,
  pay boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_id, profile_id, class_id, session_date)
);

ALTER TABLE payroll_line_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read line overrides" ON payroll_line_overrides;
DROP POLICY IF EXISTS "Admins can insert line overrides" ON payroll_line_overrides;
DROP POLICY IF EXISTS "Admins can update line overrides" ON payroll_line_overrides;
DROP POLICY IF EXISTS "Admins can delete line overrides" ON payroll_line_overrides;

CREATE POLICY "Admins can read line overrides" ON payroll_line_overrides
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert line overrides" ON payroll_line_overrides
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM payroll_periods pp
      WHERE pp.id = period_id AND pp.status = 'open'
    )
  );

CREATE POLICY "Admins can update line overrides" ON payroll_line_overrides
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM payroll_periods pp
      WHERE pp.id = period_id AND pp.status = 'open'
    )
  );

CREATE POLICY "Admins can delete line overrides" ON payroll_line_overrides
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM payroll_periods pp
      WHERE pp.id = period_id AND pp.status = 'open'
    )
  );

-- -----------------------------------------------------------------------------
-- 5. payroll_adjustments
-- Bonuses, reimbursements, corrections
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  label text NOT NULL,
  note text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read adjustments" ON payroll_adjustments;
DROP POLICY IF EXISTS "Admins can insert adjustments" ON payroll_adjustments;
DROP POLICY IF EXISTS "Admins can update adjustments" ON payroll_adjustments;
DROP POLICY IF EXISTS "Admins can delete adjustments" ON payroll_adjustments;

CREATE POLICY "Admins can read adjustments" ON payroll_adjustments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert adjustments" ON payroll_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM payroll_periods pp
      WHERE pp.id = period_id AND pp.status = 'open'
    )
  );

-- No update policy - adjustments cannot be edited
CREATE POLICY "Admins can delete adjustments" ON payroll_adjustments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM payroll_periods pp
      WHERE pp.id = period_id AND pp.status = 'open'
    )
  );

-- Index for quick lookup by period
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_period ON payroll_adjustments(period_id);

-- -----------------------------------------------------------------------------
-- 6. payroll_lines
-- Locked snapshot of pay lines at approval time
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  instructor_name text NOT NULL,
  class_id uuid NOT NULL,
  school_name text NOT NULL,
  program text NOT NULL,
  session_date date NOT NULL,
  session_time text,
  slot_type text NOT NULL,
  rate numeric(8,2) NOT NULL,
  amount numeric(10,2) NOT NULL,
  paid boolean NOT NULL DEFAULT true,
  reason text
);

ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read payroll lines" ON payroll_lines;
DROP POLICY IF EXISTS "Admins can insert payroll lines" ON payroll_lines;

CREATE POLICY "Admins can read payroll lines" ON payroll_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Lines can only be inserted (at approval time), never updated or deleted
CREATE POLICY "Admins can insert payroll lines" ON payroll_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Index for quick lookup by period
CREATE INDEX IF NOT EXISTS idx_payroll_lines_period ON payroll_lines(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_lines_profile ON payroll_lines(period_id, profile_id);

-- -----------------------------------------------------------------------------
-- 7. payroll_activity
-- Activity log for each period (reminders, approvals, exports)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  kind text NOT NULL,
  text text NOT NULL,
  actor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read payroll activity" ON payroll_activity;
DROP POLICY IF EXISTS "Admins can insert payroll activity" ON payroll_activity;

CREATE POLICY "Admins can read payroll activity" ON payroll_activity
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert payroll activity" ON payroll_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Index for quick lookup by period
CREATE INDEX IF NOT EXISTS idx_payroll_activity_period ON payroll_activity(period_id, created_at);

-- -----------------------------------------------------------------------------
-- Done!
-- -----------------------------------------------------------------------------
