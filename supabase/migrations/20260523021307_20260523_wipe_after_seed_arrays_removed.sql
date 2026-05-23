/*
  # Final wipe after seed arrays removed from sampleData.ts
  All exported data arrays (projects, snags, siteForms, users, tenders,
  recentActivity, _actionStore) have been emptied in source. Even if Vite
  serves an old cached module, it now gets empty arrays and cannot seed.
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
