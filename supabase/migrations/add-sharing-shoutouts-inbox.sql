-- =============================================================================
-- SHARING, SHOUT-OUTS, AND INBOX SYSTEM
-- =============================================================================
-- Run this migration in Supabase SQL Editor.
-- It is idempotent - safe to run multiple times.
-- =============================================================================

-- =============================================================================
-- 1. ADD SHARING COLUMNS TO instructor_notes
-- =============================================================================

-- Add sharing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'shared_at') THEN
    ALTER TABLE instructor_notes ADD COLUMN shared_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'shared_by') THEN
    ALTER TABLE instructor_notes ADD COLUMN shared_by UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'unshared_at') THEN
    ALTER TABLE instructor_notes ADD COLUMN unshared_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'first_viewed_at') THEN
    ALTER TABLE instructor_notes ADD COLUMN first_viewed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'acknowledged_at') THEN
    ALTER TABLE instructor_notes ADD COLUMN acknowledged_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'instructor_comment') THEN
    ALTER TABLE instructor_notes ADD COLUMN instructor_comment TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'instructor_commented_at') THEN
    ALTER TABLE instructor_notes ADD COLUMN instructor_commented_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'admin_marked_done_at') THEN
    ALTER TABLE instructor_notes ADD COLUMN admin_marked_done_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'instructor_notes' AND column_name = 'admin_marked_done_by') THEN
    ALTER TABLE instructor_notes ADD COLUMN admin_marked_done_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- Add constraint: only review, recognition, disciplinary can be shared
-- Drop existing if needed, then create
DO $$
BEGIN
  ALTER TABLE instructor_notes DROP CONSTRAINT IF EXISTS instructor_notes_sharing_type_check;
  ALTER TABLE instructor_notes ADD CONSTRAINT instructor_notes_sharing_type_check
    CHECK (shared_at IS NULL OR type IN ('review', 'recognition', 'disciplinary'));
EXCEPTION WHEN OTHERS THEN
  -- Constraint may already exist
  NULL;
END $$;

-- Index for shared notes lookup
CREATE INDEX IF NOT EXISTS idx_instructor_notes_shared ON instructor_notes(profile_id, shared_at) WHERE shared_at IS NOT NULL AND unshared_at IS NULL;

-- =============================================================================
-- 2. SECURITY DEFINER FUNCTIONS FOR INSTRUCTOR ACCESS
-- =============================================================================

-- Function: Get shared notes for the calling instructor
CREATE OR REPLACE FUNCTION my_shared_notes()
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  note_date DATE,
  shared_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  instructor_comment TEXT,
  -- Review fields
  ratings JSONB,
  doing_well TEXT,
  work_on_next TEXT,
  next_review_date DATE,
  -- Recognition fields
  body TEXT,
  -- Disciplinary fields
  step TEXT,
  about TEXT,
  what_happened TEXT,
  expectation TEXT,
  if_repeated TEXT,
  talked_on DATE,
  -- Shout-out source info
  shout_out_from_name TEXT,
  shout_out_tag TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
BEGIN
  -- Get the caller's profile ID
  SELECT p.id INTO caller_profile_id
  FROM profiles p
  WHERE p.user_id = auth.uid() OR p.id = auth.uid()
  LIMIT 1;

  IF caller_profile_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    n.id,
    n.type,
    n.title,
    n.note_date,
    n.shared_at,
    n.first_viewed_at,
    n.acknowledged_at,
    n.instructor_comment,
    -- Review: extract safe fields from details
    CASE WHEN n.type = 'review' THEN n.details->'ratings' ELSE NULL END AS ratings,
    CASE WHEN n.type = 'review' THEN n.details->>'doing_well' ELSE NULL END AS doing_well,
    CASE WHEN n.type = 'review' THEN n.details->>'work_on_next' ELSE NULL END AS work_on_next,
    CASE WHEN n.type = 'review' THEN (n.details->>'next_review_date')::DATE ELSE NULL END AS next_review_date,
    -- Recognition: body is safe to show
    CASE WHEN n.type = 'recognition' THEN n.body ELSE NULL END AS body,
    -- Disciplinary: extract safe fields from details
    CASE WHEN n.type = 'disciplinary' THEN n.details->>'step' ELSE NULL END AS step,
    CASE WHEN n.type = 'disciplinary' THEN n.details->>'about' ELSE NULL END AS about,
    CASE WHEN n.type = 'disciplinary' THEN n.details->>'what_happened' ELSE NULL END AS what_happened,
    CASE WHEN n.type = 'disciplinary' THEN n.details->>'expectation' ELSE NULL END AS expectation,
    CASE WHEN n.type = 'disciplinary' THEN n.details->>'if_repeated' ELSE NULL END AS if_repeated,
    CASE WHEN n.type = 'disciplinary' THEN (n.details->>'talked_on')::DATE ELSE NULL END AS talked_on,
    -- Shout-out source info for recognition notes
    CASE WHEN n.type = 'recognition' AND n.details->>'shout_out_id' IS NOT NULL
      THEN (SELECT split_part(pr.full_name, ' ', 1) FROM profiles pr WHERE pr.id = (n.details->>'from_profile_id')::UUID)
      ELSE NULL END AS shout_out_from_name,
    CASE WHEN n.type = 'recognition' THEN n.details->>'tag' ELSE NULL END AS shout_out_tag
  FROM instructor_notes n
  WHERE n.profile_id = caller_profile_id
    AND n.shared_at IS NOT NULL
    AND n.unshared_at IS NULL
    AND n.archived_at IS NULL
  ORDER BY n.shared_at DESC;
END;
$$;

-- Function: Mark a shared note as viewed
CREATE OR REPLACE FUNCTION mark_shared_note_viewed(p_note_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
BEGIN
  -- Get the caller's profile ID
  SELECT p.id INTO caller_profile_id
  FROM profiles p
  WHERE p.user_id = auth.uid() OR p.id = auth.uid()
  LIMIT 1;

  IF caller_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Only update if the note belongs to caller and is shared
  UPDATE instructor_notes
  SET first_viewed_at = COALESCE(first_viewed_at, now())
  WHERE id = p_note_id
    AND profile_id = caller_profile_id
    AND shared_at IS NOT NULL
    AND unshared_at IS NULL
    AND first_viewed_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Function: Acknowledge a shared note with optional comment
CREATE OR REPLACE FUNCTION acknowledge_shared_note(p_note_id UUID, p_comment TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_profile_id UUID;
  trimmed_comment TEXT;
BEGIN
  -- Get the caller's profile ID
  SELECT p.id INTO caller_profile_id
  FROM profiles p
  WHERE p.user_id = auth.uid() OR p.id = auth.uid()
  LIMIT 1;

  IF caller_profile_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Trim and limit comment to 500 characters
  trimmed_comment := LEFT(TRIM(COALESCE(p_comment, '')), 500);
  IF trimmed_comment = '' THEN
    trimmed_comment := NULL;
  END IF;

  -- Only allow acknowledging once, and only if note belongs to caller and is shared
  UPDATE instructor_notes
  SET
    acknowledged_at = COALESCE(acknowledged_at, now()),
    first_viewed_at = COALESCE(first_viewed_at, now()),
    instructor_comment = CASE WHEN instructor_comment IS NULL THEN trimmed_comment ELSE instructor_comment END,
    instructor_commented_at = CASE WHEN instructor_comment IS NULL AND trimmed_comment IS NOT NULL THEN now() ELSE instructor_commented_at END
  WHERE id = p_note_id
    AND profile_id = caller_profile_id
    AND shared_at IS NOT NULL
    AND unshared_at IS NULL
    AND acknowledged_at IS NULL;

  RETURN FOUND;
END;
$$;

-- =============================================================================
-- 3. SHOUT-OUTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS shout_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tag TEXT CHECK (tag IS NULL OR tag IN ('saved_the_day','great_with_kids','team_player','made_it_fun','super_prepared')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 300),
  approved_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','held')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  context_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  context_date DATE,
  context_session_change_id UUID REFERENCES session_changes(id) ON DELETE SET NULL,
  recognition_note_id UUID REFERENCES instructor_notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (from_profile_id <> to_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_shout_outs_from ON shout_outs(from_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shout_outs_to ON shout_outs(to_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_shout_outs_pending ON shout_outs(status) WHERE status = 'pending';

ALTER TABLE shout_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage shout_outs" ON shout_outs;
CREATE POLICY "Admins can manage shout_outs" ON shout_outs
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

-- Instructors can insert their own shout-outs
DROP POLICY IF EXISTS "Instructors can insert own shout_outs" ON shout_outs;
CREATE POLICY "Instructors can insert own shout_outs" ON shout_outs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = from_profile_id
    )
  );

-- Instructors can see their own sent shout-outs (for my_sent_shout_outs function fallback)
DROP POLICY IF EXISTS "Instructors can see own sent shout_outs" ON shout_outs;
CREATE POLICY "Instructors can see own sent shout_outs" ON shout_outs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = from_profile_id
    )
  );

-- =============================================================================
-- 4. SHOUT-OUT NUDGE DISMISSALS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS shout_out_nudge_dismissals (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_change_id UUID NOT NULL REFERENCES session_changes(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, session_change_id)
);

ALTER TABLE shout_out_nudge_dismissals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own nudge dismissals" ON shout_out_nudge_dismissals;
CREATE POLICY "Users can manage own nudge dismissals" ON shout_out_nudge_dismissals
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = profile_id
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
-- 5. INSTRUCTOR SHOUT-OUT FUNCTIONS
-- =============================================================================

-- Function: Get shout-outs I sent (always shows 'sent' status)
CREATE OR REPLACE FUNCTION my_sent_shout_outs()
RETURNS TABLE (
  id UUID,
  to_name TEXT,
  tag TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  status TEXT
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
    s.id,
    pr.full_name AS to_name,
    s.tag,
    s.message,
    s.created_at,
    'sent'::TEXT AS status  -- Always show as 'sent' to hide pending/held
  FROM shout_outs s
  JOIN profiles pr ON pr.id = s.to_profile_id
  WHERE s.from_profile_id = caller_profile_id
  ORDER BY s.created_at DESC;
END;
$$;

-- Function: Get shout-outs I received (only approved ones)
CREATE OR REPLACE FUNCTION my_received_shout_outs()
RETURNS TABLE (
  id UUID,
  from_first_name TEXT,
  from_avatar_url TEXT,
  tag TEXT,
  message TEXT,
  reviewed_at TIMESTAMPTZ
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
    s.id,
    split_part(pr.full_name, ' ', 1) AS from_first_name,
    pr.avatar_url AS from_avatar_url,
    s.tag,
    COALESCE(s.approved_message, s.message) AS message,
    s.reviewed_at
  FROM shout_outs s
  JOIN profiles pr ON pr.id = s.from_profile_id
  WHERE s.to_profile_id = caller_profile_id
    AND s.status = 'approved'
  ORDER BY s.reviewed_at DESC NULLS LAST, s.created_at DESC;
END;
$$;

-- =============================================================================
-- 6. ANNOUNCEMENTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 1000),
  audience JSONB NOT NULL,
  send_email BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;
CREATE POLICY "Admins can manage announcements" ON announcements
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

-- Function: Get announcements for the calling instructor
CREATE OR REPLACE FUNCTION my_announcements()
RETURNS TABLE (
  id UUID,
  title TEXT,
  body TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ
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
    a.created_at
  FROM announcements a
  LEFT JOIN profiles pr ON pr.id = a.created_by
  WHERE a.archived_at IS NULL
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
    )
  ORDER BY a.created_at DESC;
END;
$$;

-- =============================================================================
-- 7. ADMIN INBOX DONE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_inbox_done (
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  done_by UUID REFERENCES profiles(id),
  done_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (item_type, item_id)
);

ALTER TABLE admin_inbox_done ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage admin_inbox_done" ON admin_inbox_done;
CREATE POLICY "Admins can manage admin_inbox_done" ON admin_inbox_done
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
-- 8. INBOX READS TABLE (for instructor inbox)
-- =============================================================================

CREATE TABLE IF NOT EXISTS inbox_reads (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (profile_id, item_type, item_id)
);

ALTER TABLE inbox_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own inbox reads" ON inbox_reads;
CREATE POLICY "Users can manage own inbox reads" ON inbox_reads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.id = profile_id
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
-- 9. VERIFY NO INSTRUCTOR POLICIES ON NOTES TABLES
-- =============================================================================
-- The existing RLS policies on instructor_notes, instructor_note_versions,
-- and instructor_note_files only allow admin access.
-- Instructors access shared notes ONLY through my_shared_notes() function.

-- Double-check: ensure no instructor-facing policies exist
-- (The original migration already has admin-only policies)

-- =============================================================================
-- DONE
-- =============================================================================
