-- =============================================================================
-- ADD HOURS PER DAY TO CLASSES
-- =============================================================================
-- Tracks how many hours/classes a session counts for payroll purposes
-- 1 hour = 1 class paid. A 2-hour session means 2 classes for payroll.

ALTER TABLE classes ADD COLUMN IF NOT EXISTS hours_per_day INTEGER DEFAULT 1;

-- Add check constraint for valid values (1-4 hours)
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_hours_per_day_check;
ALTER TABLE classes ADD CONSTRAINT classes_hours_per_day_check
  CHECK (hours_per_day >= 1 AND hours_per_day <= 4);
