/*
  # Add ai_review column to vy_tenders

  1. Changes
    - `vy_tenders`: adds `ai_review` (jsonb, nullable) column

  2. Purpose
    Stores the full AI document review result against the tender so that:
    - Results survive tab switches, modal close/reopen, and page refresh
    - Per-item saved/converted state is tracked (savedRfiIndices, etc.)
    - Users never lose AI-generated findings after paying API credit
    - Inline edits to AI-extracted text are preserved between sessions

  3. Security
    - No new RLS policies needed: column is part of vy_tenders which already has
      row-level security. Existing policies cover SELECT/INSERT/UPDATE/DELETE on
      the whole row, so the new column inherits those policies automatically.

  4. Notes
    - Column is nullable — existing tenders have NULL until a review is run
    - No default value set intentionally (NULL = no review yet)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_tenders' AND column_name = 'ai_review'
  ) THEN
    ALTER TABLE vy_tenders ADD COLUMN ai_review jsonb;
  END IF;
END $$;
