/*
  # Create vy_settings table

  ## Summary
  Persistent settings storage for the VYSITE platform workspace configuration.

  ## New Tables

  ### `vy_settings`
  Single-row workspace settings table (keyed by a fixed singleton row id).
  - `id` (text, primary key) — always 'workspace'
  - `company_name` (text) — organisation name shown on PDFs and reports
  - `company_address` (text) — registered address
  - `company_phone` (text)
  - `company_email` (text)
  - `company_website` (text)
  - `company_vat_number` (text)
  - `company_number` (text) — Companies House number
  - `pdf_footer` (text) — footer line on all PDF exports
  - `logo_data_url` (text) — base64 encoded logo image
  - `accent_color` (text) — platform accent colour hex
  - `default_action_priority` (text)
  - `default_snag_priority` (text)
  - `default_project_status` (text)
  - `rfi_number_prefix` (text) — prefix for auto-generated RFI refs, e.g. 'RFI'
  - `rfi_number_start` (integer) — starting number for new RFIs
  - `snag_number_prefix` (text)
  - `snag_number_start` (integer)
  - `action_number_prefix` (text)
  - `action_number_start` (integer)
  - `notification_toggles` (jsonb) — user notification preferences
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read settings
  - Only Admin role can update settings (enforced at app level; RLS allows authenticated updates)
*/

CREATE TABLE IF NOT EXISTS vy_settings (
  id                      text PRIMARY KEY DEFAULT 'workspace',
  company_name            text NOT NULL DEFAULT 'My Company',
  company_address         text NOT NULL DEFAULT '',
  company_phone           text NOT NULL DEFAULT '',
  company_email           text NOT NULL DEFAULT '',
  company_website         text NOT NULL DEFAULT '',
  company_vat_number      text NOT NULL DEFAULT '',
  company_number          text NOT NULL DEFAULT '',
  pdf_footer              text NOT NULL DEFAULT '',
  logo_data_url           text NOT NULL DEFAULT '',
  accent_color            text NOT NULL DEFAULT '#f97316',
  default_action_priority text NOT NULL DEFAULT 'Medium',
  default_snag_priority   text NOT NULL DEFAULT 'Medium',
  default_project_status  text NOT NULL DEFAULT 'Active',
  rfi_number_prefix       text NOT NULL DEFAULT 'RFI',
  rfi_number_start        integer NOT NULL DEFAULT 1,
  snag_number_prefix      text NOT NULL DEFAULT 'SNG',
  snag_number_start       integer NOT NULL DEFAULT 1,
  action_number_prefix    text NOT NULL DEFAULT 'ACT',
  action_number_start     integer NOT NULL DEFAULT 1,
  notification_toggles    jsonb NOT NULL DEFAULT '{}',
  updated_at              timestamptz DEFAULT now()
);

-- Seed the singleton row so it always exists
INSERT INTO vy_settings (id) VALUES ('workspace') ON CONFLICT (id) DO NOTHING;

ALTER TABLE vy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON vy_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON vy_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
