/*
# Supply Chain Module — Phase 1 Schema

## Overview
Creates all tables required for the VYSITE Supply Chain module Phase 1.
Provides a complete Supplier & Supply Chain Management system including
supplier profiles, PQQ questionnaires, document storage, and configurable
trade/specialism lists.

## New Tables

### Configuration Tables (org-level)
1. `vy_supplier_trades` — Org-configurable trade definitions
2. `vy_supplier_specialisms` — Org-configurable specialism definitions
3. `vy_supplier_labour_rate_types` — Org-configurable labour rate type definitions

### Core Supplier Tables
4. `vy_suppliers` — Core supplier record: company info, classification, geographic
   coverage, commercial package values, approval status, PQQ status
5. `vy_supplier_trade_links` — Many-to-many: which trades a supplier covers
6. `vy_supplier_specialism_links` — Many-to-many: which specialisms a supplier covers
7. `vy_supplier_labour_rates` — Standard labour rates per rate type per supplier
8. `vy_supplier_pqq_responses` — PQQ questionnaire responses per section (JSONB
   for future AI import compatibility), with section status tracking
9. `vy_supplier_documents` — Document library: metadata + base64 file content

## Security
- RLS enabled on all 9 tables
- All policies use `is_org_member()` for org-scoped access
- 4 separate policies per table (SELECT, INSERT, UPDATE, DELETE)

## Important Notes
1. All id columns use TEXT for consistency with existing VYSITE tables.
2. org_id is TEXT but cast to UUID in RLS predicates via org_id::uuid.
3. vy_supplier_pqq_responses.responses is JSONB — ready for future AI extraction.
4. vy_supplier_documents.data_url stores base64 content (consistent with existing attachment pattern).
5. regions stored as TEXT[] on supplier (fixed list, not user-configurable).
6. pqq_import_raw on vy_suppliers is reserved for future AI PQQ upload feature.
*/

-- ─── Trade definitions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_supplier_trades (
  id         TEXT        PRIMARY KEY,
  org_id     TEXT        NOT NULL,
  name       TEXT        NOT NULL DEFAULT '',
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vy_supplier_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sct_select" ON vy_supplier_trades;
CREATE POLICY "sct_select" ON vy_supplier_trades FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sct_insert" ON vy_supplier_trades;
CREATE POLICY "sct_insert" ON vy_supplier_trades FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sct_update" ON vy_supplier_trades;
CREATE POLICY "sct_update" ON vy_supplier_trades FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sct_delete" ON vy_supplier_trades;
CREATE POLICY "sct_delete" ON vy_supplier_trades FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

-- ─── Specialism definitions ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_supplier_specialisms (
  id         TEXT        PRIMARY KEY,
  org_id     TEXT        NOT NULL,
  name       TEXT        NOT NULL DEFAULT '',
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vy_supplier_specialisms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scsp_select" ON vy_supplier_specialisms;
CREATE POLICY "scsp_select" ON vy_supplier_specialisms FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scsp_insert" ON vy_supplier_specialisms;
CREATE POLICY "scsp_insert" ON vy_supplier_specialisms FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scsp_update" ON vy_supplier_specialisms;
CREATE POLICY "scsp_update" ON vy_supplier_specialisms FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scsp_delete" ON vy_supplier_specialisms;
CREATE POLICY "scsp_delete" ON vy_supplier_specialisms FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

-- ─── Labour rate type definitions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_supplier_labour_rate_types (
  id         TEXT        PRIMARY KEY,
  org_id     TEXT        NOT NULL,
  name       TEXT        NOT NULL DEFAULT '',
  is_default BOOLEAN     NOT NULL DEFAULT false,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vy_supplier_labour_rate_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sclrt_select" ON vy_supplier_labour_rate_types;
CREATE POLICY "sclrt_select" ON vy_supplier_labour_rate_types FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sclrt_insert" ON vy_supplier_labour_rate_types;
CREATE POLICY "sclrt_insert" ON vy_supplier_labour_rate_types FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sclrt_update" ON vy_supplier_labour_rate_types;
CREATE POLICY "sclrt_update" ON vy_supplier_labour_rate_types FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sclrt_delete" ON vy_supplier_labour_rate_types;
CREATE POLICY "sclrt_delete" ON vy_supplier_labour_rate_types FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

-- ─── Core suppliers ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_suppliers (
  id                       TEXT        PRIMARY KEY,
  org_id                   TEXT        NOT NULL,
  -- Company information
  company_name             TEXT        NOT NULL DEFAULT '',
  trading_name             TEXT        NOT NULL DEFAULT '',
  company_number           TEXT        NOT NULL DEFAULT '',
  vat_number               TEXT        NOT NULL DEFAULT '',
  utr_number               TEXT        NOT NULL DEFAULT '',
  reg_address_line1        TEXT        NOT NULL DEFAULT '',
  reg_address_line2        TEXT        NOT NULL DEFAULT '',
  reg_address_city         TEXT        NOT NULL DEFAULT '',
  reg_address_county       TEXT        NOT NULL DEFAULT '',
  reg_address_postcode     TEXT        NOT NULL DEFAULT '',
  reg_address_country      TEXT        NOT NULL DEFAULT 'United Kingdom',
  trading_address_same     BOOLEAN     NOT NULL DEFAULT true,
  trade_address_line1      TEXT        NOT NULL DEFAULT '',
  trade_address_line2      TEXT        NOT NULL DEFAULT '',
  trade_address_city       TEXT        NOT NULL DEFAULT '',
  trade_address_county     TEXT        NOT NULL DEFAULT '',
  trade_address_postcode   TEXT        NOT NULL DEFAULT '',
  trade_address_country    TEXT        NOT NULL DEFAULT 'United Kingdom',
  website                  TEXT        NOT NULL DEFAULT '',
  general_email            TEXT        NOT NULL DEFAULT '',
  general_telephone        TEXT        NOT NULL DEFAULT '',
  primary_contact          TEXT        NOT NULL DEFAULT '',
  contact_position         TEXT        NOT NULL DEFAULT '',
  mobile_number            TEXT        NOT NULL DEFAULT '',
  company_description      TEXT        NOT NULL DEFAULT '',
  -- Classification
  supplier_type            TEXT        NOT NULL DEFAULT '',
  preferred_supplier       BOOLEAN     NOT NULL DEFAULT false,
  approval_status          TEXT        NOT NULL DEFAULT 'Pending',
  approval_date            TEXT        NOT NULL DEFAULT '',
  approved_by              TEXT        NOT NULL DEFAULT '',
  approval_notes           TEXT        NOT NULL DEFAULT '',
  primary_trade_id         TEXT        NOT NULL DEFAULT '',
  regions                  TEXT[]      NOT NULL DEFAULT '{}',
  -- Commercial
  min_package_value        NUMERIC,
  preferred_package_value  NUMERIC,
  max_package_value        NUMERIC,
  -- PQQ
  pqq_status               TEXT        NOT NULL DEFAULT 'Not Started',
  pqq_import_raw           JSONB,
  -- Internal
  notes                    TEXT        NOT NULL DEFAULT '',
  created_by               TEXT        NOT NULL DEFAULT '',
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vy_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_select" ON vy_suppliers;
CREATE POLICY "sc_select" ON vy_suppliers FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sc_insert" ON vy_suppliers;
CREATE POLICY "sc_insert" ON vy_suppliers FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sc_update" ON vy_suppliers;
CREATE POLICY "sc_update" ON vy_suppliers FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sc_delete" ON vy_suppliers;
CREATE POLICY "sc_delete" ON vy_suppliers FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

CREATE INDEX IF NOT EXISTS idx_vy_suppliers_org_id ON vy_suppliers(org_id);

-- ─── Trade links ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_supplier_trade_links (
  supplier_id TEXT NOT NULL,
  trade_id    TEXT NOT NULL,
  org_id      TEXT NOT NULL,
  PRIMARY KEY (supplier_id, trade_id)
);

ALTER TABLE vy_supplier_trade_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sctl_select" ON vy_supplier_trade_links;
CREATE POLICY "sctl_select" ON vy_supplier_trade_links FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sctl_insert" ON vy_supplier_trade_links;
CREATE POLICY "sctl_insert" ON vy_supplier_trade_links FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sctl_update" ON vy_supplier_trade_links;
CREATE POLICY "sctl_update" ON vy_supplier_trade_links FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sctl_delete" ON vy_supplier_trade_links;
CREATE POLICY "sctl_delete" ON vy_supplier_trade_links FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

-- ─── Specialism links ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_supplier_specialism_links (
  supplier_id   TEXT NOT NULL,
  specialism_id TEXT NOT NULL,
  org_id        TEXT NOT NULL,
  PRIMARY KEY (supplier_id, specialism_id)
);

ALTER TABLE vy_supplier_specialism_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scspl_select" ON vy_supplier_specialism_links;
CREATE POLICY "scspl_select" ON vy_supplier_specialism_links FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scspl_insert" ON vy_supplier_specialism_links;
CREATE POLICY "scspl_insert" ON vy_supplier_specialism_links FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scspl_update" ON vy_supplier_specialism_links;
CREATE POLICY "scspl_update" ON vy_supplier_specialism_links FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scspl_delete" ON vy_supplier_specialism_links;
CREATE POLICY "scspl_delete" ON vy_supplier_specialism_links FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

-- ─── Labour rates ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_supplier_labour_rates (
  id            TEXT        PRIMARY KEY,
  supplier_id   TEXT        NOT NULL,
  org_id        TEXT        NOT NULL,
  rate_type_id  TEXT        NOT NULL,
  standard_rate NUMERIC,
  overtime_rate NUMERIC,
  weekend_rate  NUMERIC,
  night_rate    NUMERIC,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (supplier_id, rate_type_id)
);

ALTER TABLE vy_supplier_labour_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sclr_select" ON vy_supplier_labour_rates;
CREATE POLICY "sclr_select" ON vy_supplier_labour_rates FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sclr_insert" ON vy_supplier_labour_rates;
CREATE POLICY "sclr_insert" ON vy_supplier_labour_rates FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sclr_update" ON vy_supplier_labour_rates;
CREATE POLICY "sclr_update" ON vy_supplier_labour_rates FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "sclr_delete" ON vy_supplier_labour_rates;
CREATE POLICY "sclr_delete" ON vy_supplier_labour_rates FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

-- ─── PQQ responses ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_supplier_pqq_responses (
  id             TEXT        PRIMARY KEY,
  supplier_id    TEXT        NOT NULL,
  org_id         TEXT        NOT NULL,
  section_key    TEXT        NOT NULL,
  responses      JSONB       NOT NULL DEFAULT '{}',
  section_status TEXT        NOT NULL DEFAULT 'not_started',
  notes          TEXT        NOT NULL DEFAULT '',
  completed_at   TIMESTAMPTZ,
  completed_by   TEXT        NOT NULL DEFAULT '',
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (supplier_id, section_key)
);

ALTER TABLE vy_supplier_pqq_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scpqq_select" ON vy_supplier_pqq_responses;
CREATE POLICY "scpqq_select" ON vy_supplier_pqq_responses FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scpqq_insert" ON vy_supplier_pqq_responses;
CREATE POLICY "scpqq_insert" ON vy_supplier_pqq_responses FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scpqq_update" ON vy_supplier_pqq_responses;
CREATE POLICY "scpqq_update" ON vy_supplier_pqq_responses FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scpqq_delete" ON vy_supplier_pqq_responses;
CREATE POLICY "scpqq_delete" ON vy_supplier_pqq_responses FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

-- ─── Supplier documents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vy_supplier_documents (
  id                TEXT        PRIMARY KEY,
  supplier_id       TEXT        NOT NULL,
  org_id            TEXT        NOT NULL,
  document_category TEXT        NOT NULL DEFAULT 'other',
  document_title    TEXT        NOT NULL DEFAULT '',
  file_name         TEXT        NOT NULL DEFAULT '',
  file_type         TEXT        NOT NULL DEFAULT '',
  file_size         INTEGER,
  data_url          TEXT        NOT NULL DEFAULT '',
  issue_date        TEXT        NOT NULL DEFAULT '',
  expiry_date       TEXT        NOT NULL DEFAULT '',
  verified          BOOLEAN     NOT NULL DEFAULT false,
  verified_by       TEXT        NOT NULL DEFAULT '',
  verification_date TEXT        NOT NULL DEFAULT '',
  notes             TEXT        NOT NULL DEFAULT '',
  created_by        TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE vy_supplier_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scdoc_select" ON vy_supplier_documents;
CREATE POLICY "scdoc_select" ON vy_supplier_documents FOR SELECT TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scdoc_insert" ON vy_supplier_documents;
CREATE POLICY "scdoc_insert" ON vy_supplier_documents FOR INSERT TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scdoc_update" ON vy_supplier_documents;
CREATE POLICY "scdoc_update" ON vy_supplier_documents FOR UPDATE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid))
  WITH CHECK (is_org_member(auth.uid(), org_id::uuid));
DROP POLICY IF EXISTS "scdoc_delete" ON vy_supplier_documents;
CREATE POLICY "scdoc_delete" ON vy_supplier_documents FOR DELETE TO authenticated
  USING (is_org_member(auth.uid(), org_id::uuid));

CREATE INDEX IF NOT EXISTS idx_vy_supplier_docs_supplier ON vy_supplier_documents(supplier_id);
