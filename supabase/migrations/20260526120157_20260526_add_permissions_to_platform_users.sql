/*
  # Add permissions column to vy_platform_users

  ## Summary
  Adds a `permissions` JSONB column to `vy_platform_users` to store per-user
  permission overrides on top of their role defaults.

  ## Changes
  - `vy_platform_users.permissions` (jsonb, nullable) — stores a flat key/value
    map of permission keys (e.g. "view_pricing": true) that override the role
    default for this specific user. Null means "use role defaults entirely".

  ## Notes
  - No existing rows are affected (column defaults to NULL).
  - The role column continues to drive base access; permissions is additive override only.
  - No RLS changes needed — existing org-scoped policies on vy_platform_users apply.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_platform_users' AND column_name = 'permissions'
  ) THEN
    ALTER TABLE vy_platform_users ADD COLUMN permissions jsonb DEFAULT NULL;
  END IF;
END $$;
