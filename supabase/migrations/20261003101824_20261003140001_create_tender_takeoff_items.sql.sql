/*
# Create Tender Take-Off Items table

## Purpose
Stage C of the Take-Off integration: stores measured take-off items
(Count, Linear, Area) and manual items for a tender.

## New Table
### vy_tender_takeoff_items
- id (uuid PK, DEFAULT gen_random_uuid())
- org_id (uuid NOT NULL, FK -> organisations(id) ON DELETE CASCADE)
- tender_id (text NOT NULL, FK -> vy_tenders(id) ON DELETE CASCADE)
- drawing_id (uuid NULLABLE, FK -> vy_tender_drawings(id) ON DELETE SET NULL)
  — nullable because manual items have no drawing; SET NULL on drawing delete
  so take-off data is NOT destroyed when a drawing is removed
- page_number (integer NOT NULL DEFAULT 1)
- label (text NOT NULL DEFAULT '')
- description (text NOT NULL DEFAULT '')
- measurement_type (text NOT NULL, CHECK in 'count','linear','area')
- quantity (numeric(14,4) NOT NULL DEFAULT 0) — measured/calculated quantity
- unit (text NOT NULL DEFAULT 'nr')
- geometry (jsonb) — normalized geometry (CountPoint[], LinearSegment[], AreaPolygon[])
- colour (text NOT NULL DEFAULT '#f97316')
- notes (text NOT NULL DEFAULT '')
- sort_order (integer NOT NULL DEFAULT 0)
- is_visible (boolean NOT NULL DEFAULT true)
- source (text NOT NULL DEFAULT 'drawing', CHECK in 'drawing','manual')
- discipline (text NOT NULL DEFAULT 'General')
- category (text NOT NULL DEFAULT '')
- manual_quantity (numeric(14,4) NOT NULL DEFAULT 0)
- adjustment_quantity (numeric(14,4) NOT NULL DEFAULT 0)
- line_type (text NOT NULL DEFAULT 'standard', CHECK in 'standard','addition','omission')
- created_by (text NOT NULL DEFAULT '')
- created_at (timestamptz DEFAULT now())
- updated_at (timestamptz DEFAULT now())

Indexes: org_id, tender_id, drawing_id, (org_id, tender_id), (drawing_id, page_number)

## FK Behaviour
- drawing_id references vy_tender_drawings(id) ON DELETE SET NULL
  This means deleting a drawing does NOT destroy take-off items —
  their drawing_id becomes NULL, preserving commercially useful measurement data.
  The user can deliberately delete take-off items separately.

## Security (RLS)
Standard MAIN VYSITE org-scoped 4-policy pattern:
- SELECT: is_org_member
- INSERT: is_org_member WITH CHECK
- UPDATE: is_org_member USING + WITH CHECK
- DELETE: is_org_manager_or_above

## Important Notes
1. ADDITIVE only — no existing tables modified.
2. No existing RLS policies changed.
3. No Estimate linkage — no FK to estimate items.
4. Geometry stored as normalized coordinates (0.0-1.0) in JSONB.
*/
CREATE TABLE IF NOT EXISTS vy_tender_takeoff_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tender_id text NOT NULL REFERENCES vy_tenders(id) ON DELETE CASCADE,
  drawing_id uuid REFERENCES vy_tender_drawings(id) ON DELETE SET NULL,
  page_number integer NOT NULL DEFAULT 1,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  measurement_type text NOT NULL CHECK (measurement_type IN ('count', 'linear', 'area')),
  quantity numeric(14,4) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'nr',
  geometry jsonb,
  colour text NOT NULL DEFAULT '#f97316',
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'drawing' CHECK (source IN ('drawing', 'manual')),
  discipline text NOT NULL DEFAULT 'General',
  category text NOT NULL DEFAULT '',
  manual_quantity numeric(14,4) NOT NULL DEFAULT 0,
  adjustment_quantity numeric(14,4) NOT NULL DEFAULT 0,
  line_type text NOT NULL DEFAULT 'standard' CHECK (line_type IN ('standard', 'addition', 'omission')),
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vy_tender_takeoff_org_id ON vy_tender_takeoff_items(org_id);
CREATE INDEX IF NOT EXISTS idx_vy_tender_takeoff_tender_id ON vy_tender_takeoff_items(tender_id);
CREATE INDEX IF NOT EXISTS idx_vy_tender_takeoff_drawing_id ON vy_tender_takeoff_items(drawing_id);
CREATE INDEX IF NOT EXISTS idx_vy_tender_takeoff_org_tender ON vy_tender_takeoff_items(org_id, tender_id);
CREATE INDEX IF NOT EXISTS idx_vy_tender_takeoff_drawing_page ON vy_tender_takeoff_items(drawing_id, page_number);

ALTER TABLE vy_tender_takeoff_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read takeoff items" ON vy_tender_takeoff_items;
CREATE POLICY "Org members can read takeoff items"
  ON vy_tender_takeoff_items FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can insert takeoff items" ON vy_tender_takeoff_items;
CREATE POLICY "Org members can insert takeoff items"
  ON vy_tender_takeoff_items FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can update takeoff items" ON vy_tender_takeoff_items;
CREATE POLICY "Org members can update takeoff items"
  ON vy_tender_takeoff_items FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Managers can delete takeoff items" ON vy_tender_takeoff_items;
CREATE POLICY "Managers can delete takeoff items"
  ON vy_tender_takeoff_items FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));
