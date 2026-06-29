-- Change record_id from uuid to text so operational modules with non-UUID IDs
-- (e.g. "f1782758432739") can be logged without a type error.
-- Existing uuid values cast cleanly to text; nulls remain null.
ALTER TABLE vy_activity_log
  ALTER COLUMN record_id TYPE text USING record_id::text;

-- Drop the old index (uuid-typed) and recreate it for text
DROP INDEX IF EXISTS idx_activity_log_record;
CREATE INDEX idx_activity_log_record ON vy_activity_log (org_id, record_id, created_at DESC);
