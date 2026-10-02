/*
# Add Tender-level MCD columns to vy_tenders

1. Purpose
   Adds three scalar columns to `vy_tenders` to store Tender-level Mistakes & Omissions Deduction (MCD) configuration.
   This is separate from the Valuation module's `vy_valuation_workbooks.mcd_pct` and does not touch it.

2. New Columns
   - `mcd_type` (text, NOT NULL, DEFAULT 'none') — controls whether MCD is applied. Allowed values: 'none', 'percentage', 'fixed'.
   - `mcd_pct` (numeric(5,2), NOT NULL, DEFAULT 0) — percentage applied when mcd_type = 'percentage'.
   - `mcd_fixed_value` (numeric(12,2), NOT NULL, DEFAULT 0) — fixed deduction when mcd_type = 'fixed'.

3. Constraints
   - CHECK constraint on `mcd_type` restricting to 'none', 'percentage', 'fixed'.

4. Backward Compatibility
   - All existing rows receive mcd_type='none', mcd_pct=0, mcd_fixed_value=0.
   - No existing tender totals are affected.

5. Security
   - No RLS or policy changes. Existing vy_tenders policies remain in effect.
*/

ALTER TABLE vy_tenders ADD COLUMN IF NOT EXISTS mcd_type text NOT NULL DEFAULT 'none';
ALTER TABLE vy_tenders ADD COLUMN IF NOT EXISTS mcd_pct numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE vy_tenders ADD COLUMN IF NOT EXISTS mcd_fixed_value numeric(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vy_tenders_mcd_type_check'
    AND table_name = 'vy_tenders'
  ) THEN
    ALTER TABLE vy_tenders ADD CONSTRAINT vy_tenders_mcd_type_check
      CHECK (mcd_type IN ('none', 'percentage', 'fixed'));
  END IF;
END $$;
