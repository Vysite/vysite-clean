/*
  # Create vy_programmes and vy_programme_tasks tables

  ## Summary
  Adds Phase 1 of the Project Programmes module — a simple, operational programme
  tracker living inside the Projects area.

  ## New Tables

  ### vy_programmes
  Holds programme headers (e.g. "Commissioning Programme", "2 Week Lookahead").
  - `id` (uuid, PK)
  - `org_id` (uuid, FK to organisations — used in all RLS policies)
  - `project_id` (text) — matches the project UUID string from vy_projects
  - `project_name` (text) — denormalised for display / PDF
  - `title` (text) — Programme title
  - `description` (text) — Optional description
  - `created_by` (text) — Name of the user who created it
  - `created_at` / `updated_at` (timestamptz)

  ### vy_programme_tasks
  Individual tasks within a programme with Gantt-compatible date fields.
  - `id` (uuid, PK)
  - `org_id` (uuid)
  - `programme_id` (uuid, FK → vy_programmes.id)
  - `project_id` (text) — denormalised for easier project-scoped queries
  - `task_name` (text)
  - `assigned_to` (text)
  - `start_date` (date)
  - `finish_date` (date)
  - `status` (text) — Not Started | In Progress | Awaiting Others | Blocked | Complete
  - `notes` (text)
  - `sort_order` (integer) — controls display order within a programme
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Separate SELECT / INSERT / UPDATE / DELETE policies
  - All policies use `is_org_member(auth.uid(), org_id)` for reads and
    `is_org_manager_or_above(auth.uid(), org_id)` for writes/deletes

  ## Notes
  1. `project_id` stored as text to match the UUID string used across all other vy_ tables.
  2. `sort_order` defaults to 0; frontend sends an incrementing integer for ordering.
  3. Both tables carry `org_id uuid NOT NULL` to work with the existing RLS helpers.
*/

-- ─── vy_programmes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_programmes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  project_id   text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  title        text NOT NULL DEFAULT '',
  description  text NOT NULL DEFAULT '',
  created_by   text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE vy_programmes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vy_programmes_org  ON vy_programmes (org_id);
CREATE INDEX IF NOT EXISTS idx_vy_programmes_proj ON vy_programmes (project_id);

CREATE POLICY "Org members can view programmes"
  ON vy_programmes FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert programmes"
  ON vy_programmes FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update programmes"
  ON vy_programmes FOR UPDATE
  TO authenticated
  USING  (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org managers can delete programmes"
  ON vy_programmes FOR DELETE
  TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

-- ─── vy_programme_tasks ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_programme_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  programme_id uuid NOT NULL REFERENCES vy_programmes(id) ON DELETE CASCADE,
  project_id   text NOT NULL DEFAULT '',
  task_name    text NOT NULL DEFAULT '',
  assigned_to  text NOT NULL DEFAULT '',
  start_date   date,
  finish_date  date,
  status       text NOT NULL DEFAULT 'Not Started',
  notes        text NOT NULL DEFAULT '',
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE vy_programme_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_vy_ptasks_org  ON vy_programme_tasks (org_id);
CREATE INDEX IF NOT EXISTS idx_vy_ptasks_prog ON vy_programme_tasks (programme_id);
CREATE INDEX IF NOT EXISTS idx_vy_ptasks_proj ON vy_programme_tasks (project_id);

CREATE POLICY "Org members can view programme tasks"
  ON vy_programme_tasks FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can insert programme tasks"
  ON vy_programme_tasks FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update programme tasks"
  ON vy_programme_tasks FOR UPDATE
  TO authenticated
  USING  (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org managers can delete programme tasks"
  ON vy_programme_tasks FOR DELETE
  TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));
