-- Add submitted_date column to vy_tenders
-- Records the date a tender was actually submitted so the overdue counter
-- can freeze at submission time instead of counting forever.
ALTER TABLE vy_tenders
  ADD COLUMN IF NOT EXISTS submitted_date text NOT NULL DEFAULT '';
