ALTER TABLE vy_commercial_records
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

-- Back-fill existing records: use updated_at as a reasonable proxy
UPDATE vy_commercial_records
SET status_changed_at = updated_at
WHERE status_changed_at IS NULL;
