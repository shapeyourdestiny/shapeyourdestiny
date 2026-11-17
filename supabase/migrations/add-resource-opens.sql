-- =============================================================================
-- RESOURCE OPENS TRACKING
-- =============================================================================
-- Tracks when instructors first open each version of a resource.
-- Used for "Opened by X of Y" stats on admin resources page.
-- =============================================================================

-- Resource opens table
CREATE TABLE IF NOT EXISTS resource_opens (
  resource_key TEXT NOT NULL REFERENCES resources(key),
  version_label TEXT NOT NULL,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (resource_key, version_label, profile_id)
);

-- Index for counting opens by version
CREATE INDEX IF NOT EXISTS resource_opens_key_version_idx
  ON resource_opens(resource_key, version_label);

-- Enable RLS
ALTER TABLE resource_opens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Admins can read resource opens" ON resource_opens;
DROP POLICY IF EXISTS "Server can insert resource opens" ON resource_opens;

-- Only admins can read
CREATE POLICY "Admins can read resource opens" ON resource_opens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- =============================================================================
-- ADD COLUMNS TO RESOURCES TABLE
-- =============================================================================

-- Add file metadata columns
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS file_size INT;

ALTER TABLE resources
ADD COLUMN IF NOT EXISTS page_count INT;

ALTER TABLE resources
ADD COLUMN IF NOT EXISTS file_name TEXT;

-- =============================================================================
-- ADD LESSON PLANS ROW
-- =============================================================================

INSERT INTO resources (key, title)
VALUES ('lesson_plans', 'Lesson plans')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- DONE
-- =============================================================================
