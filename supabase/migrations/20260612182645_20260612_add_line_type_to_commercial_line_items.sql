-- Add line_type to vy_commercial_line_items to align with VA build-up lines
ALTER TABLE vy_commercial_line_items ADD COLUMN IF NOT EXISTS line_type TEXT NOT NULL DEFAULT 'Labour';
