-- Fix vy_activity_log write amplification and missing read indexes.
--
-- DROPPED (dead — written to on every INSERT but never used by any query):
--   idx_activity_log_record  (org_id, record_id)   — app queries record_ref (text ilike), never record_id
--   idx_activity_log_user    (org_id, user_id)      — app filters by user_name (text), never user_id
--
-- ADDED (filters used by ActivityRegister but previously unindexed):
--   idx_activity_log_action_type  (org_id, action_type, created_at DESC)
--   idx_activity_log_user_name    (org_id, user_name,   created_at DESC)
--
-- No data is moved or altered. No RLS policies changed. No columns changed.

DROP INDEX IF EXISTS idx_activity_log_record;
DROP INDEX IF EXISTS idx_activity_log_user;

CREATE INDEX idx_activity_log_action_type
  ON vy_activity_log (org_id, action_type, created_at DESC);

CREATE INDEX idx_activity_log_user_name
  ON vy_activity_log (org_id, user_name, created_at DESC);
