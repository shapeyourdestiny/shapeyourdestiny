-- =============================================================================
-- ADD END TIME TO CLASSES
-- =============================================================================
-- Tracks the end time of each class session
-- Combined with start time (time column), this is used to auto-calculate hours_per_day

ALTER TABLE classes ADD COLUMN IF NOT EXISTS end_time TEXT;
