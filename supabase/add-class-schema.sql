-- Add Class Feature - Schema Changes
-- Run this manually in the Supabase SQL editor

-- 1. Add new columns to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS program text NOT NULL DEFAULT 'wellness'
  CHECK (program IN ('wellness', 'soccer'));

ALTER TABLE classes ADD COLUMN IF NOT EXISTS start_date date;

-- target_sessions: The number of actual sessions to run for this class.
-- NULL means "ongoing, no end date" - the class continues indefinitely.
-- A number means "keep this class running, per selected weekday, until that
-- many actual (non-skipped) sessions have occurred." This is NOT a fixed
-- calendar window - if holidays or off days fall within the range, the
-- computed end date extends further out to still deliver the target count.
-- This is the core behavior the Add Class feature depends on.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS target_sessions integer;

-- 2. Create program_off_days table
-- This is deliberately separate from the holidays table:
-- - holidays: org-wide, school closed, affects ALL programs and instructor schedules
-- - program_off_days: program-specific (e.g., soccer field trip doesn't affect wellness sessions)
CREATE TABLE IF NOT EXISTS program_off_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program text NOT NULL CHECK (program IN ('wellness', 'soccer')),
  date date NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(program, date)
);

-- 3. Enable RLS on program_off_days
ALTER TABLE program_off_days ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy
CREATE POLICY "Admins can read program_off_days" ON program_off_days
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin-only insert policy
CREATE POLICY "Admins can insert program_off_days" ON program_off_days
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin-only delete policy
CREATE POLICY "Admins can delete program_off_days" ON program_off_days
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin-only update policy
CREATE POLICY "Admins can update program_off_days" ON program_off_days
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
