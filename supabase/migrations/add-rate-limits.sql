-- Rate limiting table for form submissions and auth attempts
-- This replaces in-memory rate limiting which resets on cold starts

CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookups by key and time window
CREATE INDEX IF NOT EXISTS rate_limits_key_created_at_idx
  ON rate_limits (key, created_at DESC);

-- Enable RLS but allow service role to manage
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No policies - only accessible via service role (admin client)
-- This is intentional: rate limits should not be readable or writable by users

-- Cleanup function to remove old entries (run via cron or periodically)
CREATE OR REPLACE FUNCTION cleanup_rate_limits(older_than_minutes integer DEFAULT 60)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE created_at < now() - (older_than_minutes || ' minutes')::interval;
END;
$$;

-- Grant execute to authenticated users (for admin cleanup calls)
GRANT EXECUTE ON FUNCTION cleanup_rate_limits TO authenticated;

COMMENT ON TABLE rate_limits IS 'Stores rate limit entries for forms and auth. Use service role to access.';
