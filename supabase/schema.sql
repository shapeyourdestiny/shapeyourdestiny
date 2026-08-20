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
  role TEXT NOT NULL DEFAULT 'instructor',
  sent_to TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  used_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  role TEXT NOT NULL DEFAULT 'instructor',
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
