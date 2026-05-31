/*
  # Fix test user auth.identities — add missing identity rows

  ## Problem
  The previous migration inserted rows into auth.users directly but omitted
  the required matching row in auth.identities for each user.
  Supabase's email/password sign-in requires an auth.identities row with:
    - provider = 'email'
    - provider_id = the user's email address
    - identity_data = {"sub": "<user_id>", "email": "<email>"}
  Without this, login fails with "Database error querying schema".

  ## Fix
  Insert the missing auth.identities row for each of the 8 test users.
  The real admin account is NOT touched.

  ## Safety
  Uses conditional INSERT so re-running is safe.
  The `email` column in auth.identities is a generated column and is omitted.
*/

INSERT INTO auth.identities
  (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.email,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email LIKE '%@vysite.local'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
  );
