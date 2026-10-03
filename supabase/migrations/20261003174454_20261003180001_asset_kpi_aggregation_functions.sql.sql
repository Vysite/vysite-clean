/*
# Server-side Asset KPI and Location Count aggregation

## Purpose
Replaces browser-side counting of all asset rows with server-side
aggregate functions. At 50,000 assets this reduces the KPI payload
from 50,000 rows to 1 row; location counts from 50,000 rows to a
single JSON object with per-hierarchy counts.

## New Functions
1. get_asset_kpis(org_uuid uuid) → json
   Returns: {"total":N,"active":N,"outOfService":N,"underRepair":N,"decommissioned":N,"replaced":N}

2. get_asset_location_counts(org_uuid uuid) → json
   Returns: {"site:<id>":N,"building:<id>":N,"location:<id>":N,...}

## Security
- Both functions are SECURITY INVOKER (default) — they run with the
  caller's privileges and RLS policies on vy_assets still apply.
- Each function checks is_org_member(auth.uid(), org_uuid) and returns
  NULL if the caller is not a member of the org.
- No SECURITY DEFINER, no bypass of RLS.
- Org isolation is enforced both by the function's WHERE clause and
  by RLS on vy_assets.

## No Data Changes
Pure function additions. No tables, no columns, no data migration.
*/

-- ────────────────────────────────────────────────────────────────
-- 1. Asset KPI aggregation function
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_asset_kpis(org_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result json;
BEGIN
  -- Verify caller belongs to this org
  IF NOT is_org_member(auth.uid(), org_uuid) THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'total',          COUNT(*),
    'active',         COUNT(*) FILTER (WHERE status = 'Active'),
    'outOfService',   COUNT(*) FILTER (WHERE status = 'Out of Service'),
    'underRepair',    COUNT(*) FILTER (WHERE status = 'Under Repair'),
    'decommissioned', COUNT(*) FILTER (WHERE status = 'Decommissioned'),
    'replaced',       COUNT(*) FILTER (WHERE status = 'Replaced')
  )
  INTO result
  FROM vy_assets
  WHERE org_id = org_uuid;

  RETURN result;
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION get_asset_kpis(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2. Asset location count aggregation function
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_asset_location_counts(org_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  result json;
BEGIN
  -- Verify caller belongs to this org
  IF NOT is_org_member(auth.uid(), org_uuid) THEN
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(
      (
        SELECT json_object_agg(key, cnt)
        FROM (
          SELECT 'site:' || site_id AS key, COUNT(*) AS cnt
          FROM vy_assets
          WHERE org_id = org_uuid AND site_id IS NOT NULL
          GROUP BY site_id
          UNION ALL
          SELECT 'building:' || building_id AS key, COUNT(*) AS cnt
          FROM vy_assets
          WHERE org_id = org_uuid AND building_id IS NOT NULL
          GROUP BY building_id
          UNION ALL
          SELECT 'location:' || location_id AS key, COUNT(*) AS cnt
          FROM vy_assets
          WHERE org_id = org_uuid AND location_id IS NOT NULL
          GROUP BY location_id
        ) counts
      ),
      '{}'::json
    )
  INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION get_asset_location_counts(uuid) TO authenticated;
