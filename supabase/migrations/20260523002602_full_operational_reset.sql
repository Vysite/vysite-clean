/*
  # Full operational data reset

  ## Summary
  Truncates all user-generated and seeded data from every content table,
  leaving the schema, RLS policies, settings, and attachments intact.
  This produces a clean fresh workspace with no demo, seed, or test records.

  ## Tables cleared
  - vy_platform_users   (all users including re-seeded demo users)
  - vy_projects
  - vy_actions
  - vy_snags
  - vy_site_forms
  - vy_tenders
  - vy_tc_records
  - vy_notifications
  - vy_attachments
  - vy_project_documents

  ## Tables preserved
  - vy_settings         (workspace config, branding, accent colour)

  ## Notes
  - Schema, RLS policies, and indexes are untouched
  - vy_settings row (id='workspace') is kept — all branding/config preserved
  - After this migration the app will show clean empty states on all pages
*/

TRUNCATE TABLE
  vy_platform_users,
  vy_projects,
  vy_actions,
  vy_snags,
  vy_site_forms,
  vy_tenders,
  vy_tc_records,
  vy_notifications,
  vy_attachments,
  vy_project_documents;
