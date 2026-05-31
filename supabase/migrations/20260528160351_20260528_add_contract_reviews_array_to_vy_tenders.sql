/*
  # Add contract_reviews array column to vy_tenders

  ## Summary
  Adds a new JSONB column `contract_reviews` to `vy_tenders` to store an array of
  ContractReviewRecord objects, replacing the single-review `contract_review` column.

  ## Changes
  - `vy_tenders`: new nullable JSONB column `contract_reviews` (array of review records)
    - Each element is a ContractReviewRecord with id, title, createdAt, createdBy,
      documents[], executiveSummary, findings[], commercialHandoverNotes, notes
    - Supports multiple reviews per tender (review history)
    - The old `contract_review` column is preserved for safe backward compat during
      the transition; data migration is handled in the application mapper

  ## Notes
  - Additive only — `contract_review` column is retained, not dropped
  - No RLS changes required (existing vy_tenders policies apply)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_tenders' AND column_name = 'contract_reviews'
  ) THEN
    ALTER TABLE vy_tenders ADD COLUMN contract_reviews jsonb DEFAULT NULL;
  END IF;
END $$;
