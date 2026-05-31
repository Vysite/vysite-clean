/*
  # Fix infinite recursion in vy_super_admins RLS policies

  ## Problem
  All four RLS policies on vy_super_admins used a self-referential EXISTS sub-select:
    EXISTS (SELECT 1 FROM vy_super_admins sa WHERE sa.auth_user_id = auth.uid())

  When PostgreSQL evaluates a SELECT policy on a table, it must evaluate all
  policies for that table. A self-referential EXISTS causes PostgreSQL to
  re-enter the policy check for the same table, producing:
    "infinite recursion detected in policy for relation 'vy_super_admins'"

  This also broke the organisations table because its "Super admins can read all
  organisations" SELECT policy referenced vy_super_admins, which then recursed.

  ## Fix
  Drop all four broken policies and replace them with equivalent policies that
  call public.is_super_admin() — a SECURITY DEFINER function that queries the
  table as the postgres role (bypassing RLS), breaking the recursion safely.

  The is_super_admin() function already exists from migration
  20260530_add_is_super_admin_function.
*/

-- Drop all four recursive policies
DROP POLICY IF EXISTS "Super admins can read all super admin rows" ON vy_super_admins;
DROP POLICY IF EXISTS "Super admins can insert super admins" ON vy_super_admins;
DROP POLICY IF EXISTS "Super admins can update super admins" ON vy_super_admins;
DROP POLICY IF EXISTS "Super admins can delete super admins" ON vy_super_admins;

-- Re-create using is_super_admin() which is SECURITY DEFINER and does not recurse
CREATE POLICY "Super admins can read all super admin rows"
  ON vy_super_admins FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins can insert super admins"
  ON vy_super_admins FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update super admins"
  ON vy_super_admins FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete super admins"
  ON vy_super_admins FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- Also fix the organisations SELECT policy that references vy_super_admins directly
DROP POLICY IF EXISTS "Super admins can read all organisations" ON organisations;

CREATE POLICY "Super admins can read all organisations"
  ON organisations FOR SELECT
  TO authenticated
  USING (public.is_super_admin());
