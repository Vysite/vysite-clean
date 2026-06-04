/*
  # Fix vy_commercial_records.project_id type mismatch

  ## Problem
  The vy_commercial_records.project_id column was defined as uuid, but
  vy_projects.id is defined as text (it was originally created with text
  primary keys like 'p1', 'p2' and later migrated to UUID-format strings
  stored as text). PostgreSQL rejects inserting a non-UUID-format text value
  into a uuid column with:
    "invalid input syntax for type uuid"

  This caused commercial record saves to fail whenever a project was linked,
  while saves with no project (project_id = null) succeeded.

  ## Fix
  Change project_id from uuid to text. This aligns the column type with the
  actual type of vy_projects.id and accepts all project ID formats (both
  UUID-format strings and legacy short text IDs).

  ## Changes
  - vy_commercial_records.project_id: uuid → text
  - No data loss (column is nullable, no rows exist yet)
  - No RLS changes
  - No other tables modified
*/

ALTER TABLE vy_commercial_records
  ALTER COLUMN project_id TYPE text;
