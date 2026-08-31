-- =============================================================================
-- SCHEDULE BOARD SCHEMA
-- =============================================================================
-- Run this in the Supabase SQL editor after the main schema.sql
-- =============================================================================

-- Districts (top-level grouping for schools)
CREATE TABLE IF NOT EXISTS districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT NOT NULL, -- hex value like '#3E8FA0'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
CREATE POLICY "Admins can read districts"
  ON districts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin-only write access
CREATE POLICY "Admins can insert districts"
  ON districts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update districts"
  ON districts
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

CREATE POLICY "Admins can delete districts"
  ON districts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Schools (belong to a district)
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT, -- Full address for directions (e.g., "123 Main St, City, CA 90210")
  created_at TIMESTAMPTZ DEFAULT now()
);

-- If schools table already exists, add address column
ALTER TABLE schools ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read schools"
  ON schools
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert schools"
  ON schools
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update schools"
  ON schools
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

CREATE POLICY "Admins can delete schools"
  ON schools
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Classes (belong to a school, have recurring days/times)
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  days TEXT[] NOT NULL, -- array of 'Mon'/'Tue'/'Wed'/'Thu'/'Fri'
  time TEXT NOT NULL, -- display format like "2:30pm"
  is_review_day BOOLEAN DEFAULT false,
  start_date DATE, -- when the program starts
  num_weeks INTEGER DEFAULT 8, -- how many weeks the program runs
  created_at TIMESTAMPTZ DEFAULT now()
);

-- If classes table already exists, add the new columns
ALTER TABLE classes ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS num_weeks INTEGER DEFAULT 8;

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read classes"
  ON classes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert classes"
  ON classes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update classes"
  ON classes
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

CREATE POLICY "Admins can delete classes"
  ON classes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Class assignments (links instructors to class slots)
CREATE TABLE IF NOT EXISTS class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('instructor_1', 'instructor_2', 'admin_review')),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Each slot in a class can only be filled once
  UNIQUE (class_id, slot_type),
  -- Same person can't fill two slots on the same class
  UNIQUE (class_id, profile_id)
);

ALTER TABLE class_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read class_assignments"
  ON class_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert class_assignments"
  ON class_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update class_assignments"
  ON class_assignments
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

CREATE POLICY "Admins can delete class_assignments"
  ON class_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Add color to profiles for instructor chip color (optional, can inherit from district)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS color TEXT;

-- Junction table for instructors belonging to multiple districts
CREATE TABLE IF NOT EXISTS instructor_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, district_id)
);

ALTER TABLE instructor_districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read instructor_districts"
  ON instructor_districts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert instructor_districts"
  ON instructor_districts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete instructor_districts"
  ON instructor_districts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- =============================================================================
-- HOLIDAYS TABLE
-- =============================================================================
-- Stores school holidays/off days that affect class scheduling
-- Hierarchy: school_id takes precedence over district_id
-- - school_id set: applies only to that specific school
-- - district_id set (school_id null): applies to all schools in that district
-- - both null: applies to all schools globally

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  district_id UUID REFERENCES districts(id) ON DELETE CASCADE, -- null = applies to all districts
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE, -- null = applies to all schools (in district or globally)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (date, district_id, school_id) -- can't have same date twice for same scope
);

-- Add school_id column if holidays table already exists
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Drop old constraint and add new one (safe to run multiple times)
ALTER TABLE holidays DROP CONSTRAINT IF EXISTS holidays_date_district_id_key;
ALTER TABLE holidays ADD CONSTRAINT holidays_date_district_id_school_id_key UNIQUE (date, district_id, school_id);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read holidays"
  ON holidays
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert holidays"
  ON holidays
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update holidays"
  ON holidays
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

CREATE POLICY "Admins can delete holidays"
  ON holidays
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- =============================================================================
-- INSTRUCTOR READ ACCESS
-- =============================================================================
-- Instructors need read access to see their own schedules

-- Instructors can read holidays (shared calendar for everyone)
-- Note: If district-specific holidays are needed later, add a nullable
-- district_id column referencing districts, where null means "applies to everyone."
CREATE POLICY "Instructors can read holidays"
  ON holidays
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can read schools (need school name/address for their sessions)
CREATE POLICY "Instructors can read schools"
  ON schools
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can read classes (need class info for their sessions)
CREATE POLICY "Instructors can read classes"
  ON classes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can read class_assignments (need to see their own assignments + co-teachers)
CREATE POLICY "Instructors can read class_assignments"
  ON class_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );

-- Instructors can read districts (need district info for context)
CREATE POLICY "Instructors can read districts"
  ON districts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'instructor'
    )
  );
