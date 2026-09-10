/*
# Prevent duplicate default maintenance locations

## Root cause
The frontend had two sources of the "General / Unassigned Maintenance" location:
  1. A hardcoded virtual site (GENERAL_SITE constant, id='__default__') prepended to the list
  2. An auto-created DB row (id='msite_default_<org-suffix>') via useEffect

This caused 2-3 duplicate "General / Unassigned Maintenance" cards to appear.
The DB itself only had one row — the duplicates were a frontend rendering issue.

## Fix
1. Frontend: removed the hardcoded GENERAL_SITE constant; all default locations
   now come from the DB only. Added a useRef guard to prevent the auto-creation
   effect from firing twice before state propagates.
2. Database (this migration): adds a partial unique index so only one row per org
   can have location_type='General' AND name='General / Unassigned Maintenance'.
   This is a safety net — the frontend guard is the primary fix.

## No data changes
No existing rows are deleted or modified. The index only prevents future duplicates.
*/

-- Partial unique index: one default General/Unassigned location per org
CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_maintenance_site_per_org
  ON vy_maintenance_sites (org_id)
  WHERE name = 'General / Unassigned Maintenance' AND location_type = 'General';
