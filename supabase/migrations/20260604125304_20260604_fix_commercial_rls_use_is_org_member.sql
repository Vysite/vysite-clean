/*
  # Fix commercial tables RLS — use is_org_member() SECURITY DEFINER pattern

  ## Problem
  The RLS policies on vy_commercial_records and vy_commercial_line_items use a
  direct subquery against user_orgs:

    org_id IN (SELECT org_id FROM user_orgs WHERE user_id = auth.uid())

  All other operational tables in this platform (vy_actions, vy_snags, vy_projects,
  etc.) were migrated in phase3 (20260525100736) to use the SECURITY DEFINER
  helper functions is_org_member() and is_org_manager_or_above() instead. These
  functions bypass RLS on user_orgs, which prevents policy recursion and ensures
  writes succeed for authenticated org members.

  The direct subquery pattern causes INSERT to fail because the RLS evaluation
  path through user_orgs does not resolve correctly in the write context.

  ## Fix
  Drop the four direct-subquery policies on each table and replace them with
  equivalent policies using is_org_member(auth.uid(), org_id) — exactly matching
  the pattern used by every other working table in the platform.

  ## Changes
  - vy_commercial_records: drop 4 policies, add 4 replacement policies
  - vy_commercial_line_items: drop 4 policies, add 4 replacement policies
  - No data changes
  - No schema changes
*/

-- ── vy_commercial_records ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Org members can view commercial records"   ON vy_commercial_records;
DROP POLICY IF EXISTS "Org members can create commercial records" ON vy_commercial_records;
DROP POLICY IF EXISTS "Org members can update commercial records" ON vy_commercial_records;
DROP POLICY IF EXISTS "Org members can delete commercial records" ON vy_commercial_records;

CREATE POLICY "Org members can view commercial records"
  ON vy_commercial_records FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can create commercial records"
  ON vy_commercial_records FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update commercial records"
  ON vy_commercial_records FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can delete commercial records"
  ON vy_commercial_records FOR DELETE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

-- ── vy_commercial_line_items ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Org members can view commercial line items"   ON vy_commercial_line_items;
DROP POLICY IF EXISTS "Org members can create commercial line items" ON vy_commercial_line_items;
DROP POLICY IF EXISTS "Org members can update commercial line items" ON vy_commercial_line_items;
DROP POLICY IF EXISTS "Org members can delete commercial line items" ON vy_commercial_line_items;

CREATE POLICY "Org members can view commercial line items"
  ON vy_commercial_line_items FOR SELECT
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can create commercial line items"
  ON vy_commercial_line_items FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can update commercial line items"
  ON vy_commercial_line_items FOR UPDATE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id))
  WITH CHECK (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org members can delete commercial line items"
  ON vy_commercial_line_items FOR DELETE
  TO authenticated
  USING (is_org_member(auth.uid(), org_id));
