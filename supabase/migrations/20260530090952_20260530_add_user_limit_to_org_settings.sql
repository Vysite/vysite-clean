/*
  # Add user_limit to org_settings

  ## Summary
  Adds a `user_limit` column to the `org_settings` table so that VYSITE
  platform super admins can cap the number of active users per organisation.

  ## Changes
  - `org_settings.user_limit` (integer, nullable)
    - NULL = unlimited (default for existing rows)
    - Any positive integer = maximum active users allowed for that org

  ## Notes
  - No data is changed or deleted.
  - Existing rows retain NULL (unlimited) unless explicitly updated via
    the Super Admin panel.
  - The application enforces the limit in the invitation flow; the DB column
    is the source of truth.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_settings' AND column_name = 'user_limit'
  ) THEN
    ALTER TABLE org_settings ADD COLUMN user_limit integer DEFAULT NULL;
  END IF;
END $$;
