/*
  # Remove seeded demo data from all tables

  ## Summary
  Deletes only the known demo/seed records that were auto-inserted by the
  application's seed functions on first load. These records are identified by
  their hard-coded IDs from sampleData.ts and TestingCommissioning.tsx.

  ## Records removed
  - vy_projects:         p1, p2, p3, p4
  - vy_actions:          a1 – a8
  - vy_snags:            s1 – s7
  - vy_site_forms:       f1 – f5
  - vy_tenders:          t1 – t4
  - vy_tc_records:       tc1 – tc4
  - vy_platform_users:   u1 – u8
  - vy_notifications:    all linked to seed project IDs (p1–p4) or seed user IDs
  - vy_attachments:      all linked to seed record IDs (a1–a8, s1–s7, f1–f5)

  ## Safety
  Only records whose IDs exactly match the seed data constants are deleted.
  All real user-created records (IDs generated at runtime with timestamps)
  are untouched.
*/

-- Remove attachments linked to seed records
DELETE FROM vy_attachments
WHERE linked_id IN ('a1','a2','a3','a4','a5','a6','a7','a8',
                    's1','s2','s3','s4','s5','s6','s7',
                    'f1','f2','f3','f4','f5');

-- Remove notifications linked to seed projects or seed users
DELETE FROM vy_notifications
WHERE project_id IN ('p1','p2','p3','p4')
   OR recipient_id IN ('u1','u2','u3','u4','u5','u6','u7','u8');

-- Remove TC records
DELETE FROM vy_tc_records
WHERE id IN ('tc1','tc2','tc3','tc4');

-- Remove site forms
DELETE FROM vy_site_forms
WHERE id IN ('f1','f2','f3','f4','f5');

-- Remove snags
DELETE FROM vy_snags
WHERE id IN ('s1','s2','s3','s4','s5','s6','s7');

-- Remove actions
DELETE FROM vy_actions
WHERE id IN ('a1','a2','a3','a4','a5','a6','a7','a8');

-- Remove tenders
DELETE FROM vy_tenders
WHERE id IN ('t1','t2','t3','t4');

-- Remove projects
DELETE FROM vy_projects
WHERE id IN ('p1','p2','p3','p4');

-- Remove platform users (seed users u1–u8)
DELETE FROM vy_platform_users
WHERE id IN ('u1','u2','u3','u4','u5','u6','u7','u8');
