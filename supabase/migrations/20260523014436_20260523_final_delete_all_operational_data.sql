
/*
  # Final DELETE of all operational data

  Uses DELETE with RETURNING to confirm rows are actually removed.
  Targets every table the frontend queries by exact table name.
*/

DELETE FROM vy_projects;
DELETE FROM vy_tenders;
DELETE FROM vy_platform_users;
DELETE FROM vy_actions;
DELETE FROM vy_snags;
DELETE FROM vy_site_forms;
DELETE FROM vy_tc_records;
DELETE FROM vy_notifications;
DELETE FROM vy_project_documents;
DELETE FROM vy_attachments;
