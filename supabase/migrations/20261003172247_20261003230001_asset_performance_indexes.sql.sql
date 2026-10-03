/*
# Performance indexes for Asset Management scalability

## Purpose
Supports server-side pagination, filtering, and searching of vy_assets
at scale (1k–50k+ rows). Existing single-column indexes cover org_id,
asset_type, serial_number, site_id, and status individually, but the
paginated register query needs a composite on (org_id, updated_at) for
ordered pagination, and building_id + location_id indexes for filter
queries that use those columns.

## New Indexes
1. vy_assets_org_updated_idx — (org_id, updated_at DESC) for paginated register
2. vy_assets_building_id_idx — building_id (was missing)
3. vy_assets_location_id_idx — location_id (was missing)

## No Data Changes
Pure index additions. No columns, no data migration.
*/

-- Composite index for paginated register query: WHERE org_id = ? ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS vy_assets_org_updated_idx ON vy_assets(org_id, updated_at DESC);

-- Missing single-column indexes for filter queries
CREATE INDEX IF NOT EXISTS vy_assets_building_id_idx ON vy_assets(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vy_assets_location_id_idx ON vy_assets(location_id) WHERE location_id IS NOT NULL;
