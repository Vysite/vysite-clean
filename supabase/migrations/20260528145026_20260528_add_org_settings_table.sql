/*
  # Add org_settings table — Super Admin Phase 1

  ## Summary
  Creates a per-organisation settings table that the VYSITE Super Admin area
  uses to control account status, enabled sidebar modules, and AI feature access.
  One row per organisation; created lazily on first save or seeded alongside
  the organisation row.

  ## New Table: org_settings

  ### Columns
  - `org_id`              — uuid PK, FK → organisations.id (CASCADE delete)
  - `account_status`      — 'active' | 'disabled' — controls whether org users can access the platform
  - `modules_enabled`     — jsonb map: { "tenders": true, "projects": true, ... } — per-module on/off
  - `ai_enabled`          — boolean — global AI feature toggle for this org
  - `ai_monthly_limit`    — integer — max AI reviews allowed per calendar month
  - `ai_used_this_month`  — integer — current month usage counter
  - `ai_bonus_credits`    — integer — manually added bonus reviews (added on top of monthly limit)
  - `updated_at`          — timestamptz updated on every save
  - `updated_by`          — text — email/name of the super admin who last saved

  ## Security
  - RLS enabled
  - SELECT: members of the org can read their own settings (needed for module gates)
  - INSERT/UPDATE: platform_admins only (via user_orgs role check)
  - DELETE: platform_admins only

  ## Notes
  - No existing tables or data modified
  - account_status = 'disabled' is enforced in the frontend login/load gate — no data is deleted
  - modules_enabled defaults to all main modules on so existing orgs are unaffected
*/

CREATE TABLE IF NOT EXISTS org_settings (
  org_id              uuid PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  account_status      text NOT NULL DEFAULT 'active',
  modules_enabled     jsonb NOT NULL DEFAULT '{
    "tenders": true,
    "projects": true,
    "maintenance": true,
    "site-forms": true,
    "snagging": true,
    "actions": true,
    "testing": true,
    "reports": true
  }'::jsonb,
  ai_enabled          boolean NOT NULL DEFAULT true,
  ai_monthly_limit    integer NOT NULL DEFAULT 50,
  ai_used_this_month  integer NOT NULL DEFAULT 0,
  ai_bonus_credits    integer NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  updated_by          text NOT NULL DEFAULT '',
  CONSTRAINT org_settings_account_status_check CHECK (account_status IN ('active', 'disabled'))
);

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

-- Org members can read their own settings (needed by frontend module gates)
CREATE POLICY "Org members can read own settings"
  ON org_settings FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM user_orgs
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Only platform_admins can insert org settings rows
CREATE POLICY "Platform admins can insert org settings"
  ON org_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
      AND status = 'active'
    )
  );

-- Only platform_admins can update org settings
CREATE POLICY "Platform admins can update org settings"
  ON org_settings FOR UPDATE
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

-- Only platform_admins can delete org settings
CREATE POLICY "Platform admins can delete org settings"
  ON org_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
      AND status = 'active'
    )
  );

-- Seed default settings row for the existing NEXA Solutions org
INSERT INTO org_settings (org_id, account_status, ai_enabled, ai_monthly_limit, updated_by)
VALUES (
  'd0000000-0000-4000-a000-000000000001',
  'active',
  true,
  50,
  'system'
)
ON CONFLICT (org_id) DO NOTHING;
