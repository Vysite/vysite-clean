/*
  # Wipe — close all app browser tabs before running this
  Root cause: an older deployed build (Vercel or previous Bolt preview)
  is open in a browser tab and re-seeds on mount when it detects empty tables.
  Close all tabs first, then this wipe will hold.
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
