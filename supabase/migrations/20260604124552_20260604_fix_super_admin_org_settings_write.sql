/*
  # Allow Super Admins to write org_settings

  ## Problem
  The org_settings INSERT and UPDATE policies only permit users with
  role = 'platform_admin' in user_orgs. Super Admins are identified via the
  vy_super_admins table (checked via the is_super_admin() SECURITY DEFINER
  function), not via user_orgs role. This means:

  - Super Admins CAN read org_settings (SELECT policy added in a prior migration)
  - Super Admins CANNOT save changes to org_settings — the upsert in the
    ManagePanel of SuperAdmin.tsx fails silently or returns a permission error

  ## Fix
  Add INSERT and UPDATE policies for super admins on org_settings, using the
  established is_super_admin() pattern (consistent with vy_super_admins,
  organisations, and all other super-admin-writable tables).

  ## Changes
  - New policy: "Super admins can insert org settings"
  - New policy: "Super admins can update org settings"
  - No existing policies removed or modified
  - No data changes
*/

CREATE POLICY "Super admins can insert org settings"
  ON org_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update org settings"
  ON org_settings FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
