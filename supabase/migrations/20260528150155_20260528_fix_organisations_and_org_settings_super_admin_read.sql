/*
  # Allow super admins to read all organisations and org_settings

  ## Problem
  The Super Admin page queries all rows from `organisations` and `org_settings`.
  The existing SELECT policies on both tables only allow users to read rows for
  orgs they are members of (via user_orgs). A super admin who is not a member of
  every org will get empty results.

  ## Fix
  Add additional SELECT policies on both tables that allow authenticated users
  who have a row in vy_super_admins to read all rows.

  ## Changes
  - Add "Super admins can read all organisations" policy on organisations
  - Add "Super admins can read all org_settings" policy on org_settings
  - No existing policies are removed
  - No data changes
*/

-- Super admins can read all organisations
CREATE POLICY "Super admins can read all organisations"
  ON organisations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );

-- Super admins can read all org_settings
CREATE POLICY "Super admins can read all org settings"
  ON org_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );
