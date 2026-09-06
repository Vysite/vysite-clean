/*
# Add Project Costs Ledger and Budget Cost

## Purpose
Extends the VYSITE Commercial module with project-level cost tracking and
live profitability reporting. Costs are a SEPARATE financial dataset from
the revenue/contract side — they never alter contract sums, variations, or
applications.

## 1. New Table: vy_project_costs
A per-project cost ledger supporting actual, committed, and forecast costs.

Columns:
- id (uuid PK, auto-generated)
- org_id (uuid, FK → organisations, CASCADE)
- project_id (text — matches all other commercial tables)
- cost_date (date — proper date type, not text)
- supplier (text — payee name)
- reference (text — invoice/reference number)
- description (text)
- cost_category (text — free-text to allow org-defined codes later)
- net_cost (numeric 14,2 — used for all profitability calculations)
- vat_amount (numeric 14,2 — stored for reference, NOT used in margin)
- gross_cost (numeric 14,2 — net + vat, for invoice reference only)
- cost_type (text, CHECK: 'actual'|'committed'|'forecast' — mutually exclusive current state)
- status (text, CHECK: 'draft'|'confirmed'|'invoiced'|'paid')
- notes (text)
- created_by (text)
- created_at (timestamptz)
- updated_at (timestamptz)

Design decisions:
- cost_type is MUTUALLY EXCLUSIVE — a cost record progresses forecast→committed→actual
  by updating its cost_type, preventing double-counting.
- status='draft' records are EXCLUDED from all live profitability calculations.
  Only confirmed/invoiced/paid records feed Actual/Committed/Forecast totals.
- cost_category is free-text (not enum) so organisations can define custom codes later.
- net_cost drives all margin/profit calculations. VAT is recoverable and excluded.

## 2. Modified Table: vy_projects
- Added budget_cost (numeric 14,2, nullable) — the original baseline budget cost.
  Used to calculate Original Forecast Profit and Original Margin.

## 3. Security
- RLS enabled on vy_project_costs.
- 4 policies (SELECT/INSERT/UPDATE/DELETE) using is_org_member(), matching
  the existing vy_commercial_records and vy_commercial_applications pattern.
- TO authenticated — this is sensitive commercial data behind sign-in.

## 4. Index
- Composite index on (org_id, project_id, cost_date DESC) for on-demand
  per-project loading and future server-side pagination.

## 5. updated_at trigger
- Reuses the same set_updated_at() function pattern as vy_commercial_records.
*/

-- ─── New table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vy_project_costs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  project_id    text NOT NULL DEFAULT '',
  cost_date     date NOT NULL DEFAULT CURRENT_DATE,
  supplier      text NOT NULL DEFAULT '',
  reference     text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  cost_category text NOT NULL DEFAULT 'Other',
  net_cost      numeric(14,2) NOT NULL DEFAULT 0,
  vat_amount    numeric(14,2) NOT NULL DEFAULT 0,
  gross_cost    numeric(14,2) NOT NULL DEFAULT 0,
  cost_type     text NOT NULL DEFAULT 'actual'
                 CHECK (cost_type IN ('actual','committed','forecast')),
  status        text NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','confirmed','invoiced','paid')),
  notes         text NOT NULL DEFAULT '',
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_project_costs ENABLE ROW LEVEL SECURITY;

-- Drop-first for idempotency
DROP POLICY IF EXISTS "select_own_project_costs" ON vy_project_costs;
CREATE POLICY "select_own_project_costs"
  ON vy_project_costs FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "insert_own_project_costs" ON vy_project_costs;
CREATE POLICY "insert_own_project_costs"
  ON vy_project_costs FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "update_own_project_costs" ON vy_project_costs;
CREATE POLICY "update_own_project_costs"
  ON vy_project_costs FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "delete_own_project_costs" ON vy_project_costs;
CREATE POLICY "delete_own_project_costs"
  ON vy_project_costs FOR DELETE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

-- ─── Index for on-demand per-project loading ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_costs_org_project_date
  ON vy_project_costs (org_id, project_id, cost_date DESC);

-- ─── updated_at trigger ─────────────────────────────────────────────────────
-- Reuse the existing set_updated_at() function if it exists, otherwise create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at' AND pronargs = 0) THEN
    CREATE FUNCTION set_updated_at() RETURNS trigger AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_project_costs_updated_at ON vy_project_costs;
CREATE TRIGGER trg_project_costs_updated_at
  BEFORE UPDATE ON vy_project_costs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Add budget_cost to vy_projects ─────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'vy_projects' AND column_name = 'budget_cost') THEN
    ALTER TABLE vy_projects ADD COLUMN budget_cost numeric(14,2);
  END IF;
END $$;
