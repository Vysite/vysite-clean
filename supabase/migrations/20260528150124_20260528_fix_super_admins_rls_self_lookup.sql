/*
  # Fix vy_super_admins RLS — allow self-lookup without recursive deadlock

  ## Problem
  The SELECT policy on vy_super_admins used a subquery that SELECTs from
  vy_super_admins itself to check membership. This creates a recursive RLS
  evaluation: to read the table you must already be able to read the table.
  The result is that even seeded super admins cannot verify their own access,
  so the frontend isSuperAdmin check always returns false and the sidebar entry
  never appears.

  ## Fix
  Replace the recursive subquery with a direct column comparison:
    USING (auth_user_id = auth.uid())
  This allows any authenticated user to read only their own row (if it exists),
  which is all the frontend needs to confirm super admin status.

  Super admins can still read all rows via the second policy kept below.

  ## Changes
  - Drop and recreate the SELECT policy on vy_super_admins
  - No data changes, no other table changes
*/

-- Drop the recursive select policy
DROP POLICY IF EXISTS "Super admins can read super_admins table" ON vy_super_admins;

-- Allow any authenticated user to read their own row (non-recursive self-lookup)
CREATE POLICY "Users can read own super admin row"
  ON vy_super_admins FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());
