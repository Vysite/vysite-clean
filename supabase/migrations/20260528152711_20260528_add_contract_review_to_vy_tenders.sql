/*
  # Add contract_review column to vy_tenders

  ## Summary
  Adds a new JSONB column `contract_review` to the `vy_tenders` table to persist
  AI Contract Review results against each tender.

  ## Changes
  - `vy_tenders`: new nullable JSONB column `contract_review`
    - Stores the full `StoredContractReview` object (executive summary, findings array,
      commercial handover notes, document name, reviewed timestamp)
    - NULL when no contract review has been run yet
    - Written by the client app when the user saves/completes a contract review

  ## Notes
  - Additive only — no existing columns or data are altered
  - No RLS changes required (existing vy_tenders policies cover this column)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_tenders' AND column_name = 'contract_review'
  ) THEN
    ALTER TABLE vy_tenders ADD COLUMN contract_review jsonb DEFAULT NULL;
  END IF;
END $$;
