/*
# Add Project Management Team Role Columns to vy_projects

## Purpose
Establishes the Project record as the single source of truth for its management team.
Four new optional columns store the platform-user ID for each core project role.

## New Columns (all on vy_projects, all nullable text — additive only)
1. `commercial_lead_id` (text, nullable) — ID from vy_platform_users for the Commercial Lead role
2. `technical_lead_id` (text, nullable) — ID from vy_platform_users for the Technical Lead role
3. `site_manager_id`   (text, nullable) — ID from vy_platform_users for the Site Manager role

Note: `project_manager` already exists as a free-text string column.
We are NOT removing or changing it — it continues to work as-is for backward compatibility.
We are NOT adding a `project_manager_id` column in this migration because the
existing `project_manager` field (free-text) must be preserved and existing
modules/PDFs consume it directly. The role-select dropdown for Project Manager
in the UI will map the selected user's name back into the existing
`project_manager` text field, preserving backward compatibility.

## Data Safety
- No existing columns are dropped, renamed, or type-changed.
- All new columns are nullable with default NULL — existing rows are unaffected.
- No data migration or backfill is performed.
- RLS policies on vy_projects are unchanged (org-scoped, already in place).

## Security
- No new RLS policies needed — the table already has org-scoped SELECT/INSERT/UPDATE/DELETE policies.
- The new columns are covered by the existing policies since they are on the same table.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_projects' AND column_name = 'commercial_lead_id') THEN
    ALTER TABLE vy_projects ADD COLUMN commercial_lead_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_projects' AND column_name = 'technical_lead_id') THEN
    ALTER TABLE vy_projects ADD COLUMN technical_lead_id text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_projects' AND column_name = 'site_manager_id') THEN
    ALTER TABLE vy_projects ADD COLUMN site_manager_id text;
  END IF;
END $$;