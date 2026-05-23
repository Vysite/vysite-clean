/*
  # Add estimate_items column to vy_tenders

  ## Summary
  Adds a JSONB column `estimate_items` to the `vy_tenders` table to persist
  tender estimate line items. Each item stores: id, lineNo, description, unit,
  quantity, costRate, markupPct.

  ## Changes
  - `vy_tenders`: new column `estimate_items` (jsonb, default empty array)

  ## Notes
  - Safe: uses IF NOT EXISTS pattern via DO block
  - No existing data affected; defaults to []
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_tenders' AND column_name = 'estimate_items'
  ) THEN
    ALTER TABLE vy_tenders ADD COLUMN estimate_items jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
