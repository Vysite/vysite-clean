/*
  # O&M Manual Module — Phase A: Foundation Tables

  Introduces three tables that power the O&M Manual module.
  These tables are owned entirely by the O&M module and hold only
  the manual structure and references to existing records from other modules.
  No existing module tables are modified.

  ## New Tables

  ### vy_o_and_m_manuals
  One per project per org. The top-level container for an O&M Manual.
  - id           — UUID primary key
  - org_id       — Organisation scope (RLS)
  - project_id   — Linked project (matches vy_projects.id, text by convention)
  - title        — Display title (e.g. "O&M Manual — Rev A")
  - status       — draft | in_progress | finalised
  - version      — User-facing version label (e.g. "Rev A", "Issue 1")
  - notes        — Internal notes / description
  - created_by   — Name of the user who created the manual
  - created_at   — Creation timestamp
  - updated_at   — Last update timestamp (auto-maintained by trigger)

  ### vy_o_and_m_sections
  Ordered sections within a manual (e.g. "Testing & Commissioning", "Warranties").
  - id           — UUID primary key
  - org_id       — Organisation scope (RLS)
  - manual_id    — Parent manual (CASCADE delete)
  - project_id   — Denormalised for query efficiency
  - title        — Section heading
  - description  — Cover note shown in PDF header for this section
  - sort_order   — Integer sort order (managed by the UI)
  - created_at   — Creation timestamp

  ### vy_o_and_m_items
  References to existing records from other modules, belonging to a section.
  The O&M module never duplicates source records — it stores only a reference.
  - id               — UUID primary key
  - org_id           — Organisation scope (RLS)
  - section_id       — Parent section (CASCADE delete)
  - manual_id        — Denormalised for cross-section queries
  - project_id       — Denormalised for filtering
  - source_module    — Origin module: 'tc_record' | 'site_form' | 'project_document'
  - source_record_id — UUID/id of the source record (TEXT, no FK — source tables vary)
  - title            — Label copied at tagging time (resilient to source renames/deletions)
  - subtitle         — Secondary label (e.g. form type, document category)
  - notes            — Editor annotation for this item
  - sort_order       — Integer sort order within section
  - created_by       — Name of the user who added this item
  - created_at       — Creation timestamp

  ## Security
  - RLS enabled on all three tables.
  - Org-scoped via user_orgs lookup (same pattern as all VYSITE operational tables).
  - Four separate policies per table: SELECT, INSERT, UPDATE, DELETE.
  - All scoped TO authenticated.

  ## Notes
  - project_id is TEXT (not uuid) to match the vy_projects convention.
  - source_record_id is TEXT (no FK constraint) — source tables have different PK types.
  - title is copied at tagging time so finalised manuals are resilient to upstream edits.
  - No FK from source tables to vy_o_and_m_items (source modules remain unaware of O&M).
*/

-- ── vy_o_and_m_manuals ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_o_and_m_manuals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  project_id  text NOT NULL DEFAULT '',
  title       text NOT NULL DEFAULT 'O&M Manual',
  status      text NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','in_progress','finalised')),
  version     text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_o_and_m_manuals_org_id     ON vy_o_and_m_manuals(org_id);
CREATE INDEX IF NOT EXISTS idx_o_and_m_manuals_project_id ON vy_o_and_m_manuals(project_id);

CREATE OR REPLACE FUNCTION trg_set_o_and_m_manuals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_o_and_m_manuals_updated_at ON vy_o_and_m_manuals;
CREATE TRIGGER trg_o_and_m_manuals_updated_at
  BEFORE UPDATE ON vy_o_and_m_manuals
  FOR EACH ROW EXECUTE FUNCTION trg_set_o_and_m_manuals_updated_at();

ALTER TABLE vy_o_and_m_manuals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view o_and_m_manuals" ON vy_o_and_m_manuals;
CREATE POLICY "Org members can view o_and_m_manuals"
  ON vy_o_and_m_manuals FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can create o_and_m_manuals" ON vy_o_and_m_manuals;
CREATE POLICY "Org members can create o_and_m_manuals"
  ON vy_o_and_m_manuals FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can update o_and_m_manuals" ON vy_o_and_m_manuals;
CREATE POLICY "Org members can update o_and_m_manuals"
  ON vy_o_and_m_manuals FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can delete o_and_m_manuals" ON vy_o_and_m_manuals;
CREATE POLICY "Org members can delete o_and_m_manuals"
  ON vy_o_and_m_manuals FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- ── vy_o_and_m_sections ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_o_and_m_sections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  manual_id   uuid NOT NULL REFERENCES vy_o_and_m_manuals(id) ON DELETE CASCADE,
  project_id  text NOT NULL DEFAULT '',
  title       text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_o_and_m_sections_org_id    ON vy_o_and_m_sections(org_id);
CREATE INDEX IF NOT EXISTS idx_o_and_m_sections_manual_id ON vy_o_and_m_sections(manual_id);

ALTER TABLE vy_o_and_m_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view o_and_m_sections" ON vy_o_and_m_sections;
CREATE POLICY "Org members can view o_and_m_sections"
  ON vy_o_and_m_sections FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can create o_and_m_sections" ON vy_o_and_m_sections;
CREATE POLICY "Org members can create o_and_m_sections"
  ON vy_o_and_m_sections FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can update o_and_m_sections" ON vy_o_and_m_sections;
CREATE POLICY "Org members can update o_and_m_sections"
  ON vy_o_and_m_sections FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can delete o_and_m_sections" ON vy_o_and_m_sections;
CREATE POLICY "Org members can delete o_and_m_sections"
  ON vy_o_and_m_sections FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

-- ── vy_o_and_m_items ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_o_and_m_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL,
  section_id       uuid NOT NULL REFERENCES vy_o_and_m_sections(id) ON DELETE CASCADE,
  manual_id        uuid NOT NULL,
  project_id       text NOT NULL DEFAULT '',
  source_module    text NOT NULL DEFAULT 'project_document'
                   CHECK (source_module IN ('tc_record','site_form','project_document')),
  source_record_id text NOT NULL DEFAULT '',
  title            text NOT NULL DEFAULT '',
  subtitle         text NOT NULL DEFAULT '',
  notes            text NOT NULL DEFAULT '',
  sort_order       integer NOT NULL DEFAULT 0,
  created_by       text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_o_and_m_items_org_id     ON vy_o_and_m_items(org_id);
CREATE INDEX IF NOT EXISTS idx_o_and_m_items_section_id ON vy_o_and_m_items(section_id);
CREATE INDEX IF NOT EXISTS idx_o_and_m_items_manual_id  ON vy_o_and_m_items(manual_id);

ALTER TABLE vy_o_and_m_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view o_and_m_items" ON vy_o_and_m_items;
CREATE POLICY "Org members can view o_and_m_items"
  ON vy_o_and_m_items FOR SELECT TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can create o_and_m_items" ON vy_o_and_m_items;
CREATE POLICY "Org members can create o_and_m_items"
  ON vy_o_and_m_items FOR INSERT TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can update o_and_m_items" ON vy_o_and_m_items;
CREATE POLICY "Org members can update o_and_m_items"
  ON vy_o_and_m_items FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Org members can delete o_and_m_items" ON vy_o_and_m_items;
CREATE POLICY "Org members can delete o_and_m_items"
  ON vy_o_and_m_items FOR DELETE TO authenticated
  USING (org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid()));
