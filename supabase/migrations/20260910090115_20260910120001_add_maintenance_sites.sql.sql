/*
# Maintenance Sites / Buildings / Projects

## Summary
Introduces a parent "Maintenance Location" entity above the existing vy_maintenance_jobs table.
This lets organisations organise maintenance jobs under Sites, Buildings, Projects, or
general categories (e.g. "SAGA Hastings", "Office Portfolio", "Domestic / General Maintenance").

## New Tables

### vy_maintenance_sites
Each row represents a Maintenance Location (Building, Site, Project, or General).

| Column          | Type          | Notes                                         |
|-----------------|---------------|-----------------------------------------------|
| id              | text PK       | Client-generated                              |
| org_id          | uuid NOT NULL | Multi-tenancy scoping                         |
| name            | text NOT NULL | Display name (e.g. "SAGA Hastings")           |
| location_type   | text NOT NULL | 'Building' / 'Site' / 'Project' / 'General'   |
| client_name     | text          | Optional client associated with this location |
| address         | text          | Optional address                              |
| contact_name    | text          | Optional contact                              |
| contact_number  | text          | Optional contact number                       |
| notes           | text          | Free-text notes                               |
| sort_order      | integer       | Display ordering                              |
| created_at      | timestamptz   | Auto-set                                      |
| updated_at      | timestamptz   | Auto-set                                      |

## Modified Tables

### vy_maintenance_jobs
- Added nullable `site_id text` column linking each job to a maintenance location.
- No existing columns changed or removed.
- Backfill: all existing jobs get site_id = NULL (handled client-side via default location).

## Security
- RLS enabled on vy_maintenance_sites.
- Org-scoped read: all org members can read their org's sites.
- Write (insert/update/delete): org managers and above only.
- Uses existing is_org_member / is_org_manager_or_above helper functions.

## Indexes
- idx_vy_maintenance_sites_org_id on (org_id)
- idx_vy_maintenance_jobs_site_id on (org_id, site_id) — for filtering jobs by location

## Important Notes
1. The site_id column on vy_maintenance_jobs is nullable — existing code that doesn't
   know about sites continues to work without modification.
2. No existing maintenance job data is moved or deleted.
3. The front-end will create a "General / Unassigned Maintenance" default location per org
   and treat jobs with site_id = NULL as belonging to that location.
4. The MNT sequence prefix is seeded from existing job numbers to prevent collisions.
*/

-- ─── 1. Create vy_maintenance_sites table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS vy_maintenance_sites (
  id              text PRIMARY KEY,
  org_id          uuid NOT NULL,
  name            text NOT NULL DEFAULT '',
  location_type   text NOT NULL DEFAULT 'General',
  client_name     text NOT NULL DEFAULT '',
  address         text NOT NULL DEFAULT '',
  contact_name    text NOT NULL DEFAULT '',
  contact_number  text NOT NULL DEFAULT '',
  notes           text NOT NULL DEFAULT '',
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vy_maintenance_sites_org_id
  ON vy_maintenance_sites (org_id);

-- ─── 2. Add site_id to vy_maintenance_jobs ───────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_maintenance_jobs' AND column_name = 'site_id'
  ) THEN
    ALTER TABLE vy_maintenance_jobs ADD COLUMN site_id text;
  END IF;
END $$;

-- Index for filtering jobs by site within an org
CREATE INDEX IF NOT EXISTS idx_vy_maintenance_jobs_site_id
  ON vy_maintenance_jobs (org_id, site_id);

-- ─── 3. RLS on vy_maintenance_sites ──────────────────────────────────────────
ALTER TABLE vy_maintenance_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read maintenance sites"
  ON vy_maintenance_sites;
CREATE POLICY "Org members can read maintenance sites"
  ON vy_maintenance_sites FOR SELECT
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_member(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Org managers can insert maintenance sites"
  ON vy_maintenance_sites;
CREATE POLICY "Org managers can insert maintenance sites"
  ON vy_maintenance_sites FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Org managers can update maintenance sites"
  ON vy_maintenance_sites;
CREATE POLICY "Org managers can update maintenance sites"
  ON vy_maintenance_sites FOR UPDATE
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );

DROP POLICY IF EXISTS "Org managers can delete maintenance sites"
  ON vy_maintenance_sites;
CREATE POLICY "Org managers can delete maintenance sites"
  ON vy_maintenance_sites FOR DELETE
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );

-- ─── 4. Seed MNT sequence from existing job numbers ──────────────────────────
-- Extract the highest numeric suffix from existing MNT-YYMM-XXXX job numbers
-- and seed the vy_ref_sequences table so new jobs continue from the right number.
-- scope_id = org_id::text, prefix = 'MNT'
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  org_id::text,
  'MNT',
  COALESCE(MAX(
    NULLIF(regexp_replace(
      regexp_replace(job_number, '^MNT-\d{4}-', ''),
      '[^0-9]', '', 'g'
    ), '')::integer
  ), 0) + 1
FROM vy_maintenance_jobs
WHERE org_id IS NOT NULL AND job_number ~ '^MNT-\d{4}-\d'
GROUP BY org_id
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);
