/*
  # Phase 1 — Seed Initial Organisation and Link Admin User

  ## Summary
  Seeds the initial NEXA Solutions / VYSITE development organisation and links
  the existing admin user (tom.foreman@nexasolutions.co.uk) to it with the
  platform_admin role. Also backfills org_id and auth_user_id on the matching
  vy_platform_users row.

  ## Data Added

  ### organisations
  - name: NEXA Solutions
  - slug: nexa-solutions
  - id: fixed uuid for referential stability across dev/staging environments

  ### user_orgs
  - Links auth user 8316fe7a-b966-42e3-9b1a-129e9ad9107f to the org
  - role: platform_admin
  - status: active

  ### vy_platform_users (backfill)
  - Matches on email: tom.foreman@nexasolutions.co.uk
  - Sets auth_user_id → auth.users.id
  - Sets org_id → nexa-solutions organisation

  ## Notes
  - Uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe
  - Fixed org UUID (d0000000-0000-4000-a000-000000000001) is stable across
    environments — avoids needing to look up the org id in downstream migrations
  - No existing data is modified beyond the backfill columns on vy_platform_users
*/

-- Insert the initial organisation with a stable fixed UUID
INSERT INTO organisations (id, name, slug, created_at, updated_at)
VALUES (
  'd0000000-0000-4000-a000-000000000001',
  'NEXA Solutions',
  'nexa-solutions',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- Link the admin auth user to the organisation as platform_admin
INSERT INTO user_orgs (user_id, org_id, role, status, created_at)
VALUES (
  '8316fe7a-b966-42e3-9b1a-129e9ad9107f',
  'd0000000-0000-4000-a000-000000000001',
  'platform_admin',
  'active',
  now()
)
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Backfill vy_platform_users: link Tom Foreman's app profile to auth identity and org
UPDATE vy_platform_users
SET
  auth_user_id = '8316fe7a-b966-42e3-9b1a-129e9ad9107f',
  org_id       = 'd0000000-0000-4000-a000-000000000001'
WHERE email = 'tom.foreman@nexasolutions.co.uk'
  AND auth_user_id IS NULL;
