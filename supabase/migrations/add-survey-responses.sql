-- Survey responses table
-- Stores responses to any survey in a generic format

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_slug TEXT NOT NULL,           -- 'soccer-feedback'
  answers JSONB NOT NULL,              -- { question_id: value }
  school TEXT,                         -- copied from answers for easy filtering; null = prefer not to say
  is_anonymous BOOLEAN NOT NULL DEFAULT true,  -- true when name is blank
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient querying by survey
CREATE INDEX IF NOT EXISTS survey_responses_slug_idx
  ON survey_responses (survey_slug, submitted_at DESC);

-- Enable Row Level Security
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Admins can read survey responses" ON survey_responses;
DROP POLICY IF EXISTS "No direct inserts from browser" ON survey_responses;

-- Only admins can read responses
CREATE POLICY "Admins can read survey responses"
  ON survey_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE (profiles.user_id = auth.uid() OR profiles.id = auth.uid())
        AND profiles.role = 'admin'
    )
  );

-- Nobody inserts from the browser - the API route uses service role
-- This policy denies all INSERT operations from authenticated users
CREATE POLICY "No direct inserts from browser"
  ON survey_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
