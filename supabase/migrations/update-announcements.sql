-- =============================================================================
-- ANNOUNCEMENTS UPDATES FOR ADMIN UPDATES PAGE
-- =============================================================================
-- Run this migration in Supabase SQL Editor.
-- It is idempotent - safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. ADD NEW COLUMNS TO announcements TABLE
-- =============================================================================

DO $$
BEGIN
  -- Status: draft, scheduled, or sent
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'status') THEN
    ALTER TABLE announcements ADD COLUMN status TEXT NOT NULL DEFAULT 'sent'
      CHECK (status IN ('draft','scheduled','sent'));
  END IF;

  -- Scheduled send time
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'send_at') THEN
    ALTER TABLE announcements ADD COLUMN send_at TIMESTAMPTZ;
  END IF;

  -- Actual send time
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'sent_at') THEN
    ALTER TABLE announcements ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;

  -- Pin until date (inclusive)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'pinned_until') THEN
    ALTER TABLE announcements ADD COLUMN pinned_until DATE;
  END IF;

  -- Edited timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'edited_at') THEN
    ALTER TABLE announcements ADD COLUMN edited_at TIMESTAMPTZ;
  END IF;

  -- Email sent timestamp
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'emailed_at') THEN
    ALTER TABLE announcements ADD COLUMN emailed_at TIMESTAMPTZ;
  END IF;

  -- Last reminder sent date (to enforce once per day)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'announcements' AND column_name = 'last_reminded_at') THEN
    ALTER TABLE announcements ADD COLUMN last_reminded_at DATE;
  END IF;
END $$;

-- Backfill sent_at for existing announcements that are already sent
UPDATE announcements
SET sent_at = created_at
WHERE sent_at IS NULL AND status = 'sent';

-- Index for cron job to find scheduled announcements
CREATE INDEX IF NOT EXISTS idx_announcements_scheduled
  ON announcements(status, send_at)
  WHERE status = 'scheduled';

-- =============================================================================
-- 2. UPDATE my_announcements() FUNCTION
-- =============================================================================
-- Changes:
-- 1. Only return status='sent' announcements
-- 2. Handle audience type "people" (array of profile IDs)
-- 3. Return pinned_until and edited_at
-- 4. Filter out archived
-- =============================================================================

-- Drop existing function first (return type changed)
DROP FUNCTION IF EXISTS my_announcements();

CREATE OR REPLACE FUNCTION my_announcements()
RETURNS TABLE (
  id UUID,
  title TEXT,
  body TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ,
  pinned_until DATE,
  edited_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
  caller_programs TEXT[];
  caller_school_ids UUID[];
BEGIN
  SELECT p.id INTO caller_profile_id
  FROM profiles p
  WHERE p.user_id = auth.uid() OR p.id = auth.uid()
  LIMIT 1;

  IF caller_profile_id IS NULL THEN
    RETURN;
  END IF;

  -- Get programs the instructor teaches
  SELECT ARRAY_AGG(DISTINCT c.program) INTO caller_programs
  FROM class_assignments ca
  JOIN classes c ON c.id = ca.class_id
  WHERE ca.profile_id = caller_profile_id
    AND c.start_date IS NOT NULL;

  -- Get schools where instructor is a regular (not just sub)
  SELECT ARRAY_AGG(DISTINCT c.school_id) INTO caller_school_ids
  FROM class_assignments ca
  JOIN classes c ON c.id = ca.class_id
  WHERE ca.profile_id = caller_profile_id
    AND c.start_date IS NOT NULL;

  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.body,
    split_part(pr.full_name, ' ', 1) AS created_by_name,
    a.created_at,
    a.pinned_until,
    a.edited_at
  FROM announcements a
  LEFT JOIN profiles pr ON pr.id = a.created_by
  WHERE a.archived_at IS NULL
    AND a.status = 'sent'
    AND (
      -- Audience: all
      a.audience->>'type' = 'all'
      -- Audience: program
      OR (a.audience->>'type' = 'program' AND a.audience->>'program' = ANY(caller_programs))
      -- Audience: school
      OR (
        a.audience->>'type' = 'school'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(a.audience->'school_ids') sid
          WHERE sid::UUID = ANY(caller_school_ids)
        )
      )
      -- Audience: people (specific profile IDs)
      OR (
        a.audience->>'type' = 'people'
        AND EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(a.audience->'profile_ids') pid
          WHERE pid::UUID = caller_profile_id
        )
      )
    )
  ORDER BY a.created_at DESC;
END;
$$;

-- =============================================================================
-- 3. RPC FUNCTION TO GET RECIPIENT COUNT FOR AUDIENCE
-- =============================================================================
-- Used by the admin composer to show live recipient count

CREATE OR REPLACE FUNCTION get_announcement_recipient_count(p_audience JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  audience_type TEXT;
  recipient_count INTEGER := 0;
BEGIN
  audience_type := p_audience->>'type';

  IF audience_type = 'all' THEN
    -- All active instructors
    SELECT COUNT(*) INTO recipient_count
    FROM profiles
    WHERE role = 'instructor' AND status = 'active';

  ELSIF audience_type = 'program' THEN
    -- Instructors in a specific program
    SELECT COUNT(DISTINCT ca.profile_id) INTO recipient_count
    FROM class_assignments ca
    JOIN classes c ON c.id = ca.class_id
    JOIN profiles p ON p.id = ca.profile_id
    WHERE c.program = p_audience->>'program'
      AND c.start_date IS NOT NULL
      AND p.role = 'instructor'
      AND p.status = 'active';

  ELSIF audience_type = 'school' THEN
    -- Instructors at specific schools
    SELECT COUNT(DISTINCT ca.profile_id) INTO recipient_count
    FROM class_assignments ca
    JOIN classes c ON c.id = ca.class_id
    JOIN profiles p ON p.id = ca.profile_id
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p_audience->'school_ids') sid
      WHERE sid::UUID = c.school_id
    )
    AND c.start_date IS NOT NULL
    AND p.role = 'instructor'
    AND p.status = 'active';

  ELSIF audience_type = 'people' THEN
    -- Specific people
    SELECT COUNT(*) INTO recipient_count
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(p_audience->'profile_ids') pid
      WHERE pid::UUID = p.id
    )
    AND p.role = 'instructor'
    AND p.status = 'active';

  END IF;

  RETURN COALESCE(recipient_count, 0);
END;
$$;

-- =============================================================================
-- DONE
-- =============================================================================
