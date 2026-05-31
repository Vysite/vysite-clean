/*
  # Wipe all broken manually-inserted test auth users

  ## Reason
  The test users created via direct auth.users SQL inserts are broken and cannot
  log in regardless of patching. The Admin API (supabase.auth.admin.createUser)
  is the only supported method that produces fully valid auth records.

  ## What this does
  Deletes all @vysite.local rows from:
    - auth.identities (cascades or deleted explicitly)
    - auth.users

  Also cleans vy_platform_users and user_orgs so they can be re-seeded
  with the correct auth_user_id values after the Admin API creates the users.

  ## Safety
  Scoped strictly to email LIKE '%@vysite.local'.
  The real admin account (tom.foreman@nexasolutions.co.uk) is NOT touched.
*/

-- Clean application rows first (referencing auth user ids)
DELETE FROM vy_platform_users WHERE email LIKE '%@vysite.local';

DELETE FROM user_orgs
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@vysite.local'
);

-- Remove identities before users
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@vysite.local'
);

-- Finally remove the broken auth users
DELETE FROM auth.users WHERE email LIKE '%@vysite.local';
