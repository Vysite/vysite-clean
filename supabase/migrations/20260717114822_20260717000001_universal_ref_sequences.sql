-- ═════════════════════════════════════════════════════════════════════════════
-- Universal reference-number sequences
--
-- ROOT CAUSE of the RFI-001 regression
-- ─────────────────────────────────────
-- TenderTracker generated new RFI refs using:
--     `RFI-00${tender.rfis.length + 1}`
-- This is COUNT-based, not MAX-based.  When any RFI is deleted the count
-- drops, and the next new RFI reuses a number that already existed in the
-- audit trail.  If the rfis array is ever empty (data not yet loaded, or all
-- previous RFIs deleted), every new RFI resets to RFI-001.
--
-- ALL other modules (VAL-, VAR-, DN-, V-, APP, SN-) used local React-state
-- MAX which is stale for concurrent sessions and does not survive browser
-- refreshes that hit the DB before the store is fully populated.
--
-- FIX
-- ───
-- One atomic PostgreSQL function: get_next_seq_val(scope_id, prefix).
-- Uses INSERT … ON CONFLICT DO UPDATE so two concurrent callers for the same
-- (scope_id, prefix) are serialised by the database engine — no two callers
-- ever receive the same integer.
--
-- scope_id is TEXT so it can hold both UUID-typed and TEXT-typed IDs that
-- exist across the mixed schema in this project.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1. Sequences table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vy_ref_sequences (
  scope_id  text    NOT NULL,
  prefix    text    NOT NULL,
  next_val  integer NOT NULL DEFAULT 1,
  PRIMARY KEY (scope_id, prefix)
);

ALTER TABLE vy_ref_sequences ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users (writes go through SECURITY DEFINER fn)
CREATE POLICY "authenticated_select_ref_sequences"
  ON vy_ref_sequences FOR SELECT
  TO authenticated
  USING (true);

-- ─── 2. Atomic increment function ────────────────────────────────────────────
-- Returns the integer that the caller should use, then increments the stored
-- value.  Concurrency guarantee: the INSERT … ON CONFLICT is one statement
-- evaluated inside a single row lock.
CREATE OR REPLACE FUNCTION get_next_seq_val(p_scope_id text, p_prefix text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v integer;
BEGIN
  INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
    VALUES (p_scope_id, p_prefix, 2)
    ON CONFLICT (scope_id, prefix)
    DO UPDATE SET next_val = vy_ref_sequences.next_val + 1
    RETURNING next_val - 1 INTO v;
  RETURN v;
END;
$$;

-- ─── 3. Seed from existing data ──────────────────────────────────────────────
-- Sets next_val = MAX(existing number) + 1 for each (scope, prefix) pair.
-- ON CONFLICT … DO UPDATE GREATEST ensures a repeated run never reduces a
-- sequence (safe to re-run).

-- VAL-  ── per project (vy_valuations.project_id  text)
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  project_id,
  'VAL',
  COALESCE(MAX(NULLIF(regexp_replace("ref", '[^0-9]', '', 'g'), '')::integer), 0) + 1
FROM vy_valuations
WHERE project_id IS NOT NULL AND "ref" ~ '[0-9]'
GROUP BY project_id
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);

-- VAR-  ── per project (vy_variation_account.project_id  text)
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  project_id,
  'VAR',
  COALESCE(MAX(NULLIF(regexp_replace(reference, '[^0-9]', '', 'g'), '')::integer), 0) + 1
FROM vy_variation_account
WHERE project_id IS NOT NULL AND reference ~ '[0-9]'
GROUP BY project_id
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);

-- EWN-  ── per org (vy_commercial_records.org_id  uuid → cast to text)
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  org_id::text,
  'EWN',
  COALESCE(MAX(NULLIF(regexp_replace(reference, '[^0-9]', '', 'g'), '')::integer), 0) + 1
FROM vy_commercial_records
WHERE record_type = 'early_warning_notice'
  AND org_id IS NOT NULL AND reference ~ '[0-9]'
GROUP BY org_id
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);

-- DN-   ── per org
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  org_id::text,
  'DN',
  COALESCE(MAX(NULLIF(regexp_replace(reference, '[^0-9]', '', 'g'), '')::integer), 0) + 1
FROM vy_commercial_records
WHERE record_type = 'delay_notice'
  AND org_id IS NOT NULL AND reference ~ '[0-9]'
GROUP BY org_id
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);

-- V-    ── per org (commercial register variations)
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  org_id::text,
  'V',
  COALESCE(MAX(NULLIF(regexp_replace(reference, '[^0-9]', '', 'g'), '')::integer), 0) + 1
FROM vy_commercial_records
WHERE record_type = 'variation'
  AND org_id IS NOT NULL AND reference ~ '[0-9]'
GROUP BY org_id
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);

-- APP   ── per project, integer-valued (vy_commercial_applications.project_id  text)
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  project_id,
  'APP',
  COALESCE(MAX(app_number), 0) + 1
FROM vy_commercial_applications
WHERE project_id IS NOT NULL
GROUP BY project_id
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);

-- SN-   ── per snagging report (vy_snags.report_id  text)
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  report_id,
  'SN',
  COALESCE(MAX(NULLIF(regexp_replace(snag_number, '[^0-9]', '', 'g'), '')::integer), 0) + 1
FROM vy_snags
WHERE report_id IS NOT NULL AND snag_number ~ '[0-9]'
GROUP BY report_id
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);

-- RFI-  ── per tender (vy_tenders.id  text; rfis stored as JSONB array)
-- Extract the highest numeric suffix from each tender's rfis jsonb array.
INSERT INTO vy_ref_sequences (scope_id, prefix, next_val)
SELECT
  t.id,
  'RFI',
  COALESCE((
    SELECT MAX(NULLIF(regexp_replace(rfi->>'ref', '[^0-9]', '', 'g'), '')::integer)
    FROM   jsonb_array_elements(COALESCE(t.rfis, '[]'::jsonb)) AS rfi
    WHERE  (rfi->>'ref') ~ '[0-9]'
  ), 0) + 1
FROM vy_tenders t
WHERE t.id IS NOT NULL
ON CONFLICT (scope_id, prefix)
  DO UPDATE SET next_val = GREATEST(vy_ref_sequences.next_val, EXCLUDED.next_val);
