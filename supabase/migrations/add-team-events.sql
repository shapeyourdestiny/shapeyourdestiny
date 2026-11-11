-- =============================================================================
-- TEAM EVENTS SYSTEM
-- =============================================================================
-- Run this migration in Supabase SQL Editor.
-- It is idempotent - safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. TEAM EVENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('training', 'meeting', 'social')),
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  details TEXT,
  paid BOOLEAN NOT NULL DEFAULT false,
  pay_classes NUMERIC(4,1),
  required BOOLEAN NOT NULL DEFAULT true,
  audience JSONB NOT NULL DEFAULT '{"type":"all"}',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  sequence INT NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_events_date ON team_events(event_date);
CREATE INDEX IF NOT EXISTS idx_team_events_status ON team_events(status) WHERE status = 'scheduled';

-- =============================================================================
-- 2. TEAM EVENT PEOPLE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_event_people (
  event_id UUID NOT NULL REFERENCES team_events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  rsvp TEXT CHECK (rsvp IN ('yes', 'no')),
  rsvp_reason TEXT,
  rsvp_at TIMESTAMPTZ,
  attended BOOLEAN,
  marked_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_event_people_profile ON team_event_people(profile_id);
CREATE INDEX IF NOT EXISTS idx_team_event_people_event ON team_event_people(event_id);

-- =============================================================================
-- 3. MAPS APP PREFERENCE ON PROFILES
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS maps_app TEXT
  CHECK (maps_app IN ('apple', 'google', 'waze'));

-- =============================================================================
-- 4. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE team_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_event_people ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "Admins can manage team_events" ON team_events;
DROP POLICY IF EXISTS "Instructors can read invited team_events" ON team_events;

DROP POLICY IF EXISTS "Admins can manage team_event_people" ON team_event_people;
DROP POLICY IF EXISTS "Instructors can read own team_event_people" ON team_event_people;
DROP POLICY IF EXISTS "Instructors can update own rsvp" ON team_event_people;

-- =============================================================================
-- 4a. TEAM EVENTS POLICIES
-- =============================================================================

-- Admins can do everything
CREATE POLICY "Admins can manage team_events" ON team_events
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

-- Instructors can read events they're invited to
CREATE POLICY "Instructors can read invited team_events" ON team_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_event_people tep
      JOIN profiles p ON (p.user_id = auth.uid() OR p.id = auth.uid())
      WHERE tep.event_id = id
      AND tep.profile_id = p.id
    )
  );

-- =============================================================================
-- 4b. TEAM EVENT PEOPLE POLICIES
-- =============================================================================

-- Admins can do everything
CREATE POLICY "Admins can manage team_event_people" ON team_event_people
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

-- Instructors can read their own rows
CREATE POLICY "Instructors can read own team_event_people" ON team_event_people
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = profile_id
    )
  );

-- Instructors can update their own RSVP (only before event starts)
CREATE POLICY "Instructors can update own rsvp" ON team_event_people
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = profile_id
    )
    AND EXISTS (
      SELECT 1 FROM team_events te
      WHERE te.id = event_id
      AND (te.event_date > CURRENT_DATE
           OR (te.event_date = CURRENT_DATE AND te.start_time > CURRENT_TIME))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = profile_id
    )
  );

-- =============================================================================
-- 5. FUNCTION: Get team events for an instructor
-- =============================================================================

CREATE OR REPLACE FUNCTION my_team_events(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  event_date DATE,
  start_time TIME,
  end_time TIME,
  location TEXT,
  details TEXT,
  paid BOOLEAN,
  pay_classes NUMERIC,
  required BOOLEAN,
  status TEXT,
  rsvp TEXT,
  rsvp_reason TEXT,
  rsvp_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
BEGIN
  SELECT p.id INTO caller_profile_id
  FROM profiles p
  WHERE p.user_id = auth.uid() OR p.id = auth.uid()
  LIMIT 1;

  IF caller_profile_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    te.id,
    te.type,
    te.title,
    te.event_date,
    te.start_time,
    te.end_time,
    te.location,
    te.details,
    te.paid,
    te.pay_classes,
    te.required,
    te.status,
    tep.rsvp,
    tep.rsvp_reason,
    tep.rsvp_at
  FROM team_events te
  JOIN team_event_people tep ON tep.event_id = te.id
  WHERE tep.profile_id = caller_profile_id
    AND (p_start_date IS NULL OR te.event_date >= p_start_date)
    AND (p_end_date IS NULL OR te.event_date <= p_end_date)
  ORDER BY te.event_date ASC, te.start_time ASC;
END;
$$;

-- =============================================================================
-- DONE
-- =============================================================================
