/*
  # AI Usage Log & Server-side Enforcement

  ## Summary
  Adds an `ai_usage_log` table that records every AI call (successful or failed)
  with full token, cost, and document metadata. Also adds two helper functions
  used by edge functions for atomic allowance reservation and post-call logging.

  ## New Tables

  ### `ai_usage_log`
  Records every AI API call made via VYSITE edge functions.
  - `id` — uuid PK
  - `org_id` — uuid FK → organisations
  - `user_id` — uuid, the auth.uid() at call time
  - `feature` — text, e.g. 'contract-review', 'tender-assistant'
  - `call_type` — text, e.g. 'review-document', 'draft-rfi', 'consolidate-review'
  - `model` — text, e.g. 'claude-opus-4-5'
  - `pages_processed` — integer (null if not applicable)
  - `chunks_total` — integer (null if not applicable)
  - `chunk_index` — integer (null if not applicable)
  - `input_tokens` — integer
  - `output_tokens` — integer
  - `cache_read_tokens` — integer
  - `cache_creation_tokens` — integer
  - `estimated_cost_usd` — numeric(10,6) — derived from token counts
  - `status` — 'success' | 'failed' | 'blocked'
  - `error_code` — text (null on success)
  - `document_name` — text (null if not applicable)
  - `document_size_kb` — integer (null if not applicable)
  - `created_at` — timestamptz

  ## New Functions

  ### `check_ai_allowance(p_org_id uuid)`
  Reads org_settings and returns remaining allowance.
  Returns: { allowed: boolean, remaining: integer, used: integer, limit: integer, bonus: integer }

  ### `increment_ai_usage(p_org_id uuid)`
  Atomically increments ai_used_this_month for the org.

  ## Security
  - RLS enabled on ai_usage_log
  - Super admins can SELECT all rows
  - Users can SELECT rows for their own org
  - Edge functions use service_role so bypass RLS for inserts
*/

-- ─── ai_usage_log table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id               uuid,
  feature               text NOT NULL,
  call_type             text NOT NULL,
  model                 text NOT NULL DEFAULT 'claude-opus-4-5',
  pages_processed       integer,
  chunks_total          integer,
  chunk_index           integer,
  input_tokens          integer NOT NULL DEFAULT 0,
  output_tokens         integer NOT NULL DEFAULT 0,
  cache_read_tokens     integer NOT NULL DEFAULT 0,
  cache_creation_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd    numeric(10,6) NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'blocked')),
  error_code            text,
  document_name         text,
  document_size_kb      integer,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_org_id ON ai_usage_log(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_org_created ON ai_usage_log(org_id, created_at DESC);

-- Super admins can read all usage logs
CREATE POLICY "Super admins can read all ai usage logs"
  ON ai_usage_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins
      WHERE vy_super_admins.auth_user_id = auth.uid()
        AND vy_super_admins.status = 'active'
    )
  );

-- Org members can read their own org's logs
CREATE POLICY "Org members can read their org ai usage logs"
  ON ai_usage_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_orgs
      WHERE user_orgs.org_id = ai_usage_log.org_id
        AND user_orgs.user_id = auth.uid()
    )
  );

-- ─── check_ai_allowance function ─────────────────────────────────────────────
-- Used by edge functions (via service_role) to check allowance before calling AI.
-- Returns remaining = (limit + bonus - used), clamped to 0.

CREATE OR REPLACE FUNCTION check_ai_allowance(p_org_id uuid)
RETURNS TABLE (
  allowed        boolean,
  remaining      integer,
  used           integer,
  monthly_limit  integer,
  bonus_credits  integer,
  ai_enabled     boolean
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_settings org_settings%ROWTYPE;
  v_remaining integer;
BEGIN
  SELECT * INTO v_settings
  FROM org_settings
  WHERE org_id = p_org_id;

  IF NOT FOUND THEN
    -- No settings row: default to enabled with limit 50
    RETURN QUERY SELECT
      true::boolean,
      50::integer,
      0::integer,
      50::integer,
      0::integer,
      true::boolean;
    RETURN;
  END IF;

  -- If AI is disabled at org level, block immediately
  IF v_settings.ai_enabled = false THEN
    RETURN QUERY SELECT
      false::boolean,
      0::integer,
      COALESCE(v_settings.ai_used_this_month, 0),
      COALESCE(v_settings.ai_monthly_limit, 50),
      COALESCE(v_settings.ai_bonus_credits, 0),
      false::boolean;
    RETURN;
  END IF;

  v_remaining := GREATEST(
    0,
    COALESCE(v_settings.ai_monthly_limit, 50)
    + COALESCE(v_settings.ai_bonus_credits, 0)
    - COALESCE(v_settings.ai_used_this_month, 0)
  );

  RETURN QUERY SELECT
    (v_remaining > 0)::boolean,
    v_remaining,
    COALESCE(v_settings.ai_used_this_month, 0),
    COALESCE(v_settings.ai_monthly_limit, 50),
    COALESCE(v_settings.ai_bonus_credits, 0),
    true::boolean;
END;
$$;

-- ─── increment_ai_usage function ─────────────────────────────────────────────
-- Called by edge functions after a successful AI response.
-- Atomically increments ai_used_this_month.

CREATE OR REPLACE FUNCTION increment_ai_usage(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE org_settings
  SET ai_used_this_month = COALESCE(ai_used_this_month, 0) + 1,
      updated_at = now()
  WHERE org_id = p_org_id;
END;
$$;
