/*
  # Commercial Module — Phase A: vy_commercial_line_items

  Creates the line item table for commercial record cost breakdowns.

  ## New Tables
  - `vy_commercial_line_items`
    - `id`                 — UUID primary key
    - `org_id`             — Organisation scope (matches parent record)
    - `record_id`          — FK to vy_commercial_records
    - `sort_order`         — Controls display order within a record
    - `description`        — Internal description (not shown in client export)
    - `client_description` — Client-facing description (used in client export)
    - `unit`               — Unit of measure e.g. nr, m, m2, hrs, item
    - `quantity`           — Quantity (numeric, supports decimals)
    - `internal_rate`      — Internal cost per unit — SENSITIVE, hidden from non-commercial users
    - `client_rate`        — Client charge per unit
    - `markup_pct`         — Optional mark-up / OH&P percentage (informational)
    - `created_at`         — Row creation timestamp

  ## Notes
  - Line totals and summary totals are computed in the application layer, not stored
  - `internal_rate` sensitivity is enforced at the component level (field not rendered for
    users without commercial.view_pricing). RLS is org-scoped — all org members can read
    rows, matching the pattern used by all other tables in the platform.
  - sort_order allows manual reordering by the user

  ## Security
  - RLS enabled, org-scoped via user_orgs.org_id
*/

CREATE TABLE IF NOT EXISTS vy_commercial_line_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL,
  record_id          uuid NOT NULL REFERENCES vy_commercial_records(id) ON DELETE CASCADE,
  sort_order         integer NOT NULL DEFAULT 0,
  description        text NOT NULL DEFAULT '',
  client_description text NOT NULL DEFAULT '',
  unit               text NOT NULL DEFAULT '',
  quantity           numeric NOT NULL DEFAULT 0,
  internal_rate      numeric NOT NULL DEFAULT 0,
  client_rate        numeric NOT NULL DEFAULT 0,
  markup_pct         numeric,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_line_items_record_id ON vy_commercial_line_items(record_id);
CREATE INDEX IF NOT EXISTS idx_commercial_line_items_org_id    ON vy_commercial_line_items(org_id);

ALTER TABLE vy_commercial_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view commercial line items"
  ON vy_commercial_line_items FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can create commercial line items"
  ON vy_commercial_line_items FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can update commercial line items"
  ON vy_commercial_line_items FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );

CREATE POLICY "Org members can delete commercial line items"
  ON vy_commercial_line_items FOR DELETE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())
  );
