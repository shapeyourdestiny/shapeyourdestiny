-- Class notes table for instructor feedback on how classes went
CREATE TABLE IF NOT EXISTS class_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  overall SMALLINT NOT NULL CHECK (overall BETWEEN 1 AND 5),
  attention SMALLINT CHECK (attention BETWEEN 1 AND 5),
  behavior SMALLINT CHECK (behavior BETWEEN 1 AND 5),
  needs_supplies BOOLEAN NOT NULL DEFAULT false,
  body TEXT CHECK (body IS NULL OR char_length(body) <= 1000),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, class_id, session_date)
);

-- Index for fetching notes by class
CREATE INDEX IF NOT EXISTS class_notes_class_id_idx ON class_notes(class_id);

-- Index for fetching notes by instructor
CREATE INDEX IF NOT EXISTS class_notes_profile_id_idx ON class_notes(profile_id);

-- Index for admin inbox: notes needing attention (any star ≤2 or needs_supplies)
CREATE INDEX IF NOT EXISTS class_notes_needs_attention_idx ON class_notes(created_at DESC)
  WHERE overall <= 2 OR attention <= 2 OR behavior <= 2 OR needs_supplies = true;

-- RLS policies
ALTER TABLE class_notes ENABLE ROW LEVEL SECURITY;

-- Instructors can insert their own notes
CREATE POLICY "Instructors can insert own notes"
  ON class_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.user_id = auth.uid() OR p.id = auth.uid()
    )
  );

-- Instructors can update their own notes
CREATE POLICY "Instructors can update own notes"
  ON class_notes FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.user_id = auth.uid() OR p.id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.user_id = auth.uid() OR p.id = auth.uid()
    )
  );

-- Instructors can select their own notes
CREATE POLICY "Instructors can select own notes"
  ON class_notes FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT p.id FROM profiles p
      WHERE p.user_id = auth.uid() OR p.id = auth.uid()
    )
  );

-- Admins can select all notes
CREATE POLICY "Admins can select all notes"
  ON class_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND p.role = 'admin'
    )
  );

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_class_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER class_notes_updated_at
  BEFORE UPDATE ON class_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_class_notes_updated_at();
