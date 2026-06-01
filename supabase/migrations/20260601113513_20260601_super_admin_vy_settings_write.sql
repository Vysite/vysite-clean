/*
  # Super Admin write access to vy_settings

  ## Summary
  Grants Super Admins the ability to read and write vy_settings for any organisation.
  This is required so that Super Admins can manage Company Profile data (name, logo,
  address, contact details, registration and VAT numbers) on behalf of any organisation
  from the Super Admin Organisations panel.

  ## Changes
  - Adds SELECT policy: super admins can read any org's vy_settings row
  - Adds INSERT policy: super admins can insert any org's vy_settings row
  - Adds UPDATE policy: super admins can update any org's vy_settings row

  ## Security
  - Uses the existing SECURITY DEFINER function is_super_admin() to avoid recursion
  - Does not alter existing org-member or org-admin policies
*/

-- Read: super admins can see any org's settings
CREATE POLICY "Super admins can read any org settings"
  ON vy_settings FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Insert: super admins can create settings rows for any org
CREATE POLICY "Super admins can insert any org settings"
  ON vy_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- Update: super admins can update any org's settings
CREATE POLICY "Super admins can update any org settings"
  ON vy_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
