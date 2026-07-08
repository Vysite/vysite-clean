/*
# Add EWN → DN conversion link fields to vy_commercial_records

## Summary
Adds two nullable self-referencing UUID columns to support the Early Warning Notice
→ Delay Notice conversion workflow.

## Changes

### Modified Table: vy_commercial_records

- `converted_to_id` (uuid, nullable, FK → vy_commercial_records.id SET NULL on delete)
  Populated on the source EWN when it has been converted. References the Delay Notice created from it.
  Once set, the EWN's "Convert" button is hidden and replaced with a link to the DN.

- `converted_from_id` (uuid, nullable, FK → vy_commercial_records.id SET NULL on delete)
  Populated on the newly created Delay Notice. References the originating EWN.
  Displayed as an "Origin" link inside the DN's detail panel.

## Notes
1. Both columns default to NULL — existing records are unaffected.
2. ON DELETE SET NULL means if either linked record is deleted the reference is cleared,
   not cascaded, preserving the remaining record.
3. No RLS changes required — the existing org-scoped policies on vy_commercial_records
   already cover these columns.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_commercial_records' AND column_name = 'converted_to_id'
  ) THEN
    ALTER TABLE vy_commercial_records
      ADD COLUMN converted_to_id uuid REFERENCES vy_commercial_records(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_commercial_records' AND column_name = 'converted_from_id'
  ) THEN
    ALTER TABLE vy_commercial_records
      ADD COLUMN converted_from_id uuid REFERENCES vy_commercial_records(id) ON DELETE SET NULL;
  END IF;
END $$;
