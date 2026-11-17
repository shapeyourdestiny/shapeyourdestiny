-- =============================================================================
-- ENHANCE SESSION REVIEWS
-- =============================================================================
-- Adds new fields for a more comprehensive end-of-session review:
-- - school_support: Rating of support from the school staff
-- - self_assessment: Instructor's self-rating of their performance
-- - school_feedback: Text feedback about the school relationship
-- - team_feedback: Text feedback about team collaboration
-- =============================================================================

-- Add new rating columns
ALTER TABLE session_reviews
ADD COLUMN IF NOT EXISTS school_support SMALLINT CHECK (school_support BETWEEN 1 AND 5);

ALTER TABLE session_reviews
ADD COLUMN IF NOT EXISTS self_assessment SMALLINT CHECK (self_assessment BETWEEN 1 AND 5);

-- Add new text feedback columns
ALTER TABLE session_reviews
ADD COLUMN IF NOT EXISTS school_feedback TEXT;

ALTER TABLE session_reviews
ADD COLUMN IF NOT EXISTS team_feedback TEXT;

-- =============================================================================
-- DONE
-- =============================================================================
