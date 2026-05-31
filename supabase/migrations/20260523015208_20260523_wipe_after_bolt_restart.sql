/*
  # Wipe all operational data — post Bolt restart

  All rows were traced to a single batch upsert at 01:45:28 UTC from
  an older HMR module instance in the Bolt dev server. The current
  codebase has no seeding code. This wipe runs after Bolt's full
  preview restart to ensure the clean module is active.
*/

DELETE FROM vy_attachments;
DELETE FROM vy_project_documents;
DELETE FROM vy_notifications;
DELETE FROM vy_actions;
DELETE FROM vy_snags;
DELETE FROM vy_site_forms;
DELETE FROM vy_tc_records;
DELETE FROM vy_tenders;
DELETE FROM vy_projects;
DELETE FROM vy_platform_users;
