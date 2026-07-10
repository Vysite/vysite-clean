-- ============================================================
-- DEMO DATA ENRICHMENT — Part 1: Projects & Supplier Trades
-- Org: NEXA Solutions (d0000000-0000-4000-a000-000000000001)
-- All names, clients, and locations are entirely fictional.
-- ============================================================

DO $$ BEGIN

-- ── Update existing project to be richer ────────────────────
UPDATE vy_projects SET
  name              = 'Hartfield Medical Centre — M&E Refurbishment',
  client            = 'Brindley Construction Group',
  location          = 'Hartfield, East Sussex',
  project_manager   = 'Tom Foreman',
  status            = 'Active',
  start_date        = '2026-01-13',
  completion_date   = '2026-10-31',
  progress          = 62,
  value             = '£523,544',
  committed         = 523544,
  variations_value  = 34750,
  open_actions      = 4,
  open_snags        = 7
WHERE id = 'p1780569420807';

-- ── Add two further demo projects ────────────────────────────
INSERT INTO vy_projects (id, org_id, name, client, location, project_manager, status, start_date, completion_date, progress, value, committed, variations_value, open_actions, open_snags, created_at)
VALUES
  ('p-demo-00000000002', 'd0000000-0000-4000-a000-000000000001',
   'Kelston Business Park — New Build M&E',
   'Alderton Developments Ltd',
   'Kelston, Bristol',
   'Oliver Troman',
   'Active',
   '2025-09-08', '2026-08-29',
   78, '£1,184,320', 1184320, 87600,
   6, 3,
   now() - interval '10 months'),

  ('p-demo-00000000003', 'd0000000-0000-4000-a000-000000000001',
   'Moorside Primary School — Heating & Ventilation Upgrade',
   'Westmarch County Council',
   'Moorside, Lancashire',
   'Tom Foreman',
   'Active',
   '2026-03-03', '2026-09-12',
   41, '£298,750', 298750, 12400,
   2, 11,
   now() - interval '4 months')
ON CONFLICT (id) DO NOTHING;

END $$;

-- ── Supplier trades ───────────────────────────────────────────
INSERT INTO vy_supplier_trades (id, org_id, name, is_active, sort_order, created_at)
VALUES
  ('trade-mech-001',   'd0000000-0000-4000-a000-000000000001', 'Mechanical & Plumbing',         true, 1,  now()),
  ('trade-elec-001',   'd0000000-0000-4000-a000-000000000001', 'Electrical',                     true, 2,  now()),
  ('trade-hvac-001',   'd0000000-0000-4000-a000-000000000001', 'HVAC & Ventilation',             true, 3,  now()),
  ('trade-ins-001',    'd0000000-0000-4000-a000-000000000001', 'Insulation & Lagging',           true, 4,  now()),
  ('trade-ctrl-001',   'd0000000-0000-4000-a000-000000000001', 'Controls & BMS',                 true, 5,  now()),
  ('trade-fire-001',   'd0000000-0000-4000-a000-000000000001', 'Fire Protection',                true, 6,  now()),
  ('trade-civ-001',    'd0000000-0000-4000-a000-000000000001', 'Civil & Groundworks',            true, 7,  now()),
  ('trade-gas-001',    'd0000000-0000-4000-a000-000000000001', 'Gas & Heating',                  true, 8,  now()),
  ('trade-test-001',   'd0000000-0000-4000-a000-000000000001', 'Testing & Commissioning',        true, 9,  now()),
  ('trade-lift-001',   'd0000000-0000-4000-a000-000000000001', 'Lifts & Escalators',             true, 10, now())
ON CONFLICT (id) DO NOTHING;

-- ── Labour rate types ─────────────────────────────────────────
INSERT INTO vy_supplier_labour_rate_types (id, org_id, name, is_default, is_active, sort_order, created_at)
VALUES
  ('lrt-app-001',  'd0000000-0000-4000-a000-000000000001', 'Apprentice',        true,  true, 1, now()),
  ('lrt-lab-001',  'd0000000-0000-4000-a000-000000000001', 'Labourer',          true,  true, 2, now()),
  ('lrt-imp-001',  'd0000000-0000-4000-a000-000000000001', 'Improver',          true,  true, 3, now()),
  ('lrt-skl-001',  'd0000000-0000-4000-a000-000000000001', 'Skilled Operative', true,  true, 4, now()),
  ('lrt-trd-001',  'd0000000-0000-4000-a000-000000000001', 'Trade',             true,  true, 5, now()),
  ('lrt-sup-001',  'd0000000-0000-4000-a000-000000000001', 'Supervisor',        true,  true, 6, now()),
  ('lrt-pm-001',   'd0000000-0000-4000-a000-000000000001', 'Project Manager',   false, true, 7, now())
ON CONFLICT (id) DO NOTHING;
