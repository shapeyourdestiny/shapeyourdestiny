-- Survey Districts Migration
-- Run this migration to enable district-specific survey links
-- Usage: Run in Supabase SQL Editor or via supabase db push

-- =============================================================================
-- 1. CREATE SURVEY_SENDS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS survey_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_slug TEXT NOT NULL,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  link_slug TEXT NOT NULL,
  schools TEXT[] NOT NULL DEFAULT '{}',
  closes_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_slug, link_slug),
  UNIQUE (survey_slug, district_id)
);

-- Index for looking up sends by survey
CREATE INDEX IF NOT EXISTS survey_sends_survey_idx ON survey_sends (survey_slug, status);

-- =============================================================================
-- 2. ADD COLUMNS TO SURVEY_RESPONSES
-- =============================================================================

ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES districts(id) ON DELETE SET NULL;
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS send_id UUID REFERENCES survey_sends(id) ON DELETE SET NULL;

-- Index for filtering by district
CREATE INDEX IF NOT EXISTS survey_responses_district_idx ON survey_responses (survey_slug, district_id, submitted_at DESC);

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on survey_sends
ALTER TABLE survey_sends ENABLE ROW LEVEL SECURITY;

-- Only admins can read survey_sends
DROP POLICY IF EXISTS "Admins can read survey_sends" ON survey_sends;
CREATE POLICY "Admins can read survey_sends"
  ON survey_sends
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can insert survey_sends
DROP POLICY IF EXISTS "Admins can insert survey_sends" ON survey_sends;
CREATE POLICY "Admins can insert survey_sends"
  ON survey_sends
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can update survey_sends
DROP POLICY IF EXISTS "Admins can update survey_sends" ON survey_sends;
CREATE POLICY "Admins can update survey_sends"
  ON survey_sends
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can delete survey_sends
DROP POLICY IF EXISTS "Admins can delete survey_sends" ON survey_sends;
CREATE POLICY "Admins can delete survey_sends"
  ON survey_sends
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 4. OPTIONAL: Assign existing responses to a district
-- Uncomment and modify the WHERE clause to match your needs
-- =============================================================================

-- UPDATE survey_responses
-- SET district_id = 'your-district-uuid-here'
-- WHERE survey_slug = 'soccer-feedback'
--   AND school IN ('School 1', 'School 2');
