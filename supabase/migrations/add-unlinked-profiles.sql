-- =============================================================================
-- MIGRATION: Add Unlinked Profiles (Add Before Sign-up)
-- =============================================================================
-- This migration allows creating instructor profiles BEFORE they have accounts.
-- Key changes:
-- 1. Add user_id column (nullable) for linking to auth.users
-- 2. Add 'not_invited' status for pre-account profiles
-- 3. Extend invite_codes with profile_id and expires_at
-- 4. Update RLS policies
-- 5. Update public_staff() to show not_invited profiles
-- =============================================================================

-- Step 1: Add user_id column to profiles
-- This will store the auth.users.id when the user signs up
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Step 2: Migrate existing profiles - set user_id = id for all current profiles
-- (Current profiles have id = auth.users.id due to old FK constraint)
UPDATE profiles SET user_id = id WHERE user_id IS NULL;

-- Step 3: Update status CHECK constraint to include 'not_invited'
-- First drop the existing constraint, then add the new one
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'invited', 'archived', 'not_invited'));

-- Step 4: Extend invite_codes table
-- Add profile_id to link invites to pre-created profiles
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Add expires_at for 30-day expiry
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invite_codes_profile_id ON invite_codes(profile_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- Step 5: Update RLS policies for profiles

-- Drop existing policies that reference auth.uid() = id
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Recreate policies using user_id instead of id
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow inserting profile during registration (user_id = auth.uid())
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Step 6: Allow admins to insert profiles (for creating unlinked profiles)
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Step 7: Allow admins to update any profile
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'admin'
    )
  );

-- Step 8: Update public_staff() function to include not_invited profiles
CREATE OR REPLACE FUNCTION public_staff()
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  title TEXT,
  bio TEXT,
  headshot_path TEXT,
  staff_section TEXT,
  staff_sort_order INT,
  staff_quote TEXT,
  programs TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    p.id,
    COALESCE(p.display_name, p.full_name) AS display_name,
    p.title,
    p.bio,
    p.headshot_path,
    p.staff_section,
    p.staff_sort_order,
    p.staff_quote,
    COALESCE(
      (
        SELECT ARRAY_AGG(DISTINCT c.program)
        FROM class_assignments ca
        JOIN classes c ON c.id = ca.class_id
        WHERE ca.profile_id = p.id
      ),
      ARRAY[]::TEXT[]
    ) AS programs
  FROM profiles p
  WHERE p.status IN ('active', 'not_invited')
    AND p.show_on_staff_page = true
  ORDER BY
    CASE WHEN p.staff_section = 'leadership' THEN 0 ELSE 1 END,
    p.staff_sort_order,
    COALESCE(p.display_name, p.full_name);
$$;

-- Ensure grants are in place
GRANT EXECUTE ON FUNCTION public_staff() TO anon;
GRANT EXECUTE ON FUNCTION public_staff() TO authenticated;

-- =============================================================================
-- NOTES FOR IMPLEMENTATION
-- =============================================================================
-- After running this migration:
-- 1. New profiles can be created with user_id = NULL (not linked to auth user)
-- 2. When user signs up with invite code tied to a profile:
--    - Find the profile by invite_codes.profile_id
--    - Update profile.user_id = new auth.users.id
--    - Update profile.status = 'active'
-- 3. The public_staff page will show both 'active' and 'not_invited' profiles
-- =============================================================================
