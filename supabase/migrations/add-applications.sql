-- =============================================================================
-- INSTRUCTOR APPLICATIONS SYSTEM
-- =============================================================================
-- Run this migration in Supabase SQL Editor.
-- It is idempotent - safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. INSTRUCTOR APPLICATIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS instructor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  resume_path TEXT NOT NULL,
  resume_name TEXT NOT NULL,
  resume_size INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','reviewing','interview','hired','not_a_fit')),
  opened_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ,
  profile_id UUID REFERENCES profiles(id),
  ip_hash TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_applications_status ON instructor_applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created ON instructor_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_email ON instructor_applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_ip_hash ON instructor_applications(ip_hash, created_at);

-- Enable RLS
ALTER TABLE instructor_applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can read applications" ON instructor_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON instructor_applications;

-- Admins can read all applications
CREATE POLICY "Admins can read applications" ON instructor_applications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Admins can update applications
CREATE POLICY "Admins can update applications" ON instructor_applications
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

-- No browser INSERT policy - inserts happen via service role only

-- =============================================================================
-- 2. APPLICATION NOTES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS instructor_application_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES instructor_applications(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  body TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_notes_app ON instructor_application_notes(application_id, created_at DESC);

-- Enable RLS
ALTER TABLE instructor_application_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage application notes" ON instructor_application_notes;

-- Admins can manage notes
CREATE POLICY "Admins can manage application notes" ON instructor_application_notes
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

-- =============================================================================
-- 3. HIRING SETTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS hiring_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hiring_open BOOLEAN NOT NULL DEFAULT true,
  notify_emails TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row if not exists
INSERT INTO hiring_settings (id, hiring_open, notify_emails)
VALUES (1, true, '{}')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE hiring_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read hiring_settings" ON hiring_settings;
DROP POLICY IF EXISTS "Admins can update hiring_settings" ON hiring_settings;

-- Anyone can read (needed for public page to check if hiring is open)
CREATE POLICY "Anyone can read hiring_settings" ON hiring_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only admins can update
CREATE POLICY "Admins can update hiring_settings" ON hiring_settings
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
--
-- AFTER RUNNING THIS MIGRATION:
--
-- 1. Create a PRIVATE storage bucket called "resumes" in the Supabase dashboard:
--    - Go to Storage > Create bucket
--    - Name: resumes
--    - Public: OFF (unchecked)
--    - File size limit: 10MB
--    - Allowed MIME types: application/pdf, application/msword,
--      application/vnd.openxmlformats-officedocument.wordprocessingml.document
--
-- 2. The app uses signed URLs (created server-side after verifyAdmin) to access resumes.
--    No RLS policies are needed on the bucket since we use the service role.
-- =============================================================================
