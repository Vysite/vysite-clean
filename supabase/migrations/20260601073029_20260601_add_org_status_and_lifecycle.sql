/*
  # Organisation Lifecycle Status

  ## Summary
  Adds status management to organisations for the Super Admin panel.

  ## Changes to `organisations`
  - `status` (text): 'active' | 'archived' | 'deleted'. Defaults to 'active'.
  - `archived_at` (timestamptz): set when status transitions to 'archived', cleared on restore.
  - `deleted_at` (timestamptz): set when permanently deleted (soft-delete marker before cascade wipe).

  ## New function: `super_admin_delete_org(org_id uuid)`
  Permanently deletes all records for an organisation in dependency order.
  Only callable by a confirmed super admin (verified via is_super_admin()).

  ## Security
  - Super admins can update org status (archive/restore) via existing RLS.
  - The delete function uses SECURITY DEFINER so only super admins can invoke it.
  - All existing RLS policies unchanged.
*/

-- ── 1. Add lifecycle columns to organisations ────────────────────────────────

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'archived'::text, 'deleted'::text])),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz DEFAULT NULL;

-- Index for the super admin organisations list (filters by status)
CREATE INDEX IF NOT EXISTS organisations_status_idx ON organisations (status);

-- ── 2. Add org_status to org_settings constraint (align with org lifecycle) ──
-- The existing account_status on org_settings still controls in-app access.
-- We use the organisations.status column for the super admin lifecycle view.
-- No changes needed to org_settings — the App already gates on account_status.

-- ── 3. Function: super_admin_delete_org ──────────────────────────────────────
-- Permanently removes all data for an org in safe dependency order.
-- SECURITY DEFINER runs as the function owner (postgres) to bypass RLS.
-- The caller must be a super admin — we verify this inside the function.

CREATE OR REPLACE FUNCTION super_admin_delete_org(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is a super admin
  IF NOT (SELECT is_super_admin()) THEN
    RAISE EXCEPTION 'Permission denied: super admin access required';
  END IF;

  -- Delete in dependency order (child rows first, then parents)
  DELETE FROM vy_programme_tasks  WHERE org_id = p_org_id;
  DELETE FROM vy_programmes       WHERE org_id = p_org_id;
  DELETE FROM vy_maintenance_jobs WHERE org_id = p_org_id;
  DELETE FROM vy_tc_records       WHERE org_id = p_org_id;
  DELETE FROM vy_snagging_reports WHERE org_id = p_org_id;
  DELETE FROM vy_snags            WHERE org_id = p_org_id;
  DELETE FROM vy_site_forms       WHERE org_id = p_org_id;
  DELETE FROM vy_actions          WHERE org_id = p_org_id;
  DELETE FROM vy_attachments      WHERE org_id = p_org_id;
  DELETE FROM vy_project_documents WHERE org_id = p_org_id;
  DELETE FROM vy_notifications    WHERE org_id = p_org_id;
  DELETE FROM vy_tenders          WHERE org_id = p_org_id;
  DELETE FROM vy_projects         WHERE org_id = p_org_id;
  DELETE FROM vy_settings         WHERE org_id = p_org_id;
  DELETE FROM vy_platform_users   WHERE org_id = p_org_id;
  DELETE FROM user_orgs           WHERE org_id = p_org_id;
  DELETE FROM org_settings        WHERE org_id = p_org_id;
  DELETE FROM organisations       WHERE id     = p_org_id;
END;
$$;

-- Revoke public execute, grant only to authenticated role (super admin check is internal)
REVOKE ALL ON FUNCTION super_admin_delete_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION super_admin_delete_org(uuid) TO authenticated;
