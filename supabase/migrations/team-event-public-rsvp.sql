-- =============================================================================
-- PUBLIC RSVP FOR TEAM EVENTS
-- =============================================================================
-- Run this migration in Supabase SQL Editor.
-- It is idempotent - safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. ADD COLUMNS TO TEAM_EVENTS
-- =============================================================================

-- Public RSVP link switch
ALTER TABLE team_events ADD COLUMN IF NOT EXISTS public_rsvp BOOLEAN NOT NULL DEFAULT false;

-- URL slug for public page (e.g. 'christmas-2026')
ALTER TABLE team_events ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE;

-- Allow guests toggle
ALTER TABLE team_events ADD COLUMN IF NOT EXISTS allow_guests BOOLEAN NOT NULL DEFAULT false;

-- Long personal note (multi-paragraph)
ALTER TABLE team_events ADD COLUMN IF NOT EXISTS note TEXT;

-- Short highlight line (e.g. bonus announcement)
ALTER TABLE team_events ADD COLUMN IF NOT EXISTS highlight TEXT;

-- Maps/directions URL
ALTER TABLE team_events ADD COLUMN IF NOT EXISTS location_url TEXT;

-- Index for public slug lookups
CREATE INDEX IF NOT EXISTS idx_team_events_public_slug ON team_events(public_slug) WHERE public_slug IS NOT NULL;

-- =============================================================================
-- 2. PUBLIC RSVPS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS team_event_public_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES team_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  attending BOOLEAN NOT NULL,
  guest_adults INT NOT NULL DEFAULT 0 CHECK (guest_adults BETWEEN 0 AND 6),
  guest_kids INT NOT NULL DEFAULT 0 CHECK (guest_kids BETWEEN 0 AND 10),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index on normalized name per event (case and whitespace insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS team_event_public_rsvps_name_idx
  ON team_event_public_rsvps (event_id, lower(trim(name)));

-- Index for fetching RSVPs by event
CREATE INDEX IF NOT EXISTS idx_team_event_public_rsvps_event
  ON team_event_public_rsvps(event_id);

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE team_event_public_rsvps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for idempotency
DROP POLICY IF EXISTS "Admins can manage team_event_public_rsvps" ON team_event_public_rsvps;
DROP POLICY IF EXISTS "Service role can manage team_event_public_rsvps" ON team_event_public_rsvps;

-- Admins can read all RSVPs
CREATE POLICY "Admins can manage team_event_public_rsvps" ON team_event_public_rsvps
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

-- Public inserts and updates go through the API route with service role key
-- No public SELECT policy - RSVPs are private to admins

-- =============================================================================
-- 4. UPDATE my_team_events FUNCTION TO INCLUDE public_rsvp
-- =============================================================================

DROP FUNCTION IF EXISTS my_team_events(date, date);

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
  rsvp_at TIMESTAMPTZ,
  public_rsvp BOOLEAN,
  public_slug TEXT
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
    tep.rsvp_at,
    te.public_rsvp,
    te.public_slug
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
