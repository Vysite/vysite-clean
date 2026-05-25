/*
  # Make vy_settings org-scoped

  ## Problem
  vy_settings was designed with a single-row-per-database pattern using
  id = 'workspace' as the primary key. This breaks in multi-tenant mode
  because every org would try to upsert the same id.

  ## Fix
  1. Add a UNIQUE constraint on org_id so we can upsert by org_id.
  2. Update any existing 'workspace' row to use the real org_id as its id
     (so the PK is still unique per org).
  3. The frontend store will now upsert using org_id as the conflict target
     via the unique constraint.

  ## No data is lost — existing settings rows are migrated in place.
*/

-- Add unique constraint on org_id so upsert can use it as conflict target
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'vy_settings'::regclass
      AND conname = 'vy_settings_org_id_key'
  ) THEN
    ALTER TABLE vy_settings ADD CONSTRAINT vy_settings_org_id_key UNIQUE (org_id);
  END IF;
END $$;

-- Migrate the legacy 'workspace' row: set its id to the org_id value
-- so it has a unique PK per org. Safe no-op if already migrated.
UPDATE vy_settings
SET id = org_id::text
WHERE id = 'workspace' AND org_id IS NOT NULL;
