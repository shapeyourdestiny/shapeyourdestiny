-- update-resources-list.sql
-- Lets admins add any file or link to Resources (not just the handbook and lesson plans),
-- choose an icon, reorder, hide, and archive resources.
-- Safe to run more than once.

ALTER TABLE resources ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'file';
DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT resources_kind_check CHECK (kind IN ('file','link'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE resources ADD COLUMN IF NOT EXISTS url TEXT;                 -- for links
ALTER TABLE resources ADD COLUMN IF NOT EXISTS subtitle TEXT;            -- short description
ALTER TABLE resources ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'book';
DO $$ BEGIN
  ALTER TABLE resources ADD CONSTRAINT resources_icon_check
    CHECK (icon IN ('book','shield','video','link','form','folder'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE resources ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE resources SET subtitle = 'Policies, attendance and emergencies', icon = 'shield', sort_order = 10
  WHERE key = 'handbook' AND subtitle IS NULL;
UPDATE resources SET subtitle = 'Youth Wellness', icon = 'book', sort_order = 20
  WHERE key = 'lesson_plans' AND subtitle IS NULL;
