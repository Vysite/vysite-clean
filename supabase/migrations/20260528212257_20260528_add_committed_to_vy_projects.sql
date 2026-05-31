/*
  # Add committed spend tracking to vy_projects

  ## Summary
  Adds financial tracking columns to vy_projects to support Remaining Budget visibility.

  ## New Columns
  - `committed` (numeric, nullable) — total cost committed / spent to date (£)

  ## Notes
  - Nullable so existing projects are unaffected — no data loss
  - `remaining` is a derived value (value - committed) computed in the frontend
  - No RLS changes needed — column inherits the table's existing org-scoped policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_projects' AND column_name = 'committed'
  ) THEN
    ALTER TABLE vy_projects ADD COLUMN committed numeric NULL;
  END IF;
END $$;
