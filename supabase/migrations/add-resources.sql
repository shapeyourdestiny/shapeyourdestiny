-- =============================================================================
-- RESOURCES SYSTEM
-- =============================================================================
-- Idempotent migration for the resources system (employee handbook, etc.)
-- NOTE: The storage bucket must be created via Supabase Dashboard:
--   1. Go to Storage > New bucket
--   2. Name: "resources"
--   3. Public bucket: OFF (private)
--   4. No additional policies needed - server uses service role key
-- =============================================================================

-- Resources metadata table
CREATE TABLE IF NOT EXISTS resources (
  key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  file_path TEXT,
  version_label TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- Insert default handbook row
INSERT INTO resources (key, title)
VALUES ('handbook', 'Employee handbook')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Instructors and admins can read resources" ON resources;
DROP POLICY IF EXISTS "Admins can update resources" ON resources;

-- Instructors and admins can read
CREATE POLICY "Instructors and admins can read resources" ON resources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role IN ('instructor', 'admin')
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update resources" ON resources
  FOR UPDATE TO authenticated
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

-- =============================================================================
-- DONE
-- =============================================================================
