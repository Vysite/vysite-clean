/*
  # Seed test users for role/permission validation

  ## Summary
  Creates 8 test users — one per VYSITE role — to allow QA login and permission
  testing before launch. All test users:
  - Share the password: vysite  (bcrypt hash stored in auth.users only)
  - Have email_confirmed_at set so they can log in immediately
  - Are flagged via permissions->>'is_test_user' = 'true' for easy identification
    and bulk deletion from the Admin panel
  - Belong to the existing organisation (d0000000-0000-4000-a000-000000000001)
  - Use @vysite.local email domain — obviously non-production

  ## Test accounts
  | Email                           | VYSITE Role              | user_orgs role  |
  |---------------------------------|--------------------------|-----------------|
  | admin.test@vysite.local         | Admin                    | platform_admin  |
  | commercial.test@vysite.local    | Commercial Lead          | manager         |
  | pm.test@vysite.local            | Project Manager          | manager         |
  | site.test@vysite.local          | Site Manager             | user            |
  | engineer.test@vysite.local      | Engineer                 | user            |
  | qs.test@vysite.local            | Estimator / QS           | manager         |
  | client.test@vysite.local        | Client                   | viewer          |
  | external.test@vysite.local      | External / Subcontractor | viewer          |

  ## Password
  Plain text: vysite
  Stored as bcrypt hash only — never in plain text anywhere.

  ## Removal
  Use the Admin panel "Delete Test Users" button, or:
    DELETE FROM auth.users WHERE email LIKE '%@vysite.local';

  ## Notes
  - Do NOT promote these to production.
  - Re-running this migration is safe — it cleans up existing test users first.
*/

DO $$
DECLARE
  v_org_id uuid := 'd0000000-0000-4000-a000-000000000001';
  -- bcrypt hash of 'vysite' (cost 10)
  v_hash text := '$2a$10$X9H3oCMX7f.HV7GsRfOzauJgiFdJoH0sAWy0.AjqEtHPBMHg6YHqq';
  v_today date := current_date;

  u_admin  uuid := gen_random_uuid();
  u_comm   uuid := gen_random_uuid();
  u_pm     uuid := gen_random_uuid();
  u_site   uuid := gen_random_uuid();
  u_eng    uuid := gen_random_uuid();
  u_qs     uuid := gen_random_uuid();
  u_client uuid := gen_random_uuid();
  u_ext    uuid := gen_random_uuid();
BEGIN

  -- ── 1. Clean up any pre-existing test users ──────────────────────────────────
  DELETE FROM vy_platform_users WHERE email LIKE '%@vysite.local';
  DELETE FROM user_orgs
    WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@vysite.local');
  DELETE FROM auth.users WHERE email LIKE '%@vysite.local';

  -- ── 2. auth.users ────────────────────────────────────────────────────────────
  INSERT INTO auth.users
    (id, instance_id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at,
     raw_app_meta_data, raw_user_meta_data, is_super_admin)
  VALUES
    (u_admin,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin.test@vysite.local',      v_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"is_test_user":true}', false),
    (u_comm,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'commercial.test@vysite.local', v_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"is_test_user":true}', false),
    (u_pm,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'pm.test@vysite.local',         v_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"is_test_user":true}', false),
    (u_site,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'site.test@vysite.local',       v_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"is_test_user":true}', false),
    (u_eng,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'engineer.test@vysite.local',   v_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"is_test_user":true}', false),
    (u_qs,     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'qs.test@vysite.local',         v_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"is_test_user":true}', false),
    (u_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'client.test@vysite.local',     v_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"is_test_user":true}', false),
    (u_ext,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'external.test@vysite.local',   v_hash, now(), now(), now(),
     '{"provider":"email","providers":["email"]}', '{"is_test_user":true}', false);

  -- ── 3. user_orgs memberships (valid roles: platform_admin, company_owner, manager, user, viewer) ──
  INSERT INTO user_orgs (id, user_id, org_id, role, status, created_at)
  VALUES
    (gen_random_uuid(), u_admin,  v_org_id, 'platform_admin', 'active', now()),
    (gen_random_uuid(), u_comm,   v_org_id, 'manager',        'active', now()),
    (gen_random_uuid(), u_pm,     v_org_id, 'manager',        'active', now()),
    (gen_random_uuid(), u_site,   v_org_id, 'user',           'active', now()),
    (gen_random_uuid(), u_eng,    v_org_id, 'user',           'active', now()),
    (gen_random_uuid(), u_qs,     v_org_id, 'manager',        'active', now()),
    (gen_random_uuid(), u_client, v_org_id, 'viewer',         'active', now()),
    (gen_random_uuid(), u_ext,    v_org_id, 'viewer',         'active', now());

  -- ── 4. vy_platform_users rows ────────────────────────────────────────────────
  -- Password NOT stored here. is_test_user in permissions marks them for the UI.
  INSERT INTO vy_platform_users
    (id, name, email, role, company, status, avatar_initials, join_date,
     assigned_project_ids, auth_user_id, org_id, permissions)
  VALUES
    ('test-pu-admin',  'Admin Test',      'admin.test@vysite.local',
     'Admin',                    'VYSITE Test', 'Active', 'AT', v_today,
     '{}', u_admin,  v_org_id, '{"is_test_user":true}'),
    ('test-pu-comm',   'Commercial Test', 'commercial.test@vysite.local',
     'Commercial Lead',          'VYSITE Test', 'Active', 'CT', v_today,
     '{}', u_comm,   v_org_id, '{"is_test_user":true}'),
    ('test-pu-pm',     'PM Test',         'pm.test@vysite.local',
     'Project Manager',          'VYSITE Test', 'Active', 'PT', v_today,
     '{}', u_pm,     v_org_id, '{"is_test_user":true}'),
    ('test-pu-site',   'Site Test',       'site.test@vysite.local',
     'Site Manager',             'VYSITE Test', 'Active', 'ST', v_today,
     '{}', u_site,   v_org_id, '{"is_test_user":true}'),
    ('test-pu-eng',    'Engineer Test',   'engineer.test@vysite.local',
     'Engineer',                 'VYSITE Test', 'Active', 'ET', v_today,
     '{}', u_eng,    v_org_id, '{"is_test_user":true}'),
    ('test-pu-qs',     'QS Test',         'qs.test@vysite.local',
     'Estimator / QS',           'VYSITE Test', 'Active', 'QT', v_today,
     '{}', u_qs,     v_org_id, '{"is_test_user":true}'),
    ('test-pu-client', 'Client Test',     'client.test@vysite.local',
     'Client',                   'VYSITE Test', 'Active', 'KT', v_today,
     '{}', u_client, v_org_id, '{"is_test_user":true}'),
    ('test-pu-ext',    'External Test',   'external.test@vysite.local',
     'External / Subcontractor', 'VYSITE Test', 'Active', 'XT', v_today,
     '{}', u_ext,    v_org_id, '{"is_test_user":true}');

END $$;
