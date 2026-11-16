-- Commercial Financial Reconciliation — additive fields only.
-- No existing column is altered, renamed, or dropped. All new columns are nullable
-- or defaulted so existing reads/writes and historic rows are unaffected.

-- 1. Valuation financial snapshots (frozen at submit/certify/lock).
ALTER TABLE vy_valuations
  ADD COLUMN IF NOT EXISTS snapshot_gross_to_date numeric(14,2),
  ADD COLUMN IF NOT EXISTS snapshot_mcd_pct numeric(6,3),
  ADD COLUMN IF NOT EXISTS snapshot_mcd_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS snapshot_nett_to_date numeric(14,2),
  ADD COLUMN IF NOT EXISTS snapshot_retention_pct numeric(6,3),
  ADD COLUMN IF NOT EXISTS snapshot_retention_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS snapshot_gross_payment_to_date numeric(14,2),
  ADD COLUMN IF NOT EXISTS snapshot_previous_payments numeric(14,2),
  ADD COLUMN IF NOT EXISTS snapshot_previous_payments_source text,
  ADD COLUMN IF NOT EXISTS snapshot_net_due numeric(14,2),
  ADD COLUMN IF NOT EXISTS snapshot_frozen_at timestamptz;

-- 2. Variation Account classification (addition / omission / tender_item).
ALTER TABLE vy_variation_account
  ADD COLUMN IF NOT EXISTS classification text;

-- 3. Rebate % for forecast revenue (org-level default, per workbook override capability).
ALTER TABLE vy_valuation_workbooks
  ADD COLUMN IF NOT EXISTS rebate_pct numeric(6,3);

-- 4. Payment notice ↔ valuation linkage (applications are the payment notice ledger).
ALTER TABLE vy_commercial_applications
  ADD COLUMN IF NOT EXISTS valuation_id uuid REFERENCES vy_valuations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gross_certified_to_date numeric(14,2),
  ADD COLUMN IF NOT EXISTS cumulative_retention numeric(14,2),
  ADD COLUMN IF NOT EXISTS certified_payment_to_date numeric(14,2);

-- 5. Historic rows: classification defaults from existing direction (backfill is
-- non-destructive and reversible; tendered items are reclassified manually with confirmation).
UPDATE vy_variation_account SET classification = CASE WHEN is_positive THEN 'addition' ELSE 'omission' END
WHERE classification IS NULL;

-- Grants for the roles the policies target (RLS unchanged — org-scoped policies still apply).
GRANT SELECT, INSERT, UPDATE ON vy_valuations, vy_valuation_workbooks, vy_variation_account, vy_commercial_applications TO authenticated;
GRANT SELECT ON vy_valuations, vy_valuation_workbooks, vy_variation_account, vy_commercial_applications TO service_role;