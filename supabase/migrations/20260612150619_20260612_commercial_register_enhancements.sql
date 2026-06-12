-- Add extra_data JSONB to commercial records for type-specific fields
ALTER TABLE vy_commercial_records ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}';

-- Comments on commercial register records
CREATE TABLE IF NOT EXISTS vy_commercial_record_comments (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  record_id   TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  author_name TEXT NOT NULL DEFAULT '',
  author_id   TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vy_commercial_record_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_cr_comments" ON vy_commercial_record_comments FOR SELECT
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid));
CREATE POLICY "insert_own_cr_comments" ON vy_commercial_record_comments FOR INSERT
  TO authenticated WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
CREATE POLICY "update_own_cr_comments" ON vy_commercial_record_comments FOR UPDATE
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid)) WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
CREATE POLICY "delete_own_cr_comments" ON vy_commercial_record_comments FOR DELETE
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid));

CREATE INDEX IF NOT EXISTS idx_cr_comments_record ON vy_commercial_record_comments(record_id);
CREATE INDEX IF NOT EXISTS idx_cr_comments_org ON vy_commercial_record_comments(org_id);
