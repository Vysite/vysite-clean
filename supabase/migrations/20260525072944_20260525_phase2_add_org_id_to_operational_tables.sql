/*
  # Phase 2 – Add org_id to All Operational Tables

  ## Summary
  Extends every operational table with an org_id column so each record is
  explicitly owned by an organisation. This is the prerequisite for
  organisation-scoped RLS (Phase 3) and frontend filtering (Phase 4).

  ## Changes

  ### 1. New column: org_id (uuid, FK → organisations.id)
  Added to:
    - vy_projects
    - vy_actions
    - vy_snags
    - vy_site_forms
    - vy_tc_records
    - vy_tenders
    - vy_project_documents
    - vy_attachments
    - vy_notifications
    - vy_settings

  Column is added as NULLABLE first to allow safe backfill, then set NOT NULL.

  ### 2. Backfill
  Every existing row in all tables is assigned to the NEXA Solutions
  organisation (d0000000-0000-4000-a000-000000000001).

  ### 3. NOT NULL constraint
  Applied after backfill so no row is left without an org_id.

  ### 4. Indexes
  A btree index on org_id is created for every table to support efficient
  organisation-scoped queries in Phase 3+.

  ### 5. RLS
  No RLS changes in this phase. Existing policies are untouched.

  ### 6. Settings
  vy_settings keeps its current singleton/workspace design. org_id is added
  and backfilled only. Full settings redesign is deferred.

  ## Notes
  - All operations use IF NOT EXISTS / conditional checks to be idempotent.
  - No rows are deleted. No tables are dropped.
  - NEXA Solutions org id: d0000000-0000-4000-a000-000000000001
*/

-- vy_projects
ALTER TABLE vy_projects
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_projects
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_projects
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_projects_org_id ON vy_projects(org_id);

-- vy_actions
ALTER TABLE vy_actions
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_actions
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_actions
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_actions_org_id ON vy_actions(org_id);

-- vy_snags
ALTER TABLE vy_snags
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_snags
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_snags
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_snags_org_id ON vy_snags(org_id);

-- vy_site_forms
ALTER TABLE vy_site_forms
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_site_forms
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_site_forms
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_site_forms_org_id ON vy_site_forms(org_id);

-- vy_tc_records
ALTER TABLE vy_tc_records
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_tc_records
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_tc_records
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_tc_records_org_id ON vy_tc_records(org_id);

-- vy_tenders
ALTER TABLE vy_tenders
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_tenders
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_tenders
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_tenders_org_id ON vy_tenders(org_id);

-- vy_project_documents
ALTER TABLE vy_project_documents
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_project_documents
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_project_documents
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_project_documents_org_id ON vy_project_documents(org_id);

-- vy_attachments
ALTER TABLE vy_attachments
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_attachments
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_attachments
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_attachments_org_id ON vy_attachments(org_id);

-- vy_notifications
ALTER TABLE vy_notifications
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_notifications
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_notifications
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_notifications_org_id ON vy_notifications(org_id);

-- vy_settings
ALTER TABLE vy_settings
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);

UPDATE vy_settings
  SET org_id = 'd0000000-0000-4000-a000-000000000001'
  WHERE org_id IS NULL;

ALTER TABLE vy_settings
  ALTER COLUMN org_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vy_settings_org_id ON vy_settings(org_id);
