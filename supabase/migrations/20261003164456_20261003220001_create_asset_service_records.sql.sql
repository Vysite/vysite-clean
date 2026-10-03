/*
# Create Asset Service Records table + link documents

## Purpose
Adds structured Service & Maintenance History to Asset Management.
Each asset can have multiple service records tracking planned services,
reactive maintenance, inspections, repairs, breakdowns, etc.

## New Tables
- `vy_asset_service_records` — structured service/maintenance history per asset
  - id (uuid PK)
  - org_id (uuid NOT NULL) — organisation scope
  - asset_id (uuid NOT NULL, FK→vy_assets ON DELETE CASCADE)
  - service_date (date NOT NULL) — when the service was performed
  - service_type (text NOT NULL) — Planned Service, Reactive Maintenance, Inspection, Repair, Breakdown, Commissioning, Warranty Visit, Other
  - engineer_name (text) — name of engineer who performed the service
  - company (text) — company/contractor
  - work_carried_out (text NOT NULL) — description of work done
  - condition (text) — Good, Satisfactory, Poor, Critical, Not Assessed
  - parts_replaced (text) — description of parts replaced if any
  - recommendations (text) — recommendations for future work
  - next_service_due (date) — next scheduled service date
  - cost (numeric(12,2)) — cost of the service
  - status (text NOT NULL DEFAULT 'Completed') — Completed, Open, Follow-Up Required, Awaiting Parts
  - notes (text) — additional notes
  - created_by (text) — name of user who created the record
  - created_at (timestamptz DEFAULT now())
  - updated_at (timestamptz DEFAULT now())

## Modified Tables
- `vy_asset_documents` — adds nullable `service_record_id` column
  to link documents to specific service records. No data migration needed;
  existing documents keep NULL (unlinked).

## Security
- RLS enabled on vy_asset_service_records
- 4 policies (SELECT/INSERT/UPDATE/DELETE) scoped to authenticated users
  via is_org_member(auth.uid(), org_id)
- Storage path convention unchanged

## Important Notes
1. Service records are lazy-loaded only when an asset is opened — not preloaded
   with the asset register.
2. Document linking uses a nullable FK on vy_asset_documents, so a document
   can be linked to a service record after upload. No link table needed.
3. Cost is visible to all users with asset.view permission — no separate
   financial permission key is introduced in this stage.
*/

-- ============================================================
-- 1. Create vy_asset_service_records table
-- ============================================================
CREATE TABLE IF NOT EXISTS vy_asset_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES vy_assets(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  service_type text NOT NULL,
  engineer_name text,
  company text,
  work_carried_out text NOT NULL,
  condition text,
  parts_replaced text,
  recommendations text,
  next_service_due date,
  cost numeric(12,2),
  status text NOT NULL DEFAULT 'Completed',
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_asset_service_records ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS vy_asset_service_records_asset_id_idx ON vy_asset_service_records(asset_id);
CREATE INDEX IF NOT EXISTS vy_asset_service_records_org_id_idx ON vy_asset_service_records(org_id);
CREATE INDEX IF NOT EXISTS vy_asset_service_records_service_date_idx ON vy_asset_service_records(service_date);

-- ============================================================
-- 2. RLS Policies for vy_asset_service_records
-- ============================================================
DROP POLICY IF EXISTS "asset_service_select" ON vy_asset_service_records;
CREATE POLICY "asset_service_select"
  ON vy_asset_service_records FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_service_insert" ON vy_asset_service_records;
CREATE POLICY "asset_service_insert"
  ON vy_asset_service_records FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_service_update" ON vy_asset_service_records;
CREATE POLICY "asset_service_update"
  ON vy_asset_service_records FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_service_delete" ON vy_asset_service_records;
CREATE POLICY "asset_service_delete"
  ON vy_asset_service_records FOR DELETE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

-- ============================================================
-- 3. Add service_record_id to vy_asset_documents
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_asset_documents' AND column_name = 'service_record_id'
  ) THEN
    ALTER TABLE vy_asset_documents ADD COLUMN service_record_id uuid REFERENCES vy_asset_service_records(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS vy_asset_documents_service_record_id_idx ON vy_asset_documents(service_record_id) WHERE service_record_id IS NOT NULL;
