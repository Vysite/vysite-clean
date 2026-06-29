CREATE TABLE IF NOT EXISTS vy_commercial_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  record_id     UUID NOT NULL REFERENCES vy_commercial_records(id) ON DELETE CASCADE,
  project_id    TEXT,
  event_type    TEXT NOT NULL,  -- 'record_created' | 'submitted' | 'status_changed'
  from_status   TEXT,
  to_status     TEXT NOT NULL,
  user_name     TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vy_commercial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_commercial_events" ON vy_commercial_events
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
  ));

CREATE POLICY "insert_commercial_events" ON vy_commercial_events
  FOR INSERT TO authenticated
  WITH CHECK (org_id IN (
    SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
  ));

CREATE POLICY "update_commercial_events" ON vy_commercial_events
  FOR UPDATE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
  ));

CREATE POLICY "delete_commercial_events" ON vy_commercial_events
  FOR DELETE TO authenticated
  USING (org_id IN (
    SELECT org_id FROM user_orgs WHERE user_id = auth.uid()
  ));

-- Back-fill existing records: create a 'record_created' event for each existing record
INSERT INTO vy_commercial_events (org_id, record_id, project_id, event_type, from_status, to_status, user_name, occurred_at)
SELECT
  org_id,
  id,
  project_id::text,
  'record_created',
  NULL,
  status,
  created_by,
  created_at
FROM vy_commercial_records;
