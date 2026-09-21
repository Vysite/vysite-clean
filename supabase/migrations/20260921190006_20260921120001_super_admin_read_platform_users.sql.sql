/*
# Add Super Admin SELECT policy to vy_platform_users

## Purpose
Super Admins managing organisations from the /adminpanel company management screen
need to read platform-user rows across all organisations to display the Primary Admin
(name + email) for each company. Currently, vy_platform_users only has an org-member
SELECT policy, so a Super Admin (who is not a member of the org they are managing)
gets zero rows from RLS and the Primary Admin panel shows "No active admin user found."

## Changes
1. Adds a single SELECT-only RLS policy to vy_platform_users.
2. Uses the existing trusted helper function is_super_admin() — the same function used
   by the organisations table's Super Admin read policy.
3. No INSERT, UPDATE, or DELETE policy is added. Super Admins gain read access only.

## Security
- This is strictly additive. The existing "Org members can read own org platform users"
  policy is NOT modified or dropped.
- Normal organisation users are unaffected: they still only see users in their own org
  via the existing is_org_member() policy.
- Super Admins can now SELECT all platform-user rows, consistent with their existing
  read access to organisations, org_settings, and ai_usage_log.
- No write permissions are granted or changed.
- No user data is modified.
- No auth, Stripe, trial provisioning, or CRM changes.

## Verification
- After applying, a Super Admin session querying vy_platform_users for Core Refurb
  Group Ltd (org_id = 24325078-97d8-46d9-a83f-e3af85b77222) with role='Admin' and
  status='Active' should return Paul Shave / paul@corerefurbgroup.com.
- Non-Super-Admin users continue to see only their own org's users.
*/

DROP POLICY IF EXISTS "Super admins can read all platform users" ON vy_platform_users;

CREATE POLICY "Super admins can read all platform users"
  ON vy_platform_users
  FOR SELECT
  TO authenticated
  USING (is_super_admin());
