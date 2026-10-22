-- =============================================================================
-- Allow Instructors to Read Program Off Days
-- =============================================================================
-- Instructors need to read program_off_days to see their schedule correctly.
-- Without this, their schedule would show sessions on program off days.
-- =============================================================================

-- Allow all authenticated users to read program_off_days
CREATE POLICY "Authenticated users can read program_off_days" ON program_off_days
  FOR SELECT
  TO authenticated
  USING (true);
