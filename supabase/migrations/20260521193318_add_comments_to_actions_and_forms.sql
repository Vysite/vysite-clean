/*
  # Add persistent comments to vy_actions and vy_site_forms

  ## Changes

  ### 1. `vy_actions`
  - Adds `comments` JSONB column (default empty array)
  - Stores structured comment objects: { id, user, datetime, text }

  ### 2. `vy_site_forms`
  - Adds `form_comments` JSONB column (default empty array)
  - Keeps existing `comments` text column intact (holds form notes/initial text)
  - `form_comments` stores live comment threads: { id, user, datetime, text }

  ## Notes
  - Uses IF NOT EXISTS guards to be safe on re-run
  - No data is lost — existing rows simply get empty arrays as default
  - Existing `comments` text column on `vy_site_forms` is preserved (it holds form notes)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_actions' AND column_name = 'comments'
  ) THEN
    ALTER TABLE vy_actions ADD COLUMN comments jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_site_forms' AND column_name = 'form_comments'
  ) THEN
    ALTER TABLE vy_site_forms ADD COLUMN form_comments jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;
