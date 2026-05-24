/*
  # Phase 1 — Multi-Company Foundation: organisations and user_orgs

  ## Summary
  Creates the two core tables for multi-company SaaS isolation. No existing
  tables or data are modified. Tables are created first, then RLS policies
  are added after both tables exist (policies on organisations reference
  user_orgs and vice versa).

  ## New Tables

  ### organisations
  Top-level tenant boundary. One row per company/client workspace.
  - id           — uuid primary key
  - name         — display name
  - slug         — unique URL-safe identifier, lowercase alphanum + hyphens
  - created_at / updated_at — timestamps

  ### user_orgs
  Links Supabase Auth users to organisations with an explicit role and status.
  - id        — uuid primary key
  - user_id   — FK → auth.users.id (CASCADE delete)
  - org_id    — FK → organisations.id (CASCADE delete)
  - role      — platform_admin | company_owner | manager | user | viewer
  - status    — active | invited | suspended
  - created_at

  UNIQUE constraint on (user_id, org_id) prevents duplicate memberships.

  ## Security
  - RLS enabled on both tables
  - No anon access on either table
  - SELECT: users read their own memberships; platform_admins read all in their org
  - INSERT/UPDATE/DELETE: platform_admins only

  ## Notes
  - Purely additive — no existing tables or data touched
  - Policies added after both tables exist to avoid forward-reference errors
*/

-- ─────────────────────────────────────────────
-- Table: organisations
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organisations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT '',
  slug        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organisations_slug_unique UNIQUE (slug),
  CONSTRAINT organisations_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]*[a-z0-9]$')
);

CREATE INDEX IF NOT EXISTS idx_organisations_slug ON organisations (slug);

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- Table: user_orgs
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_orgs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'user',
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_orgs_unique_membership UNIQUE (user_id, org_id),
  CONSTRAINT user_orgs_role_check CHECK (
    role IN ('platform_admin', 'company_owner', 'manager', 'user', 'viewer')
  ),
  CONSTRAINT user_orgs_status_check CHECK (
    status IN ('active', 'invited', 'suspended')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_orgs_user_id  ON user_orgs (user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org_id   ON user_orgs (org_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_user_org ON user_orgs (user_id, org_id);

ALTER TABLE user_orgs ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- RLS policies: organisations
-- (added after user_orgs exists to avoid forward-reference errors)
-- ─────────────────────────────────────────────

CREATE POLICY "Members can read their own organisation"
  ON organisations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT org_id FROM user_orgs
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

CREATE POLICY "Platform admins can insert organisations"
  ON organisations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
      AND status = 'active'
    )
  );

CREATE POLICY "Platform admins can update organisations"
  ON organisations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
      AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
      AND status = 'active'
    )
  );

CREATE POLICY "Platform admins can delete organisations"
  ON organisations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
      AND status = 'active'
    )
  );

-- ─────────────────────────────────────────────
-- RLS policies: user_orgs
-- ─────────────────────────────────────────────

CREATE POLICY "Users can read own org memberships"
  ON user_orgs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins can read all memberships in their orgs"
  ON user_orgs FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM user_orgs self
      WHERE self.user_id = auth.uid()
      AND self.role = 'platform_admin'
      AND self.status = 'active'
    )
  );

CREATE POLICY "Platform admins can insert memberships"
  ON user_orgs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM user_orgs self
      WHERE self.user_id = auth.uid()
      AND self.role = 'platform_admin'
      AND self.status = 'active'
    )
  );

CREATE POLICY "Platform admins can update memberships"
  ON user_orgs FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM user_orgs self
      WHERE self.user_id = auth.uid()
      AND self.role = 'platform_admin'
      AND self.status = 'active'
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM user_orgs self
      WHERE self.user_id = auth.uid()
      AND self.role = 'platform_admin'
      AND self.status = 'active'
    )
  );

CREATE POLICY "Platform admins can delete memberships"
  ON user_orgs FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM user_orgs self
      WHERE self.user_id = auth.uid()
      AND self.role = 'platform_admin'
      AND self.status = 'active'
    )
  );
