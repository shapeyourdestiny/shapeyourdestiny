-- Add instructor-facing fields to schools table
-- Run this in the Supabase SQL Editor

ALTER TABLE schools ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS office_contact TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS office_phone TEXT;

-- Note: The existing RLS on schools allows authenticated users to read all schools
-- (there's no restrictive SELECT policy), so instructors can already read these columns.
-- Only admins can write via the admin client, which bypasses RLS.
