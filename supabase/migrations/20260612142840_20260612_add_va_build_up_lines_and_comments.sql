-- VA Cost Build-Up Lines
CREATE TABLE IF NOT EXISTS vy_va_build_up_lines (
  id          text PRIMARY KEY,
  org_id      text NOT NULL,
  project_id  text NOT NULL,
  va_item_id  text NOT NULL,
  line_no     integer NOT NULL DEFAULT 1,
  description text NOT NULL DEFAULT '',
  type        text NOT NULL DEFAULT 'labour',
  unit        text NOT NULL DEFAULT '',
  quantity    numeric(14,4) NOT NULL DEFAULT 0,
  cost_price  numeric(14,2) NOT NULL DEFAULT 0,
  markup_pct  numeric(8,2) NOT NULL DEFAULT 0,
  sales_price numeric(14,2) NOT NULL DEFAULT 0,
  line_total  numeric(14,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_va_build_up_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_va_lines" ON vy_va_build_up_lines FOR SELECT
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "insert_own_va_lines" ON vy_va_build_up_lines FOR INSERT
  TO authenticated WITH CHECK (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "update_own_va_lines" ON vy_va_build_up_lines FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "delete_own_va_lines" ON vy_va_build_up_lines FOR DELETE
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid));

CREATE INDEX IF NOT EXISTS idx_va_build_up_lines_org    ON vy_va_build_up_lines(org_id);
CREATE INDEX IF NOT EXISTS idx_va_build_up_lines_va_id  ON vy_va_build_up_lines(va_item_id);

-- VA Comments
CREATE TABLE IF NOT EXISTS vy_va_comments (
  id          text PRIMARY KEY,
  org_id      text NOT NULL,
  project_id  text NOT NULL,
  va_item_id  text NOT NULL,
  body        text NOT NULL DEFAULT '',
  author_name text NOT NULL DEFAULT '',
  author_id   text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_va_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_va_comments" ON vy_va_comments FOR SELECT
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "insert_own_va_comments" ON vy_va_comments FOR INSERT
  TO authenticated WITH CHECK (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "update_own_va_comments" ON vy_va_comments FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));

CREATE POLICY "delete_own_va_comments" ON vy_va_comments FOR DELETE
  TO authenticated USING (is_org_member(auth.uid(), org_id::uuid));

CREATE INDEX IF NOT EXISTS idx_va_comments_org    ON vy_va_comments(org_id);
CREATE INDEX IF NOT EXISTS idx_va_comments_va_id  ON vy_va_comments(va_item_id);
