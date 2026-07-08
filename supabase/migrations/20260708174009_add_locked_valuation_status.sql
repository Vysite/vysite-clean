-- Add 'locked' to the valuation status CHECK constraint
ALTER TABLE vy_valuations DROP CONSTRAINT IF EXISTS vy_valuations_status_check;
ALTER TABLE vy_valuations ADD CONSTRAINT vy_valuations_status_check
  CHECK (status IN ('draft', 'submitted', 'certified', 'superseded', 'locked'));
