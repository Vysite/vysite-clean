/*
  # Set email_verified: true on newly created test user identities

  The Admin API created users with email_confirm: true which sets
  email_confirmed_at on auth.users, but identity_data->email_verified
  was set to false. Update it to match native confirmed user structure.
*/

UPDATE auth.identities
SET identity_data = identity_data || '{"email_verified": true}'::jsonb
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@vysite.local'
)
AND (identity_data->>'email_verified') IS DISTINCT FROM 'true';
