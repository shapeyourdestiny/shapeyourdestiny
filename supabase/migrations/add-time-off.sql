-- =============================================================================
-- TIME OFF REQUESTS TABLE AND SESSION CHANGES UPDATES
-- =============================================================================
-- Run this migration in Supabase SQL Editor.
-- It is idempotent - safe to run multiple times.

-- =============================================================================
-- 1. CREATE TIME OFF REQUESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('vacation','sick','appointment','personal','emergency','other')),
  note TEXT,
  requested_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  decided_by UUID REFERENCES profiles(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  absence_group_id UUID,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS time_off_requests_profile_idx ON time_off_requests(profile_id);
CREATE INDEX IF NOT EXISTS time_off_requests_dates_idx ON time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS time_off_requests_status_idx ON time_off_requests(status);

-- =============================================================================
-- 2. ADD COLUMNS TO SESSION_CHANGES
-- =============================================================================

-- Add notified_on column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_changes' AND column_name = 'notified_on'
  ) THEN
    ALTER TABLE session_changes ADD COLUMN notified_on DATE;
  END IF;
END $$;

-- Add time_off_request_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_changes' AND column_name = 'time_off_request_id'
  ) THEN
    ALTER TABLE session_changes ADD COLUMN time_off_request_id UUID REFERENCES time_off_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill notified_on with created_at date for existing rows
UPDATE session_changes
SET notified_on = created_at::date
WHERE notified_on IS NULL;

-- Index for time_off_request_id
CREATE INDEX IF NOT EXISTS session_changes_time_off_request_idx ON session_changes(time_off_request_id);

-- =============================================================================
-- 3. RLS POLICIES FOR TIME_OFF_REQUESTS
-- =============================================================================

ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can read time_off_requests" ON time_off_requests;
DROP POLICY IF EXISTS "Admins can insert time_off_requests" ON time_off_requests;
DROP POLICY IF EXISTS "Admins can update time_off_requests" ON time_off_requests;

-- Admin read policy
CREATE POLICY "Admins can read time_off_requests"
  ON time_off_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Admin insert policy
CREATE POLICY "Admins can insert time_off_requests"
  ON time_off_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );

-- Admin update policy (no delete - requests are cancelled, not deleted)
CREATE POLICY "Admins can update time_off_requests"
  ON time_off_requests
  FOR UPDATE
  TO authenticated
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
-- DONE
-- =============================================================================
-- After running this migration:
-- 1. The time_off_requests table will be created
-- 2. session_changes will have notified_on and time_off_request_id columns
-- 3. Existing session_changes rows will have notified_on backfilled
-- 4. RLS policies will be set up for admin-only access
