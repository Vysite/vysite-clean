/*
# Create Tender Drawings and Drawing Calibrations tables

## Purpose
Stage B of the Take-Off integration: establishes the database foundation for
tender-scoped drawing management with per-page calibration.

## New Tables

### 1. vy_tender_drawings
Stores metadata for each PDF drawing uploaded to a tender.
- id (uuid PK, DEFAULT gen_random_uuid())
- org_id (uuid NOT NULL, FK -> organisations(id) ON DELETE CASCADE)
- tender_id (text NOT NULL, FK -> vy_tenders(id) ON DELETE CASCADE)
- drawing_number (text NOT NULL DEFAULT '')
- title (text NOT NULL DEFAULT '')
- discipline (text NOT NULL DEFAULT 'General')
- revision (text NOT NULL DEFAULT 'P01')
- storage_path (text NOT NULL) — path within the tender-drawings bucket
- file_name (text NOT NULL) — original file name
- file_size (bigint NOT NULL DEFAULT 0) — size in bytes
- page_count (integer NOT NULL DEFAULT 1)
- current_page (integer NOT NULL DEFAULT 1) — last viewed page for persistence
- status (text NOT NULL DEFAULT 'active', CHECK in 'active','archived')
- notes (text NOT NULL DEFAULT '')
- uploaded_by (text NOT NULL DEFAULT '')
- created_at (timestamptz DEFAULT now())
- updated_at (timestamptz DEFAULT now())

Indexes: org_id, tender_id, (org_id, tender_id)

### 2. vy_tender_drawing_calibrations
Stores per-page calibration for each drawing.
- id (uuid PK, DEFAULT gen_random_uuid())
- org_id (uuid NOT NULL, FK -> organisations(id) ON DELETE CASCADE)
- tender_id (text NOT NULL, FK -> vy_tenders(id) ON DELETE CASCADE)
- drawing_id (uuid NOT NULL, FK -> vy_tender_drawings(id) ON DELETE CASCADE)
- page_number (integer NOT NULL, CHECK >= 1)
- method (text NOT NULL, CHECK in 'preset','manual','none')
- scale_ratio (text) — e.g. '1:100' for preset
- scale_value (numeric(12,4)) — computed scale factor (real-world units per PDF unit)
- unit (text NOT NULL DEFAULT 'm') — real-world unit (m, mm, cm)
- reference_distance (numeric(12,4)) — known real-world distance for manual calibration
- pixel_distance (numeric(12,4)) — pixel distance between calibration points
- scale_factor (numeric(18,8)) — final scale factor: real-world units per normalized coordinate unit
- calibration_points (jsonb) — [{x: normalized, y: normalized}, {x, y}] for manual calibration
- created_at (timestamptz DEFAULT now())
- updated_at (timestamptz DEFAULT now())

Unique constraint: (drawing_id, page_number) — one calibration per drawing page
Indexes: org_id, drawing_id, (org_id, tender_id)

## Security (RLS)
Both tables use the standard MAIN VYSITE org-scoped RLS pattern:
- SELECT: any active org member (is_org_member)
- INSERT: any active org member (WITH CHECK is_org_member)
- UPDATE: any active org member (USING + WITH CHECK is_org_member)
- DELETE: manager-or-above only (is_org_manager_or_above)

## Storage
Creates a PRIVATE bucket 'tender-drawings' with org-scoped storage policies:
- READ: is_org_member(auth.uid(), (storage.foldername(name))[1])
- WRITE (INSERT/UPDATE): is_org_member(auth.uid(), (storage.foldername(name))[1])
- DELETE: is_org_manager_or_above(auth.uid(), (storage.foldername(name))[1])

Path convention: {org_id}/{tender_id}/{drawing_id}/{filename}

## Important Notes
1. All tables are ADDITIVE — no existing tables are modified.
2. No existing RLS policies are changed.
3. No existing data is affected.
4. The bucket is private — no public access. Signed URLs required.
5. Calibration points use normalized coordinates (0.0–1.0) for Stage C compatibility.
*/
CREATE TABLE IF NOT EXISTS vy_tender_drawings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tender_id text NOT NULL REFERENCES vy_tenders(id) ON DELETE CASCADE,
  drawing_number text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  discipline text NOT NULL DEFAULT 'General',
  revision text NOT NULL DEFAULT 'P01',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  page_count integer NOT NULL DEFAULT 1,
  current_page integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  notes text NOT NULL DEFAULT '',
  uploaded_by text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vy_tender_drawings_org_id ON vy_tender_drawings(org_id);
CREATE INDEX IF NOT EXISTS idx_vy_tender_drawings_tender_id ON vy_tender_drawings(tender_id);
CREATE INDEX IF NOT EXISTS idx_vy_tender_drawings_org_tender ON vy_tender_drawings(org_id, tender_id);

CREATE TABLE IF NOT EXISTS vy_tender_drawing_calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tender_id text NOT NULL REFERENCES vy_tenders(id) ON DELETE CASCADE,
  drawing_id uuid NOT NULL REFERENCES vy_tender_drawings(id) ON DELETE CASCADE,
  page_number integer NOT NULL CHECK (page_number >= 1),
  method text NOT NULL DEFAULT 'none' CHECK (method IN ('preset', 'manual', 'none')),
  scale_ratio text,
  scale_value numeric(12,4),
  unit text NOT NULL DEFAULT 'm',
  reference_distance numeric(12,4),
  pixel_distance numeric(12,4),
  scale_factor numeric(18,8),
  calibration_points jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_drawing_page_calibration UNIQUE (drawing_id, page_number)
);
CREATE INDEX IF NOT EXISTS idx_vy_tender_drawing_calibrations_org_id ON vy_tender_drawing_calibrations(org_id);
CREATE INDEX IF NOT EXISTS idx_vy_tender_drawing_calibrations_drawing_id ON vy_tender_drawing_calibrations(drawing_id);
CREATE INDEX IF NOT EXISTS idx_vy_tender_drawing_calibrations_org_tender ON vy_tender_drawing_calibrations(org_id, tender_id);

ALTER TABLE vy_tender_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vy_tender_drawing_calibrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read own tender drawings" ON vy_tender_drawings;
CREATE POLICY "Org members can read own tender drawings"
  ON vy_tender_drawings FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can insert tender drawings" ON vy_tender_drawings;
CREATE POLICY "Org members can insert tender drawings"
  ON vy_tender_drawings FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can update tender drawings" ON vy_tender_drawings;
CREATE POLICY "Org members can update tender drawings"
  ON vy_tender_drawings FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Managers can delete tender drawings" ON vy_tender_drawings;
CREATE POLICY "Managers can delete tender drawings"
  ON vy_tender_drawings FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can read drawing calibrations" ON vy_tender_drawing_calibrations;
CREATE POLICY "Org members can read drawing calibrations"
  ON vy_tender_drawing_calibrations FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can insert drawing calibrations" ON vy_tender_drawing_calibrations;
CREATE POLICY "Org members can insert drawing calibrations"
  ON vy_tender_drawing_calibrations FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Org members can update drawing calibrations" ON vy_tender_drawing_calibrations;
CREATE POLICY "Org members can update drawing calibrations"
  ON vy_tender_drawing_calibrations FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "Managers can delete drawing calibrations" ON vy_tender_drawing_calibrations;
CREATE POLICY "Managers can delete drawing calibrations"
  ON vy_tender_drawing_calibrations FOR DELETE TO authenticated
  USING (is_org_manager_or_above(auth.uid(), org_id));

INSERT INTO storage.buckets (id, name, public)
VALUES ('tender-drawings', 'tender-drawings', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Org members can read tender drawings storage" ON storage.objects;
CREATE POLICY "Org members can read tender drawings storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'tender-drawings'
    AND is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Org members can upload tender drawings storage" ON storage.objects;
CREATE POLICY "Org members can upload tender drawings storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tender-drawings'
    AND is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Org members can update tender drawings storage" ON storage.objects;
CREATE POLICY "Org members can update tender drawings storage"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tender-drawings'
    AND is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'tender-drawings'
    AND is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Managers can delete tender drawings storage" ON storage.objects;
CREATE POLICY "Managers can delete tender drawings storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tender-drawings'
    AND is_org_manager_or_above(auth.uid(), (storage.foldername(name))[1]::uuid)
  );
