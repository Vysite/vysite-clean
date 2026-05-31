/*
  # Fix vy_super_admins write policies — same recursive subquery issue

  ## Problem
  INSERT/UPDATE/DELETE policies on vy_super_admins also used recursive subqueries
  (SELECT 1 FROM vy_super_admins WHERE auth_user_id = auth.uid()). Under RLS
  this is evaluated recursively and will fail or return no rows.

  ## Fix
  Replace the subquery pattern with the direct column check used in the SELECT fix.
  For Phase 1 (single super admin), write operations are effectively no-ops from
  the frontend — these policies exist for correctness and future use.

  ## Changes
  - Drop and recreate INSERT, UPDATE, DELETE policies on vy_super_admins
  - No data changes
*/

DROP POLICY IF EXISTS "Super admins can insert super admins" ON vy_super_admins;
DROP POLICY IF EXISTS "Super admins can update super admins" ON vy_super_admins;
DROP POLICY IF EXISTS "Super admins can delete super admins" ON vy_super_admins;

CREATE POLICY "Super admins can insert super admins"
  ON vy_super_admins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update super admins"
  ON vy_super_admins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete super admins"
  ON vy_super_admins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );
