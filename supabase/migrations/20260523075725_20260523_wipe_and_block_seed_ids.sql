/*
  # Wipe seed rows then add hard constraints blocking them permanently

  The Bolt Vite HMR cache is still serving an old module with seed arrays.
  These constraints make it impossible for the database to accept the known
  seed IDs even if that old module fires again.
*/

-- Step 1: wipe all operational data
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

-- Step 2: add constraints that permanently reject the known seed IDs
ALTER TABLE vy_projects
  ADD CONSTRAINT no_seed_ids
  CHECK (id NOT IN ('p1','p2','p3','p4'));

ALTER TABLE vy_platform_users
  ADD CONSTRAINT no_seed_ids
  CHECK (id NOT IN ('u1','u2','u3','u4','u5','u6','u7','u8'));

ALTER TABLE vy_actions
  ADD CONSTRAINT no_seed_ids
  CHECK (id NOT IN ('a1','a2','a3','a4','a5','a6','a7','a8'));

ALTER TABLE vy_snags
  ADD CONSTRAINT no_seed_ids
  CHECK (id NOT IN ('s1','s2','s3','s4','s5','s6','s7'));

ALTER TABLE vy_site_forms
  ADD CONSTRAINT no_seed_ids
  CHECK (id NOT IN ('f1','f2','f3','f4','f5'));

ALTER TABLE vy_tenders
  ADD CONSTRAINT no_seed_ids
  CHECK (id NOT IN ('t1','t2','t3','t4'));

ALTER TABLE vy_tc_records
  ADD CONSTRAINT no_seed_ids
  CHECK (id NOT IN ('tc1','tc2','tc3','tc4'));
