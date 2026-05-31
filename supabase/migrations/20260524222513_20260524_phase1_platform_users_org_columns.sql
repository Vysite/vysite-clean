/*
  # Phase 1 — Add org_id and auth_user_id to vy_platform_users

  ## Summary
  Adds two new columns to vy_platform_users to prepare for proper auth
  integration and org-scoped data isolation. All existing rows are preserved.
  Both columns are nullable at this stage — they will be tightened to NOT NULL
  in a later migration once all rows have been backfilled.

  ## Modified Table: vy_platform_users

  ### New Columns
  - auth_user_id (uuid, nullable)
    Links the platform user profile to a Supabase Auth identity (auth.users.id).
    This is the bridge between the app-layer user record and the authenticated
    session. Will be used in Phase 4 to replace localStorage user switching.

  - org_id (uuid, nullable, FK → organisations.id)
    Associates the platform user with their organisation. Used in Phase 2/3
    when RLS policies are tightened to require org membership for data access.

  ### Indexes
  - idx_vy_platform_users_auth_user_id — fast lookup by auth identity
  - idx_vy_platform_users_org_id       — fast lookup by org

  ## Notes
  - Columns are nullable (no DEFAULT constraint) to avoid locking the table
    on large datasets and to avoid masking unmigrated rows with fake defaults
  - Existing data is fully preserved — no rows modified by this migration
  - NOT NULL enforcement deferred to Phase 2 after backfill migration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_platform_users' AND column_name = 'auth_user_id'
  ) THEN
    ALTER TABLE vy_platform_users ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_platform_users' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE vy_platform_users ADD COLUMN org_id uuid REFERENCES organisations(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vy_platform_users_auth_user_id ON vy_platform_users (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_vy_platform_users_org_id       ON vy_platform_users (org_id);
