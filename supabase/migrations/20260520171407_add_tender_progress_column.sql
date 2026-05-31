/*
  # Add progress column to vy_tenders

  1. Changes
    - `vy_tenders`: adds `progress` integer column (0-100), default 0
      Used to track indicative tender completion stage (operational, not a valuation)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_tenders' AND column_name = 'progress'
  ) THEN
    ALTER TABLE vy_tenders ADD COLUMN progress integer NOT NULL DEFAULT 0;
  END IF;
END $$;
