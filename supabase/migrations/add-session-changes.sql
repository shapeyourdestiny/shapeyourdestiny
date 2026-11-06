-- =============================================================================
-- SESSION CHANGES TABLE
-- =============================================================================
-- Tracks instructor absences and substitutions for specific class sessions.
-- Each row represents a change to a single session (one class on one date).
-- For multi-day absences, multiple rows share the same absence_group_id.

CREATE TABLE IF NOT EXISTS session_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('instructor_1', 'instructor_2')),
  absent_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sub_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT, -- 'vacation', 'sick', 'emergency', 'other', or custom text
  note TEXT, -- admin-only notes
  absence_group_id UUID, -- links related session_changes for multi-day absences
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Each slot on each session can only have one change entry
  UNIQUE (class_id, session_date, slot_type)
);

-- Index for efficient date range queries
CREATE INDEX IF NOT EXISTS session_changes_date_idx ON session_changes(session_date);
-- Index for finding all changes in an absence group
CREATE INDEX IF NOT EXISTS session_changes_absence_group_idx ON session_changes(absence_group_id);

ALTER TABLE session_changes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- ADMIN POLICIES (full CRUD)
-- =============================================================================

CREATE POLICY "Admins can read session_changes"
  ON session_changes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert session_changes"
  ON session_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update session_changes"
  ON session_changes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete session_changes"
  ON session_changes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- =============================================================================
-- INSTRUCTOR VIEW (excludes reason and note for privacy)
-- =============================================================================
-- Instructors can see session changes where they are the absent instructor
-- or the substitute, but they cannot see reasons/notes.

CREATE OR REPLACE VIEW session_changes_instructor_view AS
SELECT
  id,
  class_id,
  session_date,
  slot_type,
  absent_profile_id,
  sub_profile_id,
  absence_group_id,
  created_at
FROM session_changes;

-- Grant select on the view to authenticated users
GRANT SELECT ON session_changes_instructor_view TO authenticated;

-- RLS policy for instructors to read via the view
-- This allows instructors to see changes where they are involved
CREATE POLICY "Instructors can read their session_changes"
  ON session_changes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'instructor'
        AND (
          session_changes.absent_profile_id = auth.uid()
          OR session_changes.sub_profile_id = auth.uid()
        )
    )
  );
