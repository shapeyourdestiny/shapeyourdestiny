-- =============================================================================
-- ADD TIME PERIOD TO PROGRAM OFF DAYS
-- =============================================================================
-- Allows marking program off days as affecting only AM or PM classes
-- Values: 'all_day' (default), 'am', 'pm'

ALTER TABLE program_off_days ADD COLUMN IF NOT EXISTS time_period TEXT DEFAULT 'all_day';

-- Add check constraint for valid values
ALTER TABLE program_off_days DROP CONSTRAINT IF EXISTS program_off_days_time_period_check;
ALTER TABLE program_off_days ADD CONSTRAINT program_off_days_time_period_check
  CHECK (time_period IN ('all_day', 'am', 'pm'));
