-- =============================================================================
-- STAFF PAGE SCHEMA
-- =============================================================================
-- Adds public profile fields to profiles table and creates a secure view
-- for the public /our-team page.
--
-- Run this in Supabase SQL Editor after the main schema.sql
-- =============================================================================

-- =============================================================================
-- ADD PUBLIC PROFILE COLUMNS TO PROFILES
-- =============================================================================

-- Display name shown on staff page (falls back to full_name if null)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Job title (e.g., "Lead Instructor", "Sports Coach")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT;

-- Short bio (280 chars max, enforced in application)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Path to headshot in staff-headshots storage bucket
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS headshot_path TEXT;

-- Section on staff page: 'leadership' or 'instructor'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS staff_section TEXT NOT NULL DEFAULT 'instructor'
  CHECK (staff_section IN ('leadership', 'instructor'));

-- Sort order within section (lower = first)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS staff_sort_order INT NOT NULL DEFAULT 0;

-- Toggle to hide from staff page without deactivating account
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_on_staff_page BOOLEAN NOT NULL DEFAULT true;

-- Optional quote (for leadership section)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS staff_quote TEXT;

-- =============================================================================
-- STORAGE BUCKET: STAFF HEADSHOTS
-- =============================================================================
-- Private bucket - we generate signed URLs server-side for active staff only

INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-headshots', 'staff-headshots', false)
ON CONFLICT (id) DO NOTHING;

-- Admins can upload headshots
CREATE POLICY "Admins can upload staff headshots"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'staff-headshots' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can read all headshots (for admin UI)
CREATE POLICY "Admins can read staff headshots"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'staff-headshots' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update headshots
CREATE POLICY "Admins can update staff headshots"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'staff-headshots' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete headshots
CREATE POLICY "Admins can delete staff headshots"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'staff-headshots' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- PUBLIC STAFF VIEW (SECURITY DEFINER FUNCTION)
-- =============================================================================
-- Returns only public-safe fields for staff who:
-- 1. Have an active account (status = 'active')
-- 2. Are visible on staff page (show_on_staff_page = true)
-- 3. Have a linked auth.users entry (account exists)
--
-- Programs are derived from class_assignments -> classes.program

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
  WHERE p.status = 'active'
    AND p.show_on_staff_page = true
    AND EXISTS (
      SELECT 1 FROM auth.users au WHERE au.id = p.id
    )
  ORDER BY
    CASE WHEN p.staff_section = 'leadership' THEN 0 ELSE 1 END,
    p.staff_sort_order,
    COALESCE(p.display_name, p.full_name);
$$;

-- Grant execute to anon so the public page can call it
GRANT EXECUTE ON FUNCTION public_staff() TO anon;
GRANT EXECUTE ON FUNCTION public_staff() TO authenticated;

-- =============================================================================
-- ENSURE PROFILES TABLE HAS NO ANON ACCESS
-- =============================================================================
-- The anon role should NOT be able to read profiles directly.
-- This is already the case (no anon policy exists), but let's be explicit.

-- Revoke any accidental grants (safe to run even if none exist)
REVOKE ALL ON profiles FROM anon;
