/*
  # Snagging Reports Enhancement

  ## Summary
  Adds professional snagging workflow support.

  1. Modified Tables
     - `vy_snags`: adds `extra_data jsonb`, `report_id text`, `snag_number text`
       for extended snag fields (trade, rectification, responsible_party, closure data, etc.)

  2. New Tables
     - `vy_snagging_reports`: stores snagging report headers
       (project, area/block, floor/location, inspector, contractor, client, status, completion%)

  3. Security
     - RLS enabled on `vy_snagging_reports`
     - Org-scoped policies using the existing is_org_member / is_org_manager_or_above helpers
*/

-- 1. Add extra_data to vy_snags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_snags' AND column_name = 'extra_data'
  ) THEN
    ALTER TABLE vy_snags ADD COLUMN extra_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. Add report_id to vy_snags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_snags' AND column_name = 'report_id'
  ) THEN
    ALTER TABLE vy_snags ADD COLUMN report_id text DEFAULT NULL;
  END IF;
END $$;

-- 3. Add snag_number to vy_snags
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_snags' AND column_name = 'snag_number'
  ) THEN
    ALTER TABLE vy_snags ADD COLUMN snag_number text DEFAULT NULL;
  END IF;
END $$;

-- 4. Create vy_snagging_reports table
CREATE TABLE IF NOT EXISTS vy_snagging_reports (
  id                     text PRIMARY KEY,
  org_id                 uuid NOT NULL,
  project_id             text NOT NULL DEFAULT '',
  project_name           text NOT NULL DEFAULT '',
  title                  text NOT NULL DEFAULT '',
  area_block             text NOT NULL DEFAULT '',
  floor_location         text NOT NULL DEFAULT '',
  inspection_date        text NOT NULL DEFAULT '',
  inspector              text NOT NULL DEFAULT '',
  contractor             text NOT NULL DEFAULT '',
  client                 text NOT NULL DEFAULT '',
  status                 text NOT NULL DEFAULT 'Draft',
  overall_completion_pct integer NOT NULL DEFAULT 0,
  notes                  text NOT NULL DEFAULT '',
  created_by             text NOT NULL DEFAULT '',
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

ALTER TABLE vy_snagging_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can select snagging reports"
  ON vy_snagging_reports FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert snagging reports"
  ON vy_snagging_reports FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update snagging reports"
  ON vy_snagging_reports FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Managers can delete snagging reports"
  ON vy_snagging_reports FOR DELETE
  TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));
