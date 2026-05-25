/*
  # Fix: Add authenticated role policies to all operational tables

  ## Problem
  Every operational table has RLS enabled with policies scoped to the `anon`
  role only. When Supabase Auth was introduced (Phase 2.5), the JS client began
  sending requests as the `authenticated` role (JWT bearer). In Postgres/Supabase,
  `anon` and `authenticated` are entirely separate roles — a policy on `anon`
  does NOT apply to authenticated sessions.

  Result: every read returned an empty array and every write was silently dropped
  for logged-in users. Users and projects appeared to persist in UI state during
  the session but disappeared on refresh because they were never written to the DB.

  ## Fix
  Add permissive `authenticated` role policies (SELECT/INSERT/UPDATE/DELETE) to
  all 11 operational tables. These mirror the existing `anon` policies and
  maintain the same open access that was working before auth was introduced.

  This is intentionally permissive — org-scoped RLS enforcement comes in Phase 3.
  The goal here is to restore baseline functionality for authenticated users while
  keeping the architecture intact for the Phase 3 upgrade.

  ## Tables covered
  - vy_projects
  - vy_actions
  - vy_snags
  - vy_site_forms
  - vy_tc_records
  - vy_tenders
  - vy_project_documents
  - vy_attachments
  - vy_notifications
  - vy_platform_users
  - vy_settings

  ## Notes
  - Existing anon policies are preserved (not removed)
  - No schema changes
  - No data changes
  - No org-scoped filtering yet (Phase 3)
*/

-- ─── vy_projects ──────────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_projects"
  ON vy_projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_projects"
  ON vy_projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_projects"
  ON vy_projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_projects"
  ON vy_projects FOR DELETE TO authenticated USING (true);

-- ─── vy_actions ───────────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_actions"
  ON vy_actions FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_actions"
  ON vy_actions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_actions"
  ON vy_actions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_actions"
  ON vy_actions FOR DELETE TO authenticated USING (true);

-- ─── vy_snags ─────────────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_snags"
  ON vy_snags FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_snags"
  ON vy_snags FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_snags"
  ON vy_snags FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_snags"
  ON vy_snags FOR DELETE TO authenticated USING (true);

-- ─── vy_site_forms ────────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_site_forms"
  ON vy_site_forms FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_site_forms"
  ON vy_site_forms FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_site_forms"
  ON vy_site_forms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_site_forms"
  ON vy_site_forms FOR DELETE TO authenticated USING (true);

-- ─── vy_tc_records ────────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_tc_records"
  ON vy_tc_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_tc_records"
  ON vy_tc_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_tc_records"
  ON vy_tc_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_tc_records"
  ON vy_tc_records FOR DELETE TO authenticated USING (true);

-- ─── vy_tenders ───────────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_tenders"
  ON vy_tenders FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_tenders"
  ON vy_tenders FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_tenders"
  ON vy_tenders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_tenders"
  ON vy_tenders FOR DELETE TO authenticated USING (true);

-- ─── vy_project_documents ─────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_project_documents"
  ON vy_project_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_project_documents"
  ON vy_project_documents FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_project_documents"
  ON vy_project_documents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_project_documents"
  ON vy_project_documents FOR DELETE TO authenticated USING (true);

-- ─── vy_attachments ───────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_attachments"
  ON vy_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_attachments"
  ON vy_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_attachments"
  ON vy_attachments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_attachments"
  ON vy_attachments FOR DELETE TO authenticated USING (true);

-- ─── vy_notifications ─────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_notifications"
  ON vy_notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_notifications"
  ON vy_notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_notifications"
  ON vy_notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_notifications"
  ON vy_notifications FOR DELETE TO authenticated USING (true);

-- ─── vy_platform_users ────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_platform_users"
  ON vy_platform_users FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_platform_users"
  ON vy_platform_users FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_platform_users"
  ON vy_platform_users FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_platform_users"
  ON vy_platform_users FOR DELETE TO authenticated USING (true);

-- ─── vy_settings ──────────────────────────────────────────────────────────────

CREATE POLICY "authenticated can read vy_settings"
  ON vy_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can insert vy_settings"
  ON vy_settings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated can update vy_settings"
  ON vy_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated can delete vy_settings"
  ON vy_settings FOR DELETE TO authenticated USING (true);
