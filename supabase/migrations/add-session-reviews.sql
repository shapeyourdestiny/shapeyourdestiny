-- =============================================================================
-- SESSION REVIEWS SYSTEM
-- =============================================================================
-- Run this migration in Supabase SQL Editor.
-- It is idempotent - safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. SESSION REVIEWS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS session_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  session_start DATE NOT NULL,
  session_end DATE NOT NULL,
  classes_taught INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted')),
  overall SMALLINT CHECK (overall BETWEEN 1 AND 5),
  kids_growth SMALLINT CHECK (kids_growth BETWEEN 1 AND 5),
  support SMALLINT CHECK (support BETWEEN 1 AND 5),
  went_well TEXT,
  change_next TEXT,
  needs TEXT,
  due_date DATE NOT NULL,
  emailed_at TIMESTAMPTZ,
  reminders_sent INT NOT NULL DEFAULT 0,
  reminded_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, class_id, session_end)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_reviews_profile ON session_reviews(profile_id);
CREATE INDEX IF NOT EXISTS idx_session_reviews_class ON session_reviews(class_id);
CREATE INDEX IF NOT EXISTS idx_session_reviews_status ON session_reviews(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_session_reviews_due ON session_reviews(due_date) WHERE status = 'pending';

-- =============================================================================
-- 2. SESSION REVIEW COWORKERS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS session_review_coworkers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES session_reviews(id) ON DELETE CASCADE,
  coworker_id UUID NOT NULL REFERENCES profiles(id),
  classes_together INT NOT NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  UNIQUE (review_id, coworker_id)
);

CREATE INDEX IF NOT EXISTS idx_session_review_coworkers_review ON session_review_coworkers(review_id);
CREATE INDEX IF NOT EXISTS idx_session_review_coworkers_coworker ON session_review_coworkers(coworker_id);

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE session_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_review_coworkers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage session_reviews" ON session_reviews;
DROP POLICY IF EXISTS "Instructors can read own session_reviews" ON session_reviews;
DROP POLICY IF EXISTS "Instructors can update own pending session_reviews" ON session_reviews;

DROP POLICY IF EXISTS "Admins can manage session_review_coworkers" ON session_review_coworkers;
DROP POLICY IF EXISTS "Instructors can read own session_review_coworkers" ON session_review_coworkers;
DROP POLICY IF EXISTS "Instructors can update own pending coworker ratings" ON session_review_coworkers;

-- Admins can do everything
CREATE POLICY "Admins can manage session_reviews" ON session_reviews
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Instructors can read their own reviews
CREATE POLICY "Instructors can read own session_reviews" ON session_reviews
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = profile_id
    )
  );

-- Instructors can update their own pending reviews (only answer fields)
CREATE POLICY "Instructors can update own pending session_reviews" ON session_reviews
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = profile_id
    )
    AND status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = profile_id
    )
  );

-- Admins can do everything with coworkers
CREATE POLICY "Admins can manage session_review_coworkers" ON session_review_coworkers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Instructors can read coworker rows for their own reviews
-- IMPORTANT: Cannot see rows where they are the coworker being rated
CREATE POLICY "Instructors can read own session_review_coworkers" ON session_review_coworkers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM session_reviews sr
      JOIN profiles p ON (p.user_id = auth.uid() OR p.id = auth.uid())
      WHERE sr.id = review_id
      AND sr.profile_id = p.id
    )
    -- The rated coworker cannot see rows about themselves
    AND NOT EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = coworker_id
    )
  );

-- Instructors can update coworker ratings for their own pending reviews
CREATE POLICY "Instructors can update own pending coworker ratings" ON session_review_coworkers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM session_reviews sr
      JOIN profiles p ON (p.user_id = auth.uid() OR p.id = auth.uid())
      WHERE sr.id = review_id
      AND sr.profile_id = p.id
      AND sr.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_reviews sr
      JOIN profiles p ON (p.user_id = auth.uid() OR p.id = auth.uid())
      WHERE sr.id = review_id
      AND sr.profile_id = p.id
      AND sr.status = 'pending'
    )
  );

-- =============================================================================
-- 4. FUNCTION: Get pending reviews for current instructor
-- =============================================================================

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
  created_at TIMESTAMPTZ
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
    sr.created_at
  FROM session_reviews sr
  JOIN classes c ON c.id = sr.class_id
  JOIN schools s ON s.id = c.school_id
  WHERE sr.profile_id = caller_profile_id
    AND sr.status = 'pending'
  ORDER BY sr.due_date ASC;
END;
$$;

-- =============================================================================
-- 5. FUNCTION: Get shout-outs received during a session (for review page)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_session_shoutouts(
  p_profile_id UUID,
  p_class_id UUID,
  p_session_start DATE,
  p_session_end DATE
)
RETURNS TABLE (
  id UUID,
  from_first_name TEXT,
  message TEXT,
  reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    so.id,
    split_part(pr.full_name, ' ', 1) AS from_first_name,
    COALESCE(so.approved_message, so.message) AS message,
    so.reviewed_at
  FROM shout_outs so
  JOIN profiles pr ON pr.id = so.from_profile_id
  WHERE so.to_profile_id = p_profile_id
    AND so.status = 'approved'
    AND so.context_class_id = p_class_id
    AND so.context_date >= p_session_start
    AND so.context_date <= p_session_end
  ORDER BY so.reviewed_at DESC NULLS LAST
  LIMIT 3;
END;
$$;

-- =============================================================================
-- DONE
-- =============================================================================
