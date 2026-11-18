-- =============================================================================
-- UPDATE SESSION REVIEWS TIMING
-- =============================================================================
-- Changes to support semester reviews being created on final class day morning:
-- 1. Add available_at column - when the review becomes visible to instructor
-- 2. Update my_pending_session_reviews function to filter by available_at
-- =============================================================================

-- Add available_at column
-- Review is created in the morning but only becomes available when class starts
ALTER TABLE session_reviews
ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ;

-- Drop the existing function first (return type is changing to include available_at)
DROP FUNCTION IF EXISTS my_pending_session_reviews();

-- Recreate the function with available_at in the return type
CREATE OR REPLACE FUNCTION my_pending_session_reviews()
RETURNS TABLE (
  id UUID,
  class_id UUID,
  school_name TEXT,
  program TEXT,
  session_start DATE,
  session_end DATE,
  classes_taught INT,
  due_date DATE,
  created_at TIMESTAMPTZ,
  available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
BEGIN
  SELECT p.id INTO caller_profile_id
  FROM profiles p
  WHERE p.user_id = auth.uid() OR p.id = auth.uid()
  LIMIT 1;

  IF caller_profile_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sr.id,
    sr.class_id,
    s.name AS school_name,
    c.program,
    sr.session_start,
    sr.session_end,
    sr.classes_taught,
    sr.due_date,
    sr.created_at,
    sr.available_at
  FROM session_reviews sr
  JOIN classes c ON c.id = sr.class_id
  JOIN schools s ON s.id = c.school_id
  WHERE sr.profile_id = caller_profile_id
    AND sr.status = 'pending'
    AND (sr.available_at IS NULL OR sr.available_at <= NOW())
  ORDER BY sr.due_date ASC;
END;
$$;

-- =============================================================================
-- DONE
-- =============================================================================
