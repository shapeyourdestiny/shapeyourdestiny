-- =============================================================================
-- PAYROLL SCHEMA UPDATES
-- =============================================================================
-- Run this AFTER add-payroll.sql has been applied.
-- It is idempotent: safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add 'nothing_to_pay' status to payroll_periods
-- -----------------------------------------------------------------------------
ALTER TABLE payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_status_check;
ALTER TABLE payroll_periods ADD CONSTRAINT payroll_periods_status_check
  CHECK (status IN ('open', 'approved', 'paid', 'nothing_to_pay'));

-- -----------------------------------------------------------------------------
-- 2. Add classes_override to payroll_line_overrides
-- -----------------------------------------------------------------------------
ALTER TABLE payroll_line_overrides
  ADD COLUMN IF NOT EXISTS classes_override NUMERIC(4,2);

-- -----------------------------------------------------------------------------
-- 3. Add classes and source to payroll_lines
-- -----------------------------------------------------------------------------
ALTER TABLE payroll_lines
  ADD COLUMN IF NOT EXISTS classes NUMERIC(4,2) NOT NULL DEFAULT 1;

ALTER TABLE payroll_lines
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Add check constraint for source
ALTER TABLE payroll_lines DROP CONSTRAINT IF EXISTS payroll_lines_source_check;
ALTER TABLE payroll_lines ADD CONSTRAINT payroll_lines_source_check
  CHECK (source IS NULL OR source IN ('taught', 'subbed'));

-- -----------------------------------------------------------------------------
-- 4. Ensure payroll_settings has class check settings
-- -----------------------------------------------------------------------------
-- Note: payroll_check_settings already exists from add-payroll-checks.sql
-- We don't need to duplicate it in payroll_settings

-- -----------------------------------------------------------------------------
-- Done!
-- -----------------------------------------------------------------------------
