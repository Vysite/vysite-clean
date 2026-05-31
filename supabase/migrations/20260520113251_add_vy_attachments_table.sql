/*
  # Add vy_attachments table

  1. New Tables
    - `vy_attachments`
      - `id` (text, primary key)
      - `linked_type` (text) — 'action' | 'snag' — the type of record this is attached to
      - `linked_id` (text) — the ID of the action or snag record
      - `project_id` (text) — project reference
      - `project_name` (text)
      - `name` (text) — file name
      - `type` (text) — MIME type
      - `size` (int) — bytes
      - `category` (text) — Photo | Document | Drawing | Report | Other
      - `data_url` (text) — base64 data URL
      - `uploaded_by` (text)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Anon read/write/delete policies (internal tool, no auth)

  3. Notes
    - Generic attachment store for any ticket type (action, snag, form, tc)
    - Linked by (linked_type, linked_id) pair
    - project_id and project_name are denormalised for efficient project-level queries
*/

CREATE TABLE IF NOT EXISTS vy_attachments (
  id text PRIMARY KEY,
  linked_type text NOT NULL DEFAULT '',
  linked_id text NOT NULL DEFAULT '',
  project_id text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT '',
  size int NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Other',
  data_url text NOT NULL DEFAULT '',
  uploaded_by text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read vy_attachments"
  ON vy_attachments FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert vy_attachments"
  ON vy_attachments FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update vy_attachments"
  ON vy_attachments FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete vy_attachments"
  ON vy_attachments FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS vy_attachments_linked_idx ON vy_attachments (linked_type, linked_id);
CREATE INDEX IF NOT EXISTS vy_attachments_project_idx ON vy_attachments (project_id);
