/*
  # Wipe before server-side trace capture
  Write interceptor now logs to vy_write_trace_log — traces readable server-side.
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
