/*
  # Fix test user auth fields to match native Supabase user structure

  ## Problem
  Comparison of a working native auth user vs test users revealed two differences
  that prevent login:

  1. confirmation_token and recovery_token are NULL on test users — native users
     have empty string ''. GoTrue requires empty string, not NULL, for these fields.

  2. identity_data is missing the email_verified field that GoTrue sets on native
     email/password users.

  ## Fix
  - Set confirmation_token = '' and recovery_token = '' on all test users
  - Update identity_data to include email_verified: true
  - Real admin account is NOT touched (WHERE clause scoped to @vysite.local only)
*/

-- Fix NULL token fields on auth.users
UPDATE auth.users
SET
  confirmation_token = '',
  recovery_token     = ''
WHERE email LIKE '%@vysite.local'
  AND (confirmation_token IS NULL OR recovery_token IS NULL);

-- Fix identity_data to include email_verified
UPDATE auth.identities
SET identity_data = identity_data || '{"email_verified": true}'::jsonb
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@vysite.local'
)
AND NOT (identity_data ? 'email_verified');
