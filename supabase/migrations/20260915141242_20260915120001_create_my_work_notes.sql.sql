/*
# Create vy_my_work_notes table — Running timestamped notes for My Work items

## Purpose
A dedicated relational table for timestamped "Notes / Updates" attached to
individual My Work items. Each note is a separate row (not a growing text blob
on the parent item), enabling per-note edit, delete, and chronological display.

## Existing field
vy_my_work_items.notes (text) is a single free-text field used in the task
edit modal. It is NOT touched by this migration — existing data is preserved.
The new table provides a separate running note history alongside that field.

## New Table: vy_my_work_notes
- id (uuid, PK, default gen_random_uuid())
- org_id (uuid, NOT NULL) — organisation scope
- user_id (uuid, NOT NULL, DEFAULT auth.uid()) — owner of the note
- my_work_item_id (uuid, NOT NULL) — FK to vy_my_work_items.id, ON DELETE CASCADE
- note_text (text, NOT NULL) — the note content
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now()) — updated when note text is edited

## Cascade behaviour
ON DELETE CASCADE on the FK to vy_my_work_items means deleting a My Work item
automatically removes all its notes — no orphans.

## Index
- idx_my_work_notes_item — (my_work_item_id) for fast per-item note retrieval

## Security (RLS)
- RLS enabled on vy_my_work_notes.
- Four separate policies (SELECT/INSERT/UPDATE/DELETE), all TO authenticated,
  all enforcing auth.uid() = user_id. No FOR ALL policy.
- user_id defaults to auth.uid() so inserts that omit user_id satisfy WITH CHECK.
- An Organisation Admin CANNOT access another user's notes — user_id ownership
  is the only access path, exactly like vy_my_work_items.
*/

CREATE TABLE IF NOT EXISTS vy_my_work_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  my_work_item_id uuid NOT NULL REFERENCES vy_my_work_items(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_my_work_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_my_work_notes" ON vy_my_work_notes;
CREATE POLICY "select_own_my_work_notes" ON vy_my_work_notes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_my_work_notes" ON vy_my_work_notes;
CREATE POLICY "insert_own_my_work_notes" ON vy_my_work_notes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_my_work_notes" ON vy_my_work_notes;
CREATE POLICY "update_own_my_work_notes" ON vy_my_work_notes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_my_work_notes" ON vy_my_work_notes;
CREATE POLICY "delete_own_my_work_notes" ON vy_my_work_notes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_my_work_notes_item ON vy_my_work_notes (my_work_item_id);