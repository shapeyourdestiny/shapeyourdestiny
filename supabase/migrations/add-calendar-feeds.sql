-- Calendar feeds for instructor calendar sync
-- Run this migration manually in Supabase SQL editor

-- Create calendar_feeds table
CREATE TABLE IF NOT EXISTS calendar_feeds (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  calendar_app TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  rotated_at TIMESTAMPTZ,
  last_fetched_at TIMESTAMPTZ
);

-- Add comment
COMMENT ON TABLE calendar_feeds IS 'Stores calendar feed tokens for instructor calendar sync';
COMMENT ON COLUMN calendar_feeds.token IS 'Base64url-encoded random token (32+ bytes). Treat like a password.';
COMMENT ON COLUMN calendar_feeds.calendar_app IS 'apple, google, outlook, or other - for display only';

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_calendar_feeds_token ON calendar_feeds(token);

-- RLS policies
ALTER TABLE calendar_feeds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Instructors can view their own feed" ON calendar_feeds;
DROP POLICY IF EXISTS "Instructors can create their own feed" ON calendar_feeds;
DROP POLICY IF EXISTS "Instructors can update their own feed" ON calendar_feeds;
DROP POLICY IF EXISTS "Admins can view all feeds" ON calendar_feeds;

-- Instructors can only see their own row
CREATE POLICY "Instructors can view their own feed"
  ON calendar_feeds FOR SELECT
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = calendar_feeds.profile_id
      AND p.user_id = auth.uid()
    )
  );

-- Instructors can create their own feed
CREATE POLICY "Instructors can create their own feed"
  ON calendar_feeds FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = calendar_feeds.profile_id
      AND p.user_id = auth.uid()
    )
  );

-- Instructors can update their own feed
CREATE POLICY "Instructors can update their own feed"
  ON calendar_feeds FOR UPDATE
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = calendar_feeds.profile_id
      AND p.user_id = auth.uid()
    )
  );

-- Admins can view all feeds (but UI never shows the token)
CREATE POLICY "Admins can view all feeds"
  ON calendar_feeds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
      AND p.role = 'admin'
    )
  );
