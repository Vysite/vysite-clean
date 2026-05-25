/*
  # Remove overly-permissive anon bridge policies from all vy_* tables

  ## Background
  All vy_* operational tables were created with temporary "bridge" policies
  that grant full access (USING (true) / WITH CHECK (true)) to both the anon
  and authenticated roles. These were scaffolding for early development.

  ## Changes
  This migration removes ALL anon-role policies from every vy_* table.
  The anon role has no legitimate need to read, write, or delete any
  operational data. Only authenticated users should access this data.

  ## What stays
  - All authenticated-role policies are left in place (still broad, but
    require a valid Supabase session). These will be tightened to
    org-scoped policies in the final Phase 3 RLS migration.

  ## Tables affected
  vy_projects, vy_actions, vy_snags, vy_site_forms, vy_tenders,
  vy_tc_records, vy_attachments, vy_project_documents, vy_notifications,
  vy_platform_users, vy_settings
*/

-- vy_projects
DROP POLICY IF EXISTS "anon can read vy_projects" ON vy_projects;
DROP POLICY IF EXISTS "anon can insert vy_projects" ON vy_projects;
DROP POLICY IF EXISTS "anon can update vy_projects" ON vy_projects;
DROP POLICY IF EXISTS "anon can delete vy_projects" ON vy_projects;

-- vy_actions
DROP POLICY IF EXISTS "anon full access vy_actions" ON vy_actions;
DROP POLICY IF EXISTS "anon insert vy_actions" ON vy_actions;
DROP POLICY IF EXISTS "anon update vy_actions" ON vy_actions;
DROP POLICY IF EXISTS "anon delete vy_actions" ON vy_actions;

-- vy_snags
DROP POLICY IF EXISTS "anon full access vy_snags" ON vy_snags;
DROP POLICY IF EXISTS "anon insert vy_snags" ON vy_snags;
DROP POLICY IF EXISTS "anon update vy_snags" ON vy_snags;
DROP POLICY IF EXISTS "anon delete vy_snags" ON vy_snags;

-- vy_site_forms
DROP POLICY IF EXISTS "anon full access vy_site_forms" ON vy_site_forms;
DROP POLICY IF EXISTS "anon insert vy_site_forms" ON vy_site_forms;
DROP POLICY IF EXISTS "anon update vy_site_forms" ON vy_site_forms;
DROP POLICY IF EXISTS "anon delete vy_site_forms" ON vy_site_forms;

-- vy_tenders
DROP POLICY IF EXISTS "anon full access vy_tenders" ON vy_tenders;
DROP POLICY IF EXISTS "anon insert vy_tenders" ON vy_tenders;
DROP POLICY IF EXISTS "anon update vy_tenders" ON vy_tenders;
DROP POLICY IF EXISTS "anon delete vy_tenders" ON vy_tenders;

-- vy_tc_records
DROP POLICY IF EXISTS "anon full access vy_tc_records" ON vy_tc_records;
DROP POLICY IF EXISTS "anon insert vy_tc_records" ON vy_tc_records;
DROP POLICY IF EXISTS "anon update vy_tc_records" ON vy_tc_records;
DROP POLICY IF EXISTS "anon delete vy_tc_records" ON vy_tc_records;

-- vy_attachments
DROP POLICY IF EXISTS "anon can read vy_attachments" ON vy_attachments;
DROP POLICY IF EXISTS "anon can insert vy_attachments" ON vy_attachments;
DROP POLICY IF EXISTS "anon can update vy_attachments" ON vy_attachments;
DROP POLICY IF EXISTS "anon can delete vy_attachments" ON vy_attachments;

-- vy_project_documents
DROP POLICY IF EXISTS "anon can read vy_project_documents" ON vy_project_documents;
DROP POLICY IF EXISTS "anon can insert vy_project_documents" ON vy_project_documents;
DROP POLICY IF EXISTS "anon can update vy_project_documents" ON vy_project_documents;
DROP POLICY IF EXISTS "anon can delete vy_project_documents" ON vy_project_documents;

-- vy_notifications
DROP POLICY IF EXISTS "Allow anon read notifications" ON vy_notifications;
DROP POLICY IF EXISTS "Allow anon insert notifications" ON vy_notifications;
DROP POLICY IF EXISTS "Allow anon update notifications" ON vy_notifications;
DROP POLICY IF EXISTS "Allow anon delete notifications" ON vy_notifications;

-- vy_platform_users
DROP POLICY IF EXISTS "Allow anon read platform users" ON vy_platform_users;
DROP POLICY IF EXISTS "Allow anon insert platform users" ON vy_platform_users;
DROP POLICY IF EXISTS "Allow anon update platform users" ON vy_platform_users;
DROP POLICY IF EXISTS "Allow anon delete platform users" ON vy_platform_users;

-- vy_settings
DROP POLICY IF EXISTS "anon can read settings" ON vy_settings;
DROP POLICY IF EXISTS "anon can insert settings" ON vy_settings;
DROP POLICY IF EXISTS "anon can update settings" ON vy_settings;
DROP POLICY IF EXISTS "anon can delete vy_settings" ON vy_settings;
