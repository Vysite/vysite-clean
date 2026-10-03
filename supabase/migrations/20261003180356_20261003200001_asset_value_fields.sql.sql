/*
# Asset Value Fields for Lifecycle Cost Reporting

## Purpose
Adds two optional financial fields to vy_assets for future lifecycle-cost
dashboard comparisons:
  - original_asset_cost     — what the asset originally cost
  - current_replacement_cost — what it would cost to replace today

## Field Types
NUMERIC(12,2) — exact decimal arithmetic suitable for GBP currency.
Nullable, no default. Supports pounds and pence without floating-point errors.

## Explicit GRANTs (new permanent rule)
This migration ALTERs an existing table. The table already has grants from
the default privilege system. We re-assert the required privileges explicitly
so the table is future-proof regardless of Supabase's October default-privilege
change. RLS is already enabled with 4 org-scoped policies — unchanged.

## No Data Changes
Pure schema addition. No columns dropped, no types changed, no data migrated.
*/

-- Add financial fields
ALTER TABLE vy_assets
  ADD COLUMN IF NOT EXISTS original_asset_cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS current_replacement_cost NUMERIC(12,2);

-- Re-assert explicit privileges (future-proof per October audit)
GRANT SELECT, INSERT, UPDATE, DELETE ON vy_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vy_assets TO service_role;
