/*
  # Add trial support columns to org_settings

  ## Changes

  ### Modified Tables

  **org_settings**
  - `account_type` (text, NOT NULL DEFAULT 'paid') — distinguishes trial organisations
    from paid or internal ones. Values: 'trial', 'paid', 'internal'.
  - `trial_expires_at` (timestamptz, nullable) — when the trial ends. NULL means no
    expiry (used for paid and internal accounts). Set to now() + 14 days for new
    trial organisations created by the provision-trial-org function.

  ### Constraints
  - CHECK on account_type: only 'trial', 'paid', 'internal' allowed.

  ### Notes
  1. Existing rows are left with account_type = 'paid' (the safe default — NEXA
     Solutions and any manually-created orgs are not trials).
  2. No RLS changes required — existing platform_admin and super_admin policies on
     org_settings already cover INSERT/UPDATE for the provisioning function, which
     runs under the service-role key and bypasses RLS entirely.
  3. The trial_expires_at column is read by the frontend OrgSettingsContext to
     display an expiry warning and/or gate access when the trial has ended.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_settings' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE org_settings
      ADD COLUMN account_type text NOT NULL DEFAULT 'paid'
      CONSTRAINT org_settings_account_type_check
        CHECK (account_type IN ('trial', 'paid', 'internal'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_settings' AND column_name = 'trial_expires_at'
  ) THEN
    ALTER TABLE org_settings
      ADD COLUMN trial_expires_at timestamptz DEFAULT NULL;
  END IF;
END $$;
