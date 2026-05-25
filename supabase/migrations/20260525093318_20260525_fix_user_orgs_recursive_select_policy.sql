/*
  # Fix infinite recursion in user_orgs SELECT policy

  ## Problem
  The "Platform admins can read all memberships in their orgs" SELECT policy
  contained a self-referential subquery — it queried user_orgs FROM WITHIN a
  user_orgs SELECT policy. Postgres detected infinite recursion and threw an
  error. Supabase-js silently returned data: null, causing resolveOrg() to set
  currentOrgId = null for every authenticated user.

  ## Fix
  1. Drop the recursive admin SELECT policy.
  2. Create a SECURITY DEFINER function is_org_platform_admin(uuid, uuid) that
     runs as the DB owner (bypasses RLS) to check admin membership without
     recursing into the policy.
  3. Recreate the admin SELECT policy using that function.

  The "Users can read own org memberships" policy (user_id = auth.uid()) is
  correct and untouched — this is what resolveOrg() relies on.
*/

-- Step 1: Drop the recursive policy
DROP POLICY IF EXISTS "Platform admins can read all memberships in their orgs" ON user_orgs;
DROP POLICY IF EXISTS "Platform admins can insert memberships" ON user_orgs;
DROP POLICY IF EXISTS "Platform admins can update memberships" ON user_orgs;
DROP POLICY IF EXISTS "Platform admins can delete memberships" ON user_orgs;

-- Step 2: Create a SECURITY DEFINER function that checks admin status
-- without triggering RLS on user_orgs
CREATE OR REPLACE FUNCTION is_platform_admin_of_org(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_orgs
    WHERE user_id = p_user_id
      AND org_id  = p_org_id
      AND role    = 'platform_admin'
      AND status  = 'active'
  );
$$;

-- Step 3: Recreate all four admin policies using the non-recursive function
CREATE POLICY "Platform admins can read all memberships in their orgs"
  ON user_orgs FOR SELECT
  TO authenticated
  USING (is_platform_admin_of_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can insert memberships"
  ON user_orgs FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin_of_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can update memberships"
  ON user_orgs FOR UPDATE
  TO authenticated
  USING (is_platform_admin_of_org(auth.uid(), org_id))
  WITH CHECK (is_platform_admin_of_org(auth.uid(), org_id));

CREATE POLICY "Platform admins can delete memberships"
  ON user_orgs FOR DELETE
  TO authenticated
  USING (is_platform_admin_of_org(auth.uid(), org_id));
