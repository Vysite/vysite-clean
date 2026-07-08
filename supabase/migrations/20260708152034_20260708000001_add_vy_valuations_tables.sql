/*
  # Valuations Module — Standalone Tables

  Adds three new tables to power the Valuations feature inside the Commercial module.
  These tables are completely standalone — no dependencies on existing Commercial Register,
  Variations, Applications, or Payment Certificate tables.

  ## New Tables

  ### vy_valuations
  One per valuation per project. The top-level header record.
  - id              — UUID primary key
  - org_id          — Organisation scope (RLS)
  - project_id      — Linked project (text, matches vy_projects convention)
  - ref             — Auto reference label (e.g. VAL-001), managed by the UI
  - title           — User-defined valuation title
  - valuation_date  — Valuation date (text, e.g. "2026-07-08")
  - period          — Description of the valuation period
  - client          — Client name
  - contractor      — Contractor name
  - notes           — Internal notes / assumptions
  - status          — draft | submitted | certified | superseded
  - created_by      — Name of the user who created the valuation
  - created_at      — Creation timestamp
  - updated_at      — Last update timestamp (auto-maintained by trigger)

  ### vy_valuation_lines
  Contract work items (the build-up table). One row per line item.
  Calculated fields (previous_value, current_value, this_valuation) are derived
  in the frontend — only the raw inputs are stored.
  - id              — UUID primary key
  - org_id          — Organisation scope (RLS)
  - valuation_id    — Parent valuation (CASCADE delete)
  - project_id      — Denormalised for query efficiency
  - item_number     — Item/clause reference (e.g. "1.1", "A2")
  - description     — Line item description
  - section         — Trade / section grouping (e.g. "Mechanical", "Electrical")
  - unit            — Unit of measure (e.g. "m²", "nr", "sum")
  - quantity        — Measured quantity
  - rate            — Unit rate
  - contract_value  — Original contract value for this line (can override qty×rate)
  - previous_pct    — Previous certified percentage (0–100)
  - current_pct     — Current claimed percentage (0–100)
  - notes           — Line-level note
  - sort_order      — Integer sort order, managed by UI
  - created_at      — Creation timestamp

  ### vy_valuation_extra_lines
  Extras / agreed variations — manually entered, separate from the Variations module.
  Same percentage-complete logic as contract lines.
  - id              — UUID primary key
  - org_id          — Organisation scope (RLS)
  - valuation_id    — Parent valuation (CASCADE delete)
  - project_id      — Denormalised for query efficiency
  - ref             — User reference for the extra (e.g. "EV-01")
  - description     — Description of the extra / agreed variation
  - agreed_value    — Agreed lump sum value
  - previous_pct    — Previous certified percentage (0–100)
  - current_pct     — Current claimed percentage (0–100)
  - notes           — Line-level note
  - sort_order      — Integer sort order, managed by UI
  - created_at      — Creation timestamp

  ## Security
  - RLS enabled on all three tables.
  - Org-scoped via user_orgs lookup (same pattern as all VYSITE operational tables).
  - Four separate policies per table: SELECT, INSERT, UPDATE, DELETE.
  - All scoped TO authenticated.

  ## Notes
  - project_id is TEXT (not uuid) to match vy_projects convention.
  - No FK from vy_valuations to vy_projects — matching the pattern used elsewhere.
  - updated_at is auto-maintained by a trigger on vy_valuations only (header updates
    are the signal for "manual was recently changed").
*/

-- ── vy_valuations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_valuations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  project_id     text NOT NULL DEFAULT '',
  ref            text NOT NULL DEFAULT '',
  title          text NOT NULL DEFAULT '',
  valuation_date text NOT NULL DEFAULT '',
  period         text NOT NULL DEFAULT '',
  client         text NOT NULL DEFAULT '',
  contractor     text NOT NULL DEFAULT '',
  notes          text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','submitted','certified','superseded')),
  created_by     text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vy_valuations_org_id     ON vy_valuations(org_id);
CREATE INDEX IF NOT EXISTS idx_vy_valuations_project_id ON vy_valuations(project_id);

CREATE OR REPLACE FUNCTION trg_set_vy_valuations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_vy_valuations_updated_at ON vy_valuations;
CREATE TRIGGER trg_vy_valuations_updated_at
  BEFORE UPDATE ON vy_valuations
  FOR EACH ROW EXECUTE FUNCTION trg_set_vy_valuations_updated_at();

ALTER TABLE vy_valuations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view valuations" ON vy_valuations;
CREATE POLICY "Org members can view valuations"
  ON vy_valuations FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can create valuations" ON vy_valuations;
CREATE POLICY "Org members can create valuations"
  ON vy_valuations FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can update valuations" ON vy_valuations;
CREATE POLICY "Org members can update valuations"
  ON vy_valuations FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can delete valuations" ON vy_valuations;
CREATE POLICY "Org members can delete valuations"
  ON vy_valuations FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- ── vy_valuation_lines ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_valuation_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  valuation_id   uuid NOT NULL REFERENCES vy_valuations(id) ON DELETE CASCADE,
  project_id     text NOT NULL DEFAULT '',
  item_number    text NOT NULL DEFAULT '',
  description    text NOT NULL DEFAULT '',
  section        text NOT NULL DEFAULT '',
  unit           text NOT NULL DEFAULT '',
  quantity       numeric NOT NULL DEFAULT 0,
  rate           numeric NOT NULL DEFAULT 0,
  contract_value numeric NOT NULL DEFAULT 0,
  previous_pct   numeric NOT NULL DEFAULT 0 CHECK (previous_pct >= 0 AND previous_pct <= 100),
  current_pct    numeric NOT NULL DEFAULT 0  CHECK (current_pct  >= 0 AND current_pct  <= 100),
  notes          text NOT NULL DEFAULT '',
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vy_valuation_lines_org_id       ON vy_valuation_lines(org_id);
CREATE INDEX IF NOT EXISTS idx_vy_valuation_lines_valuation_id ON vy_valuation_lines(valuation_id);

ALTER TABLE vy_valuation_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view valuation_lines" ON vy_valuation_lines;
CREATE POLICY "Org members can view valuation_lines"
  ON vy_valuation_lines FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can create valuation_lines" ON vy_valuation_lines;
CREATE POLICY "Org members can create valuation_lines"
  ON vy_valuation_lines FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can update valuation_lines" ON vy_valuation_lines;
CREATE POLICY "Org members can update valuation_lines"
  ON vy_valuation_lines FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can delete valuation_lines" ON vy_valuation_lines;
CREATE POLICY "Org members can delete valuation_lines"
  ON vy_valuation_lines FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- ── vy_valuation_extra_lines ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_valuation_extra_lines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL,
  valuation_id   uuid NOT NULL REFERENCES vy_valuations(id) ON DELETE CASCADE,
  project_id     text NOT NULL DEFAULT '',
  ref            text NOT NULL DEFAULT '',
  description    text NOT NULL DEFAULT '',
  agreed_value   numeric NOT NULL DEFAULT 0,
  previous_pct   numeric NOT NULL DEFAULT 0 CHECK (previous_pct >= 0 AND previous_pct <= 100),
  current_pct    numeric NOT NULL DEFAULT 0  CHECK (current_pct  >= 0 AND current_pct  <= 100),
  notes          text NOT NULL DEFAULT '',
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vy_valuation_extra_lines_org_id       ON vy_valuation_extra_lines(org_id);
CREATE INDEX IF NOT EXISTS idx_vy_valuation_extra_lines_valuation_id ON vy_valuation_extra_lines(valuation_id);

ALTER TABLE vy_valuation_extra_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view valuation_extra_lines" ON vy_valuation_extra_lines;
CREATE POLICY "Org members can view valuation_extra_lines"
  ON vy_valuation_extra_lines FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can create valuation_extra_lines" ON vy_valuation_extra_lines;
CREATE POLICY "Org members can create valuation_extra_lines"
  ON vy_valuation_extra_lines FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can update valuation_extra_lines" ON vy_valuation_extra_lines;
CREATE POLICY "Org members can update valuation_extra_lines"
  ON vy_valuation_extra_lines FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can delete valuation_extra_lines" ON vy_valuation_extra_lines;
CREATE POLICY "Org members can delete valuation_extra_lines"
  ON vy_valuation_extra_lines FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
