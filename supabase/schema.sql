-- =============================================================================
-- SETUP INSTRUCTIONS
-- =============================================================================
-- 1. Go to your Supabase project dashboard: https://supabase.com/dashboard
-- 2. Select your project (or create one)
-- 3. Go to SQL Editor (left sidebar)
-- 4. Paste this entire file and click "Run"
-- 5. Verify the table was created: Table Editor > ping
-- =============================================================================

-- Test table to verify database connection works
CREATE TABLE IF NOT EXISTS ping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow the anon key to read/write this table (for testing only)
ALTER TABLE ping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous access to ping"
  ON ping
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
