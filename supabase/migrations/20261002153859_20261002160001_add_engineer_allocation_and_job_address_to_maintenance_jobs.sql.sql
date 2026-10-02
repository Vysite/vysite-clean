/*
# Maintenance Job — Engineer Allocation + Job/Service Address

## Purpose
Improves the New Maintenance Job workflow to support:
1. Two engineer allocation types: VYSITE User (references a platform user ID) or Custom/External (free-text name + optional company).
2. A job-specific address separate from the Maintenance Location's master address.

## Changes to vy_maintenance_jobs
New columns (all nullable / defaulted for backward compatibility with existing jobs):

1. `engineer_type` text NOT NULL DEFAULT '' — '' means Unassigned, 'vysite' means a VYSITE platform user, 'custom' means a free-text external engineer.
2. `engineer_user_id` text NOT NULL DEFAULT '' — when engineer_type = 'vysite', stores the vy_platform_users.id of the assigned user. Empty otherwise.
3. `engineer_name` text NOT NULL DEFAULT '' — display name for the engineer. For 'vysite' this mirrors the user's name; for 'custom' this is the free-typed name. Backward-compatible: existing jobs use `assigned_engineer` which remains as-is.
4. `engineer_company` text NOT NULL DEFAULT '' — optional company/subcontractor name for custom/external engineers.
5. `job_address` text NOT NULL DEFAULT '' — the specific job/service address (e.g. "Plot 427, 18 Willow Close, Sevenoaks"). When empty, the job uses the Maintenance Location address (existing `site_address` field).
6. `job_address_ref` text NOT NULL DEFAULT '' — optional plot/unit/property reference (e.g. "Plot 427").

## Backward Compatibility
- All new columns default to empty strings so existing rows are valid without data migration.
- `assigned_engineer` column is NOT removed or modified — it remains the primary stored field for backward compatibility. New code will populate `engineer_type`, `engineer_user_id`, `engineer_name`, and `engineer_company` alongside `assigned_engineer` (which mirrors `engineer_name` for display compatibility).
- `site_address` is NOT removed — it continues to hold the inherited location address. `job_address` is additive.

## Security
- No RLS policy changes. The table already has org-scoped RLS policies for SELECT, INSERT, UPDATE, DELETE.
- No new indexes needed — the new columns are not query-critical.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_maintenance_jobs' AND column_name = 'engineer_type') THEN
    ALTER TABLE vy_maintenance_jobs ADD COLUMN engineer_type text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_maintenance_jobs' AND column_name = 'engineer_user_id') THEN
    ALTER TABLE vy_maintenance_jobs ADD COLUMN engineer_user_id text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_maintenance_jobs' AND column_name = 'engineer_name') THEN
    ALTER TABLE vy_maintenance_jobs ADD COLUMN engineer_name text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_maintenance_jobs' AND column_name = 'engineer_company') THEN
    ALTER TABLE vy_maintenance_jobs ADD COLUMN engineer_company text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_maintenance_jobs' AND column_name = 'job_address') THEN
    ALTER TABLE vy_maintenance_jobs ADD COLUMN job_address text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_maintenance_jobs' AND column_name = 'job_address_ref') THEN
    ALTER TABLE vy_maintenance_jobs ADD COLUMN job_address_ref text NOT NULL DEFAULT '';
  END IF;
END $$;
