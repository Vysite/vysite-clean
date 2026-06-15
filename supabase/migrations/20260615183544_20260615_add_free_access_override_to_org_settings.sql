-- Add free_access_override columns to org_settings.
-- This is an admin override layer: when enabled it bypasses trial expiry,
-- subscription status, and account_status checks entirely.

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS free_access_enabled      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS free_access_enabled_at   timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS free_access_enabled_by   text        DEFAULT NULL;
