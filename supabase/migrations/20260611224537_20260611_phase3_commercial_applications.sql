-- Phase 3: Commercial Applications (Valuation Applications)

CREATE TABLE IF NOT EXISTS vy_commercial_applications (
  id              text PRIMARY KEY,
  org_id          text NOT NULL,
  project_id      text NOT NULL,
  app_number      integer NOT NULL DEFAULT 1,
  period          text NOT NULL DEFAULT '',
  app_date        date,
  payment_due     date,
  payment_recd    date,
  applied_value   numeric(14,2) NOT NULL DEFAULT 0,
  certified_value numeric(14,2) NOT NULL DEFAULT 0,
  paid_value      numeric(14,2) NOT NULL DEFAULT 0,
  retention       numeric(14,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'draft',
  notes           text NOT NULL DEFAULT '',
  created_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_commercial_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_applications" ON vy_commercial_applications FOR SELECT
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "insert_own_applications" ON vy_commercial_applications FOR INSERT
  TO authenticated WITH CHECK (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "update_own_applications" ON vy_commercial_applications FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "delete_own_applications" ON vy_commercial_applications FOR DELETE
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid));

CREATE INDEX IF NOT EXISTS idx_vy_comm_apps_org_id     ON vy_commercial_applications(org_id);
CREATE INDEX IF NOT EXISTS idx_vy_comm_apps_project_id ON vy_commercial_applications(project_id);
