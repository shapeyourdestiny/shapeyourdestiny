-- =============================================================================
-- ADD END DATE TO CLASSES
-- =============================================================================
-- Store the actual end date instead of computing it from target_sessions
-- This ensures the end date the user enters is the exact end date used

ALTER TABLE classes ADD COLUMN IF NOT EXISTS end_date DATE;
