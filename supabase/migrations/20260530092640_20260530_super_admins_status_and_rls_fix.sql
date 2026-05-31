/*
  # Super Admin table: status column + secure RLS policies

  ## Summary
  Two changes to harden the vy_super_admins table for the platform admin panel:

  1. New Columns
     - `status` (text, NOT NULL, DEFAULT 'active') on `vy_super_admins`
       Values: 'active' | 'disabled'
       Existing rows are set to 'active'.

  2. RLS Policy Changes
     - DROP the narrow "Users can read own super admin row" SELECT policy which
       prevented the management UI from listing all super admins.
     - ADD a broader SELECT policy: any authenticated super admin can read ALL
       rows in vy_super_admins (needed to list/manage them in the UI).
     - All INSERT/UPDATE/DELETE policies are unchanged — only existing super
       admins can mutate the table.

  ## Security
  - A customer user with no row in vy_super_admins can still read nothing
    (the WHERE EXISTS sub-select returns false → zero rows returned).
  - Only an existing, active-or-disabled super admin can see the full list.
  - Invite flow (adding a new row) is handled server-side via an Edge Function
    using the service role key — no client can self-insert.
*/

-- 1. Add status column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vy_super_admins' AND column_name = 'status'
  ) THEN
    ALTER TABLE vy_super_admins ADD COLUMN status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- 2. Drop the narrow "own row only" SELECT policy
DROP POLICY IF EXISTS "Users can read own super admin row" ON vy_super_admins;

-- 3. Replace with a policy that lets super admins read ALL rows
DROP POLICY IF EXISTS "Super admins can read all super admin rows" ON vy_super_admins;
CREATE POLICY "Super admins can read all super admin rows"
  ON vy_super_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vy_super_admins sa
      WHERE sa.auth_user_id = auth.uid()
    )
  );
