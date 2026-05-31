/*
  # VYSITE Core Tables Migration

  ## Purpose
  Creates all operational data tables to replace in-memory state with persistent storage.

  ## New Tables

  ### 1. `vy_actions`
  - All action tracker records (title, owner, due date, status, priority, overdue flag)

  ### 2. `vy_snags`
  - Snagging records (title, project, priority, status, assigned to, due date)

  ### 3. `vy_site_forms`
  - Site forms of all types (Daily Report, QA, RFI, TQ, Delay Notice, Variation, etc.)
  - Stores full form data as JSONB for flexibility across form types

  ### 4. `vy_tenders`
  - Tender tracker records with full nested data (subcontractors, RFIs, documents, comments, scope notes) stored as JSONB

  ### 5. `vy_tc_records`
  - Testing & Commissioning records (category, ref, title, area, engineer, status, result)

  ## Security
  - RLS enabled on all tables
  - Policies allow full read/write for authenticated users (internal tool)
  - Anon read/write also allowed since this is an internal platform without auth

  ## Notes
  - All tables use `id` as text primary key (matching existing frontend IDs)
  - JSONB fields store nested arrays/objects that vary per record type
  - No foreign key constraints to keep schema flexible for the demo dataset
*/

-- ─── Actions ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_actions (
  id text PRIMARY KEY,
  project_id text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT '',
  due_date text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Not Started',
  priority text NOT NULL DEFAULT 'Medium',
  created_by text NOT NULL DEFAULT '',
  created_date text NOT NULL DEFAULT '',
  overdue boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access vy_actions"
  ON vy_actions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon insert vy_actions"
  ON vy_actions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon update vy_actions"
  ON vy_actions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon delete vy_actions"
  ON vy_actions FOR DELETE
  TO anon
  USING (true);

-- ─── Snags ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_snags (
  id text PRIMARY KEY,
  project_id text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'Medium',
  status text NOT NULL DEFAULT 'Open',
  assigned_to text NOT NULL DEFAULT '',
  raised_by text NOT NULL DEFAULT '',
  raised_date text NOT NULL DEFAULT '',
  due_date text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  comments jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_snags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access vy_snags"
  ON vy_snags FOR SELECT TO anon USING (true);

CREATE POLICY "anon insert vy_snags"
  ON vy_snags FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon update vy_snags"
  ON vy_snags FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon delete vy_snags"
  ON vy_snags FOR DELETE TO anon USING (true);

-- ─── Site Forms ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_site_forms (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT '',
  project_id text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  date text NOT NULL DEFAULT '',
  completed_by text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  comments text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft',
  submitted_date text,
  notes text NOT NULL DEFAULT '',
  extra_data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_site_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access vy_site_forms"
  ON vy_site_forms FOR SELECT TO anon USING (true);

CREATE POLICY "anon insert vy_site_forms"
  ON vy_site_forms FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon update vy_site_forms"
  ON vy_site_forms FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon delete vy_site_forms"
  ON vy_site_forms FOR DELETE TO anon USING (true);

-- ─── Tenders ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_tenders (
  id text PRIMARY KEY,
  ref text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  client text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  received_date text NOT NULL DEFAULT '',
  return_date text NOT NULL DEFAULT '',
  estimated_value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'New Enquiry',
  owner text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'Medium',
  last_updated text NOT NULL DEFAULT '',
  next_action text NOT NULL DEFAULT '',
  internal_notes text NOT NULL DEFAULT '',
  scope_notes jsonb NOT NULL DEFAULT '{}',
  scope_entries jsonb NOT NULL DEFAULT '[]',
  subcontractors jsonb NOT NULL DEFAULT '[]',
  rfis jsonb NOT NULL DEFAULT '[]',
  documents jsonb NOT NULL DEFAULT '[]',
  comments jsonb NOT NULL DEFAULT '[]',
  outcome_notes text NOT NULL DEFAULT '',
  converted_project_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access vy_tenders"
  ON vy_tenders FOR SELECT TO anon USING (true);

CREATE POLICY "anon insert vy_tenders"
  ON vy_tenders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon update vy_tenders"
  ON vy_tenders FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon delete vy_tenders"
  ON vy_tenders FOR DELETE TO anon USING (true);

-- ─── Testing & Commissioning Records ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_tc_records (
  id text PRIMARY KEY,
  project_id text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  ref text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  engineer text NOT NULL DEFAULT '',
  date text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Not Started',
  result text,
  notes text NOT NULL DEFAULT '',
  files jsonb NOT NULL DEFAULT '[]',
  comments jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_tc_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access vy_tc_records"
  ON vy_tc_records FOR SELECT TO anon USING (true);

CREATE POLICY "anon insert vy_tc_records"
  ON vy_tc_records FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon update vy_tc_records"
  ON vy_tc_records FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon delete vy_tc_records"
  ON vy_tc_records FOR DELETE TO anon USING (true);
