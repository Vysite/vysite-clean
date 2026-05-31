/*
  # Phase 3: Org-Scoped RLS — Replace authenticated bridge policies

  ## Summary
  Replaces all 44 temporary "authenticated USING (true)" bridge policies on the
  11 operational vy_* tables with proper organisation-scoped Row Level Security.

  ## New policy model
  - SELECT: user must be an active member of the row's org (via user_orgs)
  - INSERT: user must be an active member of the target org (WITH CHECK on new.org_id)
  - UPDATE: user must be a member of both existing and new org
  - DELETE: restricted to user_orgs roles: platform_admin, company_owner, manager

  ## Helper functions
  Two SECURITY DEFINER functions bypass RLS on user_orgs to prevent recursion:
    - is_org_member(user_id, org_id) — used for SELECT/INSERT/UPDATE
    - is_org_manager_or_above(user_id, org_id) — used for DELETE

  ## Tables affected
  vy_projects, vy_actions, vy_snags, vy_site_forms, vy_tc_records,
  vy_tenders, vy_project_documents, vy_attachments, vy_notifications,
  vy_platform_users, vy_settings

  ## Notes
  - vy_settings: org members can read; only platform_admin / company_owner can write
  - vy_platform_users: org-scoped; all org members can read their own org's users
  - user_orgs and organisations policies are not modified
*/

-- ─── Step 1: Helper functions ────────────────────────────────────────────────

-- Returns true if the given user is an active member of the given org.
-- SECURITY DEFINER bypasses RLS on user_orgs to avoid recursion.
CREATE OR REPLACE FUNCTION is_org_member(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_orgs
    WHERE user_id = p_user_id
      AND org_id  = p_org_id
      AND status  = 'active'
  );
$$;

-- Returns true if the user holds a manager-or-above role in the org.
-- Covers: platform_admin, company_owner, manager
CREATE OR REPLACE FUNCTION is_org_manager_or_above(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_orgs
    WHERE user_id = p_user_id
      AND org_id  = p_org_id
      AND status  = 'active'
      AND role    IN ('platform_admin', 'company_owner', 'manager')
  );
$$;

-- ─── Step 2: Drop all bridge policies ───────────────────────────────────────

-- vy_projects
DROP POLICY IF EXISTS "authenticated can read vy_projects"   ON vy_projects;
DROP POLICY IF EXISTS "authenticated can insert vy_projects" ON vy_projects;
DROP POLICY IF EXISTS "authenticated can update vy_projects" ON vy_projects;
DROP POLICY IF EXISTS "authenticated can delete vy_projects" ON vy_projects;

-- vy_actions
DROP POLICY IF EXISTS "authenticated can read vy_actions"   ON vy_actions;
DROP POLICY IF EXISTS "authenticated can insert vy_actions" ON vy_actions;
DROP POLICY IF EXISTS "authenticated can update vy_actions" ON vy_actions;
DROP POLICY IF EXISTS "authenticated can delete vy_actions" ON vy_actions;

-- vy_snags
DROP POLICY IF EXISTS "authenticated can read vy_snags"   ON vy_snags;
DROP POLICY IF EXISTS "authenticated can insert vy_snags" ON vy_snags;
DROP POLICY IF EXISTS "authenticated can update vy_snags" ON vy_snags;
DROP POLICY IF EXISTS "authenticated can delete vy_snags" ON vy_snags;

-- vy_site_forms
DROP POLICY IF EXISTS "authenticated can read vy_site_forms"   ON vy_site_forms;
DROP POLICY IF EXISTS "authenticated can insert vy_site_forms" ON vy_site_forms;
DROP POLICY IF EXISTS "authenticated can update vy_site_forms" ON vy_site_forms;
DROP POLICY IF EXISTS "authenticated can delete vy_site_forms" ON vy_site_forms;

-- vy_tenders
DROP POLICY IF EXISTS "authenticated can read vy_tenders"   ON vy_tenders;
DROP POLICY IF EXISTS "authenticated can insert vy_tenders" ON vy_tenders;
DROP POLICY IF EXISTS "authenticated can update vy_tenders" ON vy_tenders;
DROP POLICY IF EXISTS "authenticated can delete vy_tenders" ON vy_tenders;

-- vy_tc_records
DROP POLICY IF EXISTS "authenticated can read vy_tc_records"   ON vy_tc_records;
DROP POLICY IF EXISTS "authenticated can insert vy_tc_records" ON vy_tc_records;
DROP POLICY IF EXISTS "authenticated can update vy_tc_records" ON vy_tc_records;
DROP POLICY IF EXISTS "authenticated can delete vy_tc_records" ON vy_tc_records;

-- vy_project_documents
DROP POLICY IF EXISTS "authenticated can read vy_project_documents"   ON vy_project_documents;
DROP POLICY IF EXISTS "authenticated can insert vy_project_documents" ON vy_project_documents;
DROP POLICY IF EXISTS "authenticated can update vy_project_documents" ON vy_project_documents;
DROP POLICY IF EXISTS "authenticated can delete vy_project_documents" ON vy_project_documents;

-- vy_attachments
DROP POLICY IF EXISTS "authenticated can read vy_attachments"   ON vy_attachments;
DROP POLICY IF EXISTS "authenticated can insert vy_attachments" ON vy_attachments;
DROP POLICY IF EXISTS "authenticated can update vy_attachments" ON vy_attachments;
DROP POLICY IF EXISTS "authenticated can delete vy_attachments" ON vy_attachments;

-- vy_notifications
DROP POLICY IF EXISTS "authenticated can read vy_notifications"   ON vy_notifications;
DROP POLICY IF EXISTS "authenticated can insert vy_notifications" ON vy_notifications;
DROP POLICY IF EXISTS "authenticated can update vy_notifications" ON vy_notifications;
DROP POLICY IF EXISTS "authenticated can delete vy_notifications" ON vy_notifications;

-- vy_platform_users
DROP POLICY IF EXISTS "authenticated can read vy_platform_users"   ON vy_platform_users;
DROP POLICY IF EXISTS "authenticated can insert vy_platform_users" ON vy_platform_users;
DROP POLICY IF EXISTS "authenticated can update vy_platform_users" ON vy_platform_users;
DROP POLICY IF EXISTS "authenticated can delete vy_platform_users" ON vy_platform_users;

-- vy_settings
DROP POLICY IF EXISTS "authenticated can read vy_settings"   ON vy_settings;
DROP POLICY IF EXISTS "authenticated can insert vy_settings" ON vy_settings;
DROP POLICY IF EXISTS "authenticated can update vy_settings" ON vy_settings;
DROP POLICY IF EXISTS "authenticated can delete vy_settings" ON vy_settings;

-- ─── Step 3: Create org-scoped policies ─────────────────────────────────────
-- Pattern used for 9 standard operational tables:
--   SELECT  — active org member
--   INSERT  — active org member, new row's org_id matches membership
--   UPDATE  — active org member on both old and new org
--   DELETE  — manager-or-above in the row's org

-- ── vy_projects ──────────────────────────────────────────────────────────────
CREATE POLICY "Org members can read own org projects"
  ON vy_projects FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert projects into own org"
  ON vy_projects FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org projects"
  ON vy_projects FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org projects"
  ON vy_projects FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_actions ───────────────────────────────────────────────────────────────
CREATE POLICY "Org members can read own org actions"
  ON vy_actions FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert actions into own org"
  ON vy_actions FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org actions"
  ON vy_actions FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org actions"
  ON vy_actions FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_snags ─────────────────────────────────────────────────────────────────
CREATE POLICY "Org members can read own org snags"
  ON vy_snags FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert snags into own org"
  ON vy_snags FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org snags"
  ON vy_snags FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org snags"
  ON vy_snags FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_site_forms ────────────────────────────────────────────────────────────
CREATE POLICY "Org members can read own org site forms"
  ON vy_site_forms FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert site forms into own org"
  ON vy_site_forms FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org site forms"
  ON vy_site_forms FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org site forms"
  ON vy_site_forms FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_tenders ───────────────────────────────────────────────────────────────
CREATE POLICY "Org members can read own org tenders"
  ON vy_tenders FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert tenders into own org"
  ON vy_tenders FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org tenders"
  ON vy_tenders FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org tenders"
  ON vy_tenders FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_tc_records ────────────────────────────────────────────────────────────
CREATE POLICY "Org members can read own org TC records"
  ON vy_tc_records FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert TC records into own org"
  ON vy_tc_records FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org TC records"
  ON vy_tc_records FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org TC records"
  ON vy_tc_records FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_project_documents ─────────────────────────────────────────────────────
CREATE POLICY "Org members can read own org project documents"
  ON vy_project_documents FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert project documents into own org"
  ON vy_project_documents FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org project documents"
  ON vy_project_documents FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org project documents"
  ON vy_project_documents FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_attachments ───────────────────────────────────────────────────────────
CREATE POLICY "Org members can read own org attachments"
  ON vy_attachments FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert attachments into own org"
  ON vy_attachments FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org attachments"
  ON vy_attachments FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org attachments"
  ON vy_attachments FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_notifications ─────────────────────────────────────────────────────────
-- Notifications: any org member can read/insert/update (mark-read).
-- Delete: managers only.
CREATE POLICY "Org members can read own org notifications"
  ON vy_notifications FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert notifications into own org"
  ON vy_notifications FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update own org notifications"
  ON vy_notifications FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete own org notifications"
  ON vy_notifications FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ── vy_platform_users ────────────────────────────────────────────────────────
-- vy_platform_users.org_id is nullable (legacy), so we coalesce for the check.
-- All org members can read their org's users.
-- Only managers-or-above can insert/update/delete.
CREATE POLICY "Org members can read own org platform users"
  ON vy_platform_users FOR SELECT TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_member(auth.uid(), org_id)
  );

CREATE POLICY "Managers can insert platform users into own org"
  ON vy_platform_users FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );

CREATE POLICY "Managers can update own org platform users"
  ON vy_platform_users FOR UPDATE TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );

CREATE POLICY "Managers can delete own org platform users"
  ON vy_platform_users FOR DELETE TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );

-- ── vy_settings ──────────────────────────────────────────────────────────────
-- Read: any active org member.
-- Write (insert/update/delete): platform_admin or company_owner only.
CREATE POLICY "Org members can read own org settings"
  ON vy_settings FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can insert own org settings"
  ON vy_settings FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin_of_org(auth.uid(), org_id));

CREATE POLICY "Org admins can update own org settings"
  ON vy_settings FOR UPDATE TO authenticated
  USING (is_platform_admin_of_org(auth.uid(), org_id))
  WITH CHECK (is_platform_admin_of_org(auth.uid(), org_id));

CREATE POLICY "Org admins can delete own org settings"
  ON vy_settings FOR DELETE TO authenticated
  USING (is_platform_admin_of_org(auth.uid(), org_id));
