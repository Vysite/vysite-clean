CREATE TABLE IF NOT EXISTS vy_key_dates (
  id           TEXT        PRIMARY KEY,
  org_id       TEXT        NOT NULL,
  project_id   TEXT        NOT NULL,
  project_name TEXT        NOT NULL DEFAULT '',
  title        TEXT        NOT NULL DEFAULT '',
  date         TEXT        NOT NULL DEFAULT '',
  description  TEXT        NOT NULL DEFAULT '',
  comments     TEXT        NOT NULL DEFAULT '',
  status       TEXT        NOT NULL DEFAULT 'Open',
  created_by   TEXT        NOT NULL DEFAULT '',
  created_date TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vy_key_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kd_select" ON vy_key_dates FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "kd_insert" ON vy_key_dates FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "kd_update" ON vy_key_dates FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "kd_delete" ON vy_key_dates FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
