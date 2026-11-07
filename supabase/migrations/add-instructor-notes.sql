-- =============================================================================
-- Instructor Notes System
-- =============================================================================
-- Admin-only notes system for instructors: reviews, pay changes, training,
-- communication, behavior, disciplinary actions, and recognition.
-- Run this migration in the Supabase SQL editor.
-- It is idempotent: safe to run multiple times.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. instructor_notes
-- Main notes table with support for different note types
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructor_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('review', 'pay', 'training', 'communication', 'behavior', 'disciplinary', 'recognition')),
  title text NOT NULL,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  body text,
  details jsonb DEFAULT '{}'::jsonb,
  -- Follow-up tracking
  follow_up_date date,
  follow_up_done_at timestamptz,
  follow_up_note text,
  -- Archive tracking (soft delete)
  archived_at timestamptz,
  archived_by uuid REFERENCES profiles(id),
  -- Audit fields
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE instructor_notes ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure clean state
DROP POLICY IF EXISTS "Admins can read instructor notes" ON instructor_notes;
DROP POLICY IF EXISTS "Admins can insert instructor notes" ON instructor_notes;
DROP POLICY IF EXISTS "Admins can update instructor notes" ON instructor_notes;

CREATE POLICY "Admins can read instructor notes" ON instructor_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert instructor notes" ON instructor_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update instructor notes" ON instructor_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete instructor notes" ON instructor_notes;
CREATE POLICY "Admins can delete instructor notes" ON instructor_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_instructor_notes_profile_date ON instructor_notes(profile_id, note_date DESC);
CREATE INDEX IF NOT EXISTS idx_instructor_notes_follow_up ON instructor_notes(follow_up_date) WHERE follow_up_done_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_instructor_notes_type ON instructor_notes(type);

-- -----------------------------------------------------------------------------
-- 2. instructor_note_versions
-- Edit history - snapshot of row before each update
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructor_note_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES instructor_notes(id) ON DELETE CASCADE,
  -- Snapshot of the note at version time
  type text NOT NULL,
  title text NOT NULL,
  note_date date NOT NULL,
  body text,
  details jsonb,
  follow_up_date date,
  follow_up_done_at timestamptz,
  follow_up_note text,
  -- Version metadata
  version_at timestamptz NOT NULL DEFAULT now(),
  version_by uuid REFERENCES profiles(id)
);

ALTER TABLE instructor_note_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read note versions" ON instructor_note_versions;
DROP POLICY IF EXISTS "Admins can insert note versions" ON instructor_note_versions;

CREATE POLICY "Admins can read note versions" ON instructor_note_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert note versions" ON instructor_note_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Index for finding versions by note
CREATE INDEX IF NOT EXISTS idx_instructor_note_versions_note ON instructor_note_versions(note_id, version_at DESC);

-- -----------------------------------------------------------------------------
-- 3. instructor_note_files
-- File attachments for notes
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS instructor_note_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES instructor_notes(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size int,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE instructor_note_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read note files" ON instructor_note_files;
DROP POLICY IF EXISTS "Admins can insert note files" ON instructor_note_files;
DROP POLICY IF EXISTS "Admins can delete note files" ON instructor_note_files;

CREATE POLICY "Admins can read note files" ON instructor_note_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert note files" ON instructor_note_files
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete note files" ON instructor_note_files
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Index for finding files by note
CREATE INDEX IF NOT EXISTS idx_instructor_note_files_note ON instructor_note_files(note_id);

-- -----------------------------------------------------------------------------
-- 4. Trigger: update updated_at and create version on update
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION instructor_notes_before_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Set updated_at
  NEW.updated_at = now();

  -- Insert old row into versions table
  INSERT INTO instructor_note_versions (
    note_id, type, title, note_date, body, details,
    follow_up_date, follow_up_done_at, follow_up_note,
    version_at, version_by
  ) VALUES (
    OLD.id, OLD.type, OLD.title, OLD.note_date, OLD.body, OLD.details,
    OLD.follow_up_date, OLD.follow_up_done_at, OLD.follow_up_note,
    OLD.updated_at, OLD.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS instructor_notes_version_trigger ON instructor_notes;
CREATE TRIGGER instructor_notes_version_trigger
  BEFORE UPDATE ON instructor_notes
  FOR EACH ROW
  EXECUTE FUNCTION instructor_notes_before_update();

-- =============================================================================
-- Storage Bucket Setup (Run in Supabase Dashboard -> Storage)
-- =============================================================================
-- 1. Create bucket named "instructor-notes" (private)
-- 2. Add the following policies:
--
-- SELECT policy (name: "Admins can read instructor note files"):
--   (
--     EXISTS (
--       SELECT 1 FROM profiles p
--       WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
--       AND p.role = 'admin'
--     )
--   )
--
-- INSERT policy (name: "Admins can upload instructor note files"):
--   (
--     EXISTS (
--       SELECT 1 FROM profiles p
--       WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
--       AND p.role = 'admin'
--     )
--   )
--
-- DELETE policy (name: "Admins can delete instructor note files"):
--   (
--     EXISTS (
--       SELECT 1 FROM profiles p
--       WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
--       AND p.role = 'admin'
--     )
--   )
--
-- Files should be stored as: {profile_id}/{note_id}/{filename}
-- =============================================================================

-- Done!
