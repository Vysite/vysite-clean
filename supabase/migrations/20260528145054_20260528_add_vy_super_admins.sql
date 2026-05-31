/*
  # Add vy_super_admins table — Super Admin Phase 1

  ## Summary
  Creates a simple allowlist table for VYSITE platform super-admins.
  A super admin is a VYSITE employee/operator who can access the /super-admin
  area to manage all organisations, modules, and AI settings across the platform.

  This is SEPARATE from the per-org user_orgs role system. Super admins may or
  may not be members of any particular organisation.

  ## New Table: vy_super_admins

  ### Columns
  - `id`          — uuid PK
  - `auth_user_id`— uuid, FK → auth.users.id (CASCADE delete) — the Supabase auth identity
  - `email`       — text, display/audit reference (not used for auth, just for readability)
  - `name`        — text, display name
  - `created_at`  — timestamptz

  ## Security
  - RLS enabled
  - SELECT: only if the requesting user is themselves in the super_admins table
  - INSERT/UPDATE/DELETE: only existing super admins can manage the table
    (bootstrapped via service-role or direct DB access for the first row)

  ## Notes
  - The existing admin user (tom.foreman@nexasolutions.co.uk, auth id 8316fe7a-...)
    is seeded as the first super admin
  - Future super admins are added directly to this table via the DB or a future
    super admin UI
*/

CREATE TABLE IF NOT EXISTS vy_super_admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL DEFAULT '',
  name          text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vy_super_admins_unique_user UNIQUE (auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_vy_super_admins_auth_user ON vy_super_admins (auth_user_id);

ALTER TABLE vy_super_admins ENABLE ROW LEVEL SECURITY;

-- Super admins can read the table (to verify their own access and see peers)
CREATE POLICY "Super admins can read super_admins table"
  ON vy_super_admins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );

-- Only super admins can insert new super admins
CREATE POLICY "Super admins can insert super admins"
  ON vy_super_admins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );

-- Only super admins can update
CREATE POLICY "Super admins can update super admins"
  ON vy_super_admins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );

-- Only super admins can delete
CREATE POLICY "Super admins can delete super admins"
  ON vy_super_admins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );

-- Seed the first super admin: Tom Foreman (VYSITE platform admin)
INSERT INTO vy_super_admins (auth_user_id, email, name, created_at)
VALUES (
  '8316fe7a-b966-42e3-9b1a-129e9ad9107f',
  'tom.foreman@nexasolutions.co.uk',
  'Tom Foreman',
  now()
)
ON CONFLICT (auth_user_id) DO NOTHING;
