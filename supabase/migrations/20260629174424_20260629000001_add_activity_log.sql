-- Activity Log table for the Traceability / Activity & Audit Framework
-- Append-only: no UPDATE or DELETE policies — the log is permanent.
-- Denormalised fields (user_name, record_ref) capture values at event time
-- so the log remains self-describing even if source records change or are deleted.

CREATE TABLE vy_activity_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  user_id         uuid,
  user_name       text NOT NULL DEFAULT '',
  module          text NOT NULL,
  record_id       uuid,
  record_ref      text,
  record_type     text,
  project_id      text,
  project_name    text,
  action_type     text NOT NULL,
  description     text NOT NULL,
  prev_value      text,
  new_value       text,
  reason          text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for all primary query patterns
CREATE INDEX idx_activity_log_org_created   ON vy_activity_log (org_id, created_at DESC);
CREATE INDEX idx_activity_log_record        ON vy_activity_log (org_id, record_id, created_at DESC);
CREATE INDEX idx_activity_log_module        ON vy_activity_log (org_id, module, created_at DESC);
CREATE INDEX idx_activity_log_user          ON vy_activity_log (org_id, user_id, created_at DESC);

-- RLS
ALTER TABLE vy_activity_log ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's log
CREATE POLICY "org members can read activity log"
  ON vy_activity_log FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_orgs.org_id = vy_activity_log.org_id
        AND user_orgs.user_id = auth.uid()
        AND user_orgs.status = 'active'
    )
  );

-- Org members can insert (app writes on behalf of auth.uid())
CREATE POLICY "org members can insert activity log"
  ON vy_activity_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_orgs.org_id = vy_activity_log.org_id
        AND user_orgs.user_id = auth.uid()
        AND user_orgs.status = 'active'
    )
  );

-- Intentionally no UPDATE or DELETE policies.
-- The activity log is permanent and cannot be modified through the application.
