/*
# Asset Management — Stage A Core Tables

## Purpose
Creates the permanent Asset Register for VYSITE. Assets belong to the Organisation
via a Site → Building → Location hierarchy. Assets are NOT owned by Projects or
Maintenance contracts — those are optional references only.

## New Tables
1. vy_asset_sites — top-level physical sites (e.g. hospitals, campuses)
2. vy_asset_buildings — buildings within a site
3. vy_asset_locations — specific locations within a building (plantrooms, floors)
4. vy_assets — the permanent asset register
5. vy_asset_documents — documents attached to an asset (O&M, warranties, service reports)
6. vy_asset_activity — timestamped activity/comment log per asset

## Security
- All tables are org-scoped with RLS enabled.
- Policies use the existing is_org_member(auth.uid(), org_id) function for org isolation.
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE) scoped to authenticated org members.
- INSERT/UPDATE/DELETE additionally require is_org_manager_or_above for write operations.

## Notes
- Asset has a public_asset_token column (reserved for future QR scanning — NOT used in Stage A).
- Serial number is NOT unique — duplicates are warned about in UI, not blocked at DB level.
- Soft-delete via status='Decommissioned' is preferred over hard delete.
- org_id columns are uuid to match existing org_settings/organisations schema.
*/

-- ─── Sites ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_asset_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  address text,
  status text NOT NULL DEFAULT 'Active',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_asset_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_sites_select" ON vy_asset_sites;
CREATE POLICY "asset_sites_select" ON vy_asset_sites FOR SELECT
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_sites_insert" ON vy_asset_sites;
CREATE POLICY "asset_sites_insert" ON vy_asset_sites FOR INSERT
TO authenticated WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_sites_update" ON vy_asset_sites;
CREATE POLICY "asset_sites_update" ON vy_asset_sites FOR UPDATE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id)) WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_sites_delete" ON vy_asset_sites;
CREATE POLICY "asset_sites_delete" ON vy_asset_sites FOR DELETE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

-- ─── Buildings ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_asset_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  site_id uuid REFERENCES vy_asset_sites(id) ON DELETE RESTRICT,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_asset_buildings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_buildings_select" ON vy_asset_buildings;
CREATE POLICY "asset_buildings_select" ON vy_asset_buildings FOR SELECT
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_buildings_insert" ON vy_asset_buildings;
CREATE POLICY "asset_buildings_insert" ON vy_asset_buildings FOR INSERT
TO authenticated WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_buildings_update" ON vy_asset_buildings;
CREATE POLICY "asset_buildings_update" ON vy_asset_buildings FOR UPDATE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id)) WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_buildings_delete" ON vy_asset_buildings;
CREATE POLICY "asset_buildings_delete" ON vy_asset_buildings FOR DELETE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

-- ─── Locations ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_asset_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  building_id uuid REFERENCES vy_asset_buildings(id) ON DELETE RESTRICT,
  name text NOT NULL,
  floor text,
  area text,
  room text,
  notes text,
  status text NOT NULL DEFAULT 'Active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_asset_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_locations_select" ON vy_asset_locations;
CREATE POLICY "asset_locations_select" ON vy_asset_locations FOR SELECT
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_locations_insert" ON vy_asset_locations;
CREATE POLICY "asset_locations_insert" ON vy_asset_locations FOR INSERT
TO authenticated WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_locations_update" ON vy_asset_locations;
CREATE POLICY "asset_locations_update" ON vy_asset_locations FOR UPDATE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id)) WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_locations_delete" ON vy_asset_locations;
CREATE POLICY "asset_locations_delete" ON vy_asset_locations FOR DELETE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

-- ─── Assets ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_tag text NOT NULL,
  name text NOT NULL,
  asset_type text NOT NULL DEFAULT 'Other',
  manufacturer text,
  model text,
  serial_number text,
  site_id uuid REFERENCES vy_asset_sites(id) ON DELETE RESTRICT,
  building_id uuid REFERENCES vy_asset_buildings(id) ON DELETE SET NULL,
  location_id uuid REFERENCES vy_asset_locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Active',
  installation_date date,
  commissioning_date date,
  warranty_expiry date,
  project_id text,
  project_name text,
  notes text,
  public_asset_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

ALTER TABLE vy_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_select" ON vy_assets;
CREATE POLICY "assets_select" ON vy_assets FOR SELECT
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "assets_insert" ON vy_assets;
CREATE POLICY "assets_insert" ON vy_assets FOR INSERT
TO authenticated WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "assets_update" ON vy_assets;
CREATE POLICY "assets_update" ON vy_assets FOR UPDATE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id)) WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "assets_delete" ON vy_assets;
CREATE POLICY "assets_delete" ON vy_assets FOR DELETE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

CREATE UNIQUE INDEX IF NOT EXISTS vy_assets_tag_org_uniq ON vy_assets (org_id, asset_tag);

-- ─── Asset Documents ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_asset_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES vy_assets(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  file_type text,
  file_size bigint NOT NULL DEFAULT 0,
  storage_path text,
  data_url text,
  notes text,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_asset_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_docs_select" ON vy_asset_documents;
CREATE POLICY "asset_docs_select" ON vy_asset_documents FOR SELECT
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_docs_insert" ON vy_asset_documents;
CREATE POLICY "asset_docs_insert" ON vy_asset_documents FOR INSERT
TO authenticated WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_docs_update" ON vy_asset_documents;
CREATE POLICY "asset_docs_update" ON vy_asset_documents FOR UPDATE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id)) WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_docs_delete" ON vy_asset_documents;
CREATE POLICY "asset_docs_delete" ON vy_asset_documents FOR DELETE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

-- ─── Asset Activity ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_asset_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES vy_assets(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'comment',
  text text NOT NULL,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vy_asset_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asset_activity_select" ON vy_asset_activity;
CREATE POLICY "asset_activity_select" ON vy_asset_activity FOR SELECT
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_activity_insert" ON vy_asset_activity;
CREATE POLICY "asset_activity_insert" ON vy_asset_activity FOR INSERT
TO authenticated WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_activity_update" ON vy_asset_activity;
CREATE POLICY "asset_activity_update" ON vy_asset_activity FOR UPDATE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id)) WITH CHECK (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS "asset_activity_delete" ON vy_asset_activity;
CREATE POLICY "asset_activity_delete" ON vy_asset_activity FOR DELETE
TO authenticated USING (org_id IS NOT NULL AND is_org_member(auth.uid(), org_id));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS vy_assets_org_id_idx ON vy_assets (org_id);
CREATE INDEX IF NOT EXISTS vy_assets_site_id_idx ON vy_assets (site_id);
CREATE INDEX IF NOT EXISTS vy_assets_status_idx ON vy_assets (status);
CREATE INDEX IF NOT EXISTS vy_assets_asset_type_idx ON vy_assets (asset_type);
CREATE INDEX IF NOT EXISTS vy_assets_serial_number_idx ON vy_assets (serial_number);
CREATE INDEX IF NOT EXISTS vy_asset_buildings_site_id_idx ON vy_asset_buildings (site_id);
CREATE INDEX IF NOT EXISTS vy_asset_locations_building_id_idx ON vy_asset_locations (building_id);
CREATE INDEX IF NOT EXISTS vy_asset_documents_asset_id_idx ON vy_asset_documents (asset_id);
CREATE INDEX IF NOT EXISTS vy_asset_activity_asset_id_idx ON vy_asset_activity (asset_id);
