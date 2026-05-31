/*
  # Add vy_projects and vy_project_documents tables

  1. New Tables
    - `vy_projects`
      - `id` (text, primary key) — matches sampleData project IDs (p1, p2, ...)
      - `name` (text) — project name
      - `client` (text)
      - `location` (text)
      - `project_manager` (text)
      - `status` (text) — Active | On Hold | Completed | Tender
      - `start_date` (text)
      - `completion_date` (text)
      - `progress` (int) — 0-100
      - `value` (text) — formatted contract value string e.g. "£485,000"
      - `open_actions` (int)
      - `open_snags` (int)
      - `created_at` (timestamptz)

    - `vy_project_documents`
      - `id` (text, primary key)
      - `project_id` (text) — foreign key to vy_projects
      - `project_name` (text)
      - `name` (text) — file name
      - `type` (text) — MIME type
      - `size` (int) — bytes
      - `category` (text) — Drawing | Specification | Photo | Report | Commissioning Evidence | Other
      - `data_url` (text) — base64 data URL for storage
      - `uploaded_by` (text)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Anon read/write policies for internal tool (no auth)

  3. Notes
    - vy_projects seeds from the 4 existing sampleData projects on first load
    - vy_project_documents stores file uploads per project
    - data_url column holds base64 for files (suitable for drawings, photos, PDFs under ~5MB)
*/

-- vy_projects
CREATE TABLE IF NOT EXISTS vy_projects (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  client text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  project_manager text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  start_date text NOT NULL DEFAULT '',
  completion_date text NOT NULL DEFAULT '',
  progress int NOT NULL DEFAULT 0,
  value text NOT NULL DEFAULT '',
  open_actions int NOT NULL DEFAULT 0,
  open_snags int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read vy_projects"
  ON vy_projects FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert vy_projects"
  ON vy_projects FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update vy_projects"
  ON vy_projects FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- vy_project_documents
CREATE TABLE IF NOT EXISTS vy_project_documents (
  id text PRIMARY KEY,
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

ALTER TABLE vy_project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read vy_project_documents"
  ON vy_project_documents FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert vy_project_documents"
  ON vy_project_documents FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update vy_project_documents"
  ON vy_project_documents FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon can delete vy_project_documents"
  ON vy_project_documents FOR DELETE TO anon USING (true);
