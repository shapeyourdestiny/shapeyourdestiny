-- =============================================================================
-- SETUP INSTRUCTIONS
-- =============================================================================
-- 1. Go to your Supabase project dashboard: https://supabase.com/dashboard
-- 2. Select your project (or create one)
-- 3. Go to SQL Editor (left sidebar)
-- 4. Paste this entire file and click "Run"
-- 5. Verify tables were created in Table Editor
-- =============================================================================

-- Test table to verify database connection works
CREATE TABLE IF NOT EXISTS ping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow the anon key to read/write this table (for testing only)
ALTER TABLE ping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to ping"
  ON ping
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- INSTRUCTOR AUTH TABLES
-- =============================================================================

-- Invite codes for registration (admin creates these, instructors consume them)
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'instructor' CHECK (role IN ('instructor', 'admin')),
  sent_to TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  used_by UUID REFERENCES auth.users(id),
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add archived column if table already exists
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can read invite codes (to check validity during registration)
CREATE POLICY "Anyone can read invite codes"
  ON invite_codes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can update (to mark as used)
CREATE POLICY "Authenticated users can update invite codes"
  ON invite_codes
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admins can insert invite codes
CREATE POLICY "Admins can insert invite codes"
  ON invite_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admins can delete unused invite codes
CREATE POLICY "Admins can delete invite codes"
  ON invite_codes
  FOR DELETE
  TO authenticated
  USING (
    used_by IS NULL AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- User profiles (extends auth.users with app-specific data)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'instructor' CHECK (role IN ('instructor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins can read all profiles (for instructor list)
CREATE POLICY "Admins can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Users can insert their own profile (during registration)
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add phone column for instructor contact info
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add certification expiration dates for instructors
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpr_expiration DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS food_handler_expiration DATE;

-- Add status column to replace archived boolean
-- Status values: 'active', 'invited', 'archived'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'invited', 'archived'));

-- Migration: Convert existing archived boolean values to status
-- Run this once, then the archived column can be removed in a future migration
DO $$
BEGIN
  -- Only run if archived column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'archived'
  ) THEN
    UPDATE profiles SET status = 'archived' WHERE archived = true;
    UPDATE profiles SET status = 'active' WHERE (archived = false OR archived IS NULL) AND status = 'active';
  END IF;
END $$;

-- =============================================================================
-- COVERAGE REQUESTS
-- =============================================================================
-- Tracks when an instructor needs coverage for a specific session.
-- Any active instructor can claim (not filtered by district).

CREATE TABLE IF NOT EXISTS coverage_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  posted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'cancelled')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  UNIQUE(class_id, date, requested_by)
);

ALTER TABLE coverage_requests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read coverage requests
CREATE POLICY "Authenticated users can read coverage requests"
  ON coverage_requests
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert coverage requests (posted on behalf of instructors)
CREATE POLICY "Admins can create coverage requests"
  ON coverage_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can update coverage requests (to claim or cancel)
CREATE POLICY "Users can update coverage requests"
  ON coverage_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Only admins can delete coverage requests
CREATE POLICY "Admins can delete coverage requests"
  ON coverage_requests
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
-- INCIDENT REPORTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'serious')),
  type TEXT NOT NULL CHECK (type IN ('Injury', 'Medical situation', 'Behavioral incident', 'Conflict between kids', 'Property damage', 'Other')),
  occurred_at TIMESTAMPTZ NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  location_note TEXT,
  involved TEXT,
  what_happened TEXT NOT NULL,
  actions_taken TEXT NOT NULL,
  first_aid_administered BOOLEAN NOT NULL,
  staff_notified BOOLEAN NOT NULL,
  staff_notified_name TEXT,
  parent_notified TEXT NOT NULL CHECK (parent_notified IN ('yes', 'no', 'n/a')),
  witnesses TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'closed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

-- Instructors can insert their own reports
CREATE POLICY "Instructors can insert own incident reports"
  ON incident_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Admins can read all incident reports
CREATE POLICY "Admins can read incident reports"
  ON incident_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update incident reports
CREATE POLICY "Admins can update incident reports"
  ON incident_reports
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
