
-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Workbook: one per project, holds master contract lines
CREATE TABLE vy_valuation_workbooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id  text NOT NULL,
  title       text NOT NULL DEFAULT 'Contract Build-Up',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, project_id)
);

CREATE TRIGGER vy_valuation_workbooks_updated_at
  BEFORE UPDATE ON vy_valuation_workbooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE vy_valuation_workbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_vy_valuation_workbooks" ON vy_valuation_workbooks FOR SELECT
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_vy_valuation_workbooks" ON vy_valuation_workbooks FOR INSERT
  TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "update_own_vy_valuation_workbooks" ON vy_valuation_workbooks FOR UPDATE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())) WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_vy_valuation_workbooks" ON vy_valuation_workbooks FOR DELETE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- Master contract lines (belong to workbook, live for project lifetime)
CREATE TABLE vy_workbook_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  workbook_id    uuid NOT NULL REFERENCES vy_valuation_workbooks(id) ON DELETE CASCADE,
  item_number    text,
  description    text NOT NULL DEFAULT '',
  section        text,
  unit           text,
  quantity       numeric,
  rate           numeric,
  contract_value numeric NOT NULL DEFAULT 0,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_workbook_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_vy_workbook_lines" ON vy_workbook_lines FOR SELECT
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_vy_workbook_lines" ON vy_workbook_lines FOR INSERT
  TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "update_own_vy_workbook_lines" ON vy_workbook_lines FOR UPDATE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())) WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_vy_workbook_lines" ON vy_workbook_lines FOR DELETE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- Master agreed extras (belong to workbook)
CREATE TABLE vy_workbook_extras (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  workbook_id    uuid NOT NULL REFERENCES vy_valuation_workbooks(id) ON DELETE CASCADE,
  ref            text,
  description    text NOT NULL DEFAULT '',
  agreed_value   numeric NOT NULL DEFAULT 0,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_workbook_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_vy_workbook_extras" ON vy_workbook_extras FOR SELECT
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_vy_workbook_extras" ON vy_workbook_extras FOR INSERT
  TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "update_own_vy_workbook_extras" ON vy_workbook_extras FOR UPDATE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())) WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_vy_workbook_extras" ON vy_workbook_extras FOR DELETE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- Per-valuation entries for contract lines (only pct values change per period)
CREATE TABLE vy_valuation_line_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  valuation_id     uuid NOT NULL REFERENCES vy_valuations(id) ON DELETE CASCADE,
  workbook_line_id uuid NOT NULL REFERENCES vy_workbook_lines(id) ON DELETE CASCADE,
  previous_pct     numeric NOT NULL DEFAULT 0 CHECK (previous_pct >= 0 AND previous_pct <= 100),
  current_pct      numeric NOT NULL DEFAULT 0 CHECK (current_pct >= 0 AND current_pct <= 100),
  notes            text,
  UNIQUE (valuation_id, workbook_line_id)
);

ALTER TABLE vy_valuation_line_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_vy_valuation_line_entries" ON vy_valuation_line_entries FOR SELECT
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_vy_valuation_line_entries" ON vy_valuation_line_entries FOR INSERT
  TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "update_own_vy_valuation_line_entries" ON vy_valuation_line_entries FOR UPDATE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())) WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_vy_valuation_line_entries" ON vy_valuation_line_entries FOR DELETE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- Per-valuation entries for extras
CREATE TABLE vy_valuation_extra_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  valuation_id      uuid NOT NULL REFERENCES vy_valuations(id) ON DELETE CASCADE,
  workbook_extra_id uuid NOT NULL REFERENCES vy_workbook_extras(id) ON DELETE CASCADE,
  previous_pct      numeric NOT NULL DEFAULT 0 CHECK (previous_pct >= 0 AND previous_pct <= 100),
  current_pct       numeric NOT NULL DEFAULT 0 CHECK (current_pct >= 0 AND current_pct <= 100),
  notes             text,
  UNIQUE (valuation_id, workbook_extra_id)
);

ALTER TABLE vy_valuation_extra_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_vy_valuation_extra_entries" ON vy_valuation_extra_entries FOR SELECT
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "insert_own_vy_valuation_extra_entries" ON vy_valuation_extra_entries FOR INSERT
  TO authenticated WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "update_own_vy_valuation_extra_entries" ON vy_valuation_extra_entries FOR UPDATE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())) WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
CREATE POLICY "delete_own_vy_valuation_extra_entries" ON vy_valuation_extra_entries FOR DELETE
  TO authenticated USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- Add workbook_id reference to valuations
ALTER TABLE vy_valuations ADD COLUMN IF NOT EXISTS workbook_id uuid REFERENCES vy_valuation_workbooks(id);
