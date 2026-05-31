/*
  # Final wipe — sampleData.ts deleted, all imports moved to types.ts
  The old sampleData.ts file has been deleted from the project entirely.
  Vite's module cache cannot resurrect a file that no longer exists.
  This wipe clears any residual rows inserted before the rename.
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
