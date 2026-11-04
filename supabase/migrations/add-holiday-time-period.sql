-- =============================================================================
-- ADD TIME PERIOD TO HOLIDAYS
-- =============================================================================
-- Allows marking holidays/days off as affecting only AM or PM classes
-- Values: 'all_day' (default), 'am', 'pm'

ALTER TABLE holidays ADD COLUMN IF NOT EXISTS time_period TEXT DEFAULT 'all_day';

-- Add check constraint for valid values
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_time_period_check;
ALTER TABLE holidays ADD CONSTRAINT holidays_time_period_check
  CHECK (time_period IN ('all_day', 'am', 'pm'));

-- Update the unique constraint to include time_period
-- This allows having separate AM and PM entries for the same date if needed
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_date_district_id_school_id_key;
ALTER TABLE holidays ADD CONSTRAINT holidays_date_district_id_school_id_time_period_key
  UNIQUE (date, district_id, school_id, time_period);
