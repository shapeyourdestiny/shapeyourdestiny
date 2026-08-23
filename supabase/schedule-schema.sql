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
  created_at TIMESTAMPTZ DEFAULT now()
);

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

-- Migration: copy existing district_id to instructor_districts
-- Run this once after creating the table:
-- INSERT INTO instructor_districts (profile_id, district_id)
-- SELECT id, district_id FROM profiles WHERE district_id IS NOT NULL
-- ON CONFLICT DO NOTHING;

-- =============================================================================
-- HOLIDAYS TABLE
-- =============================================================================
-- Stores school holidays/off days that affect class scheduling

CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  name TEXT NOT NULL,
  district_id UUID REFERENCES districts(id) ON DELETE CASCADE, -- null = applies to all districts
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (date, district_id) -- can't have same date twice for same district (or global)
);

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
