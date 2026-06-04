/*
  # Commercial Module — Phase A: vy_commercial_records

  Creates the core commercial register table for the VYSITE Commercial Module.

  ## New Tables
  - `vy_commercial_records`
    - `id`             — UUID primary key
    - `org_id`         — Organisation scope
    - `project_id`     — Linked project (nullable)
    - `record_type`    — 'variation' | 'delay_notice' | 'compensation_event'
    - `reference`      — Manually entered reference e.g. V001, DN001, CE001
    - `title`          — Record title
    - `client`         — Client name
    - `status`         — Commercial lifecycle status
    - `date_raised`    — Date internally raised
    - `date_submitted` — Date submitted to client (nullable)
    - `date_agreed`    — Date agreed / closed (nullable)
    - `notes`          — Internal notes
    - `created_by`     — auth.uid() of creator
    - `created_at`     — Row creation timestamp
    - `updated_at`     — Last update timestamp

  ## Status values (text, not enum — adding statuses later requires no migration)
  draft | submitted | awaiting_agreement | agreed | added_to_valuation | paid | complete | rejected

  ## Security
  - RLS enabled, org-scoped via user_orgs.org_id
  - Four separate policies: SELECT, INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS vy_commercial_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  project_id     uuid,
  record_type    text NOT NULL DEFAULT 'variation',
  reference      text NOT NULL DEFAULT '',
  title          text NOT NULL DEFAULT '',
  client         text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'draft',
  date_raised    date,
  date_submitted date,
  date_agreed    date,
  notes          text NOT NULL DEFAULT '',
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_commercial_records_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_records_updated_at ON vy_commercial_records;
CREATE TRIGGER trg_commercial_records_updated_at
  BEFORE UPDATE ON vy_commercial_records
  FOR EACH ROW EXECUTE FUNCTION update_commercial_records_updated_at();

CREATE INDEX IF NOT EXISTS idx_commercial_records_org_id     ON vy_commercial_records(org_id);
CREATE INDEX IF NOT EXISTS idx_commercial_records_project_id ON vy_commercial_records(project_id);
CREATE INDEX IF NOT EXISTS idx_commercial_records_status     ON vy_commercial_records(status);
CREATE INDEX IF NOT EXISTS idx_commercial_records_type       ON vy_commercial_records(record_type);

ALTER TABLE vy_commercial_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view commercial records"
  ON vy_commercial_records FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can create commercial records"
  ON vy_commercial_records FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can update commercial records"
  ON vy_commercial_records FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can delete commercial records"
  ON vy_commercial_records FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );
