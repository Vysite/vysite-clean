-- ============================================================
-- DEMO DATA — Part 4: Commercial Records, Line Items, Applications
-- ============================================================

DO $$
DECLARE
  v_crv001 uuid := '11000001-0000-4000-a000-000000000001';
  v_crv002 uuid := '11000002-0000-4000-a000-000000000001';
  v_crv003 uuid := '11000003-0000-4000-a000-000000000001';
  v_crv004 uuid := '11000004-0000-4000-a000-000000000001';
  v_cre001 uuid := '11000005-0000-4000-a000-000000000001';
  v_cre002 uuid := '11000006-0000-4000-a000-000000000001';
  v_crd001 uuid := '11000007-0000-4000-a000-000000000001';
  v_crv005 uuid := '11000008-0000-4000-a000-000000000001';
  v_crv006 uuid := '11000009-0000-4000-a000-000000000001';
  v_crv007 uuid := '11000010-0000-4000-a000-000000000001';
  v_cre003 uuid := '11000011-0000-4000-a000-000000000001';
BEGIN

INSERT INTO vy_commercial_records (id, org_id, project_id, record_type, reference, title, client, status, date_raised, date_submitted, date_agreed, notes, created_by, extra_data) VALUES
  (v_crv001, 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Variation Order', 'VO-001', 'Additional chilled water pipework — pharmacy cold room', 'Brindley Construction Group', 'Agreed', '2026-02-14', '2026-02-19', '2026-03-02', 'Client requested extension of CHW circuit to new pharmacy cold room on Level 1. Agreed at full value.', null, '{"agreed_value": 12450}'::jsonb),
  (v_crv002, 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Variation Order', 'VO-002', 'Relocation of LTHW distribution header — plant room', 'Brindley Construction Group', 'Agreed', '2026-03-08', '2026-03-12', '2026-03-28', 'Header position clashed with structural beam discovered during strip-out. Redesign and relocation agreed.', null, '{"agreed_value": 8900}'::jsonb),
  (v_crv003, 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Variation Order', 'VO-003', 'Supply and install new pressurisation unit — boiler room', 'Brindley Construction Group', 'Submitted', '2026-04-22', '2026-04-25', null, 'Existing pressurisation unit found to be beyond economic repair on inspection. Replacement instructed by client rep.', null, '{"submitted_value": 4200}'::jsonb),
  (v_crv004, 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Variation Order', 'VO-004', 'Additional ductwork — Level 3 recovery area expansion', 'Brindley Construction Group', 'Draft', '2026-06-02', null, null, 'Recovery area being extended by 3 bays. Quote being prepared.', null, '{"draft_value": 9200}'::jsonb),
  (v_cre001, 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Early Warning Notice', 'EWN-001', 'Delayed access to Level 2 — infection control restrictions', 'Brindley Construction Group', 'Open', '2026-03-17', '2026-03-17', null, 'ICT have imposed additional access restrictions on Level 2 surgical corridor. Access window reduced to 06:00-08:00. This will extend programme by an estimated 3 weeks and increase preliminaries.', null, '{"potential_impact": "Programme delay 3 weeks"}'::jsonb),
  (v_cre002, 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Early Warning Notice', 'EWN-002', 'Extended lead time — specialist ventilation unit', 'Brindley Construction Group', 'Resolved', '2026-04-03', '2026-04-03', '2026-04-14', 'AHU manufacturer advised 14-week lead time instead of 8 weeks. Alternative supplier sourced at agreed price. Resolved without programme impact.', null, '{"potential_impact": "None — alternative supplier confirmed"}'::jsonb),
  (v_crd001, 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Delay Notice', 'DN-001', 'Programme delay due to late structural information — boiler room', 'Brindley Construction Group', 'Submitted', '2026-05-09', '2026-05-12', null, 'Structural drawings for boiler room penetrations not issued until 6 weeks after agreed RFI response date. M&E works delayed by 4 weeks.', null, '{"weeks_claimed": 4}'::jsonb),
  (v_crv005, 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Variation Order', 'VO-001', 'Additional containment — server room fit-out', 'Alderton Developments Ltd', 'Agreed', '2025-11-04', '2025-11-07', '2025-11-18', 'Additional cable tray and trunking required for IT/AV fit-out in server room Block C.', null, '{"agreed_value": 18600}'::jsonb),
  (v_crv006, 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Variation Order', 'VO-002', 'Upgraded LED lighting specification — common areas', 'Alderton Developments Ltd', 'Agreed', '2025-12-10', '2025-12-12', '2026-01-06', 'Client upgraded specified luminaire range to Zumtobel TECTON throughout atrium and corridors. Uplift agreed.', null, '{"agreed_value": 31400}'::jsonb),
  (v_crv007, 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Variation Order', 'VO-003', 'Mechanical VRF system — tenant request, units 14-18', 'Alderton Developments Ltd', 'Submitted', '2026-02-17', '2026-02-20', null, 'Tenant pre-let for units 14-18 requires VRF cooling in lieu of fan coils.', null, '{"submitted_value": 37600}'::jsonb),
  (v_cre003, 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Early Warning Notice', 'EWN-001', 'Ground conditions — unexpected below-slab service runs', 'Alderton Developments Ltd', 'Resolved', '2025-10-14', '2025-10-14', '2025-10-22', 'Undocumented drainage runs discovered during below-slab service installation at Block A. Agreed diversion route.', null, '{"potential_impact": "None — agreed diversion"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vy_commercial_line_items (id, org_id, record_id, sort_order, description, client_description, unit, quantity, internal_rate, client_rate, markup_pct, line_type) VALUES
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv001, 1, 'CHW pipework 22mm copper — supply and fix', 'Chilled water pipework extension to pharmacy cold room', 'lm', 38, 145.00, 195.00, 34.5, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv001, 2, 'Fan coil unit connection set', 'FCU connection set — labour and materials', 'nr', 2, 680.00, 890.00, 30.9, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv001, 3, 'Pipe insulation 22mm Armaflex', 'Pipework insulation to CHW circuit', 'lm', 38, 28.00, 40.00, 42.9, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv001, 4, 'Pressure testing and commissioning', 'System pressure test, balance and handover', 'sum', 1, 620.00, 850.00, 37.1, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv002, 1, 'Dismantle and remove existing header', 'Strip out existing LTHW header and associated connections', 'sum', 1, 950.00, 1200.00, 26.3, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv002, 2, 'Supply and install new header assembly 150mm BSP', 'New LTHW distribution header, flanged connections', 'nr', 1, 3400.00, 4400.00, 29.4, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv002, 3, 'Pipework reconnections and pressure test', 'Reconnect all existing branch circuits, pressure test and commission', 'sum', 1, 2100.00, 2800.00, 33.3, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv002, 4, 'Builders work and making good', 'Patch and make good wall penetrations', 'sum', 1, 380.00, 500.00, 31.6, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv005, 1, 'Steel cable tray 100x50mm — supply and fix', 'Cable tray for server room containment', 'lm', 65, 62.00, 88.00, 41.9, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv005, 2, 'Steel cable trunking 75x50mm — supply and fix', 'Perimeter trunking for server room', 'lm', 42, 48.00, 68.00, 41.7, 'item'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_crv005, 3, 'Earth bonding and containment accessories', 'Earth straps, brackets, support steelwork', 'sum', 1, 1200.00, 1650.00, 37.5, 'item');

END $$;

-- Applications — paid_value 0 for unpaid (not null)
INSERT INTO vy_commercial_applications (id, org_id, project_id, app_number, period, app_date, payment_due, payment_recd, applied_value, certified_value, paid_value, retention, status, notes, created_by) VALUES
  ('app-hmc-01', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 1, 'February 2026', '2026-02-28', '2026-03-28', '2026-04-02', 52354,  52354,  52354,  2618,  'Paid',      'Month 1 — Mobilisation, strip-out and below-slab drainage', 'pu-1779621355828'),
  ('app-hmc-02', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 2, 'March 2026',    '2026-03-31', '2026-04-30', '2026-05-05', 104708, 98000,  98000,  4900,  'Paid',      'Month 2 — Plant room steel, boiler connections, Level 1 pipework first fix', 'pu-1779621355828'),
  ('app-hmc-03', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 3, 'April 2026',    '2026-04-30', '2026-05-30', '2026-06-04', 157062, 149000, 149000, 7450,  'Paid',      'Month 3 — Level 2 and 3 pipework, ductwork first fix, electrical containment', 'pu-1779621355828'),
  ('app-hmc-04', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 4, 'May 2026',      '2026-05-31', '2026-06-30', '2026-07-03', 209416, 200000, 200000, 10000, 'Paid',      'Month 4 — AHU installation, Level 3 second fix begin, FCU connections', 'pu-1779621355828'),
  ('app-hmc-05', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 5, 'June 2026',     '2026-06-30', '2026-07-31', null,         281500, 268000, 0,      13400, 'Certified', 'Month 5 — BMS installation, Level 1-2 second fix complete, commissioning commenced', 'pu-1779621355828'),
  ('app-kbp-01', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 1, 'October 2025',  '2025-10-31', '2025-11-30', '2025-12-04', 118432,  118432,  118432,  5922,  'Paid', 'Month 1 — Groundworks, below-slab services, containment Block A', 'pu-1779621355828'),
  ('app-kbp-02', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 2, 'November 2025', '2025-11-30', '2025-12-31', '2026-01-07', 236864,  228000,  228000,  11400, 'Paid', 'Month 2 — Electrical first fix Blocks A and B, mechanical first fix Block A', 'pu-1779621355828'),
  ('app-kbp-03', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 3, 'December 2025', '2025-12-31', '2026-01-31', '2026-02-04', 355296,  340000,  340000,  17000, 'Paid', 'Month 3 — All-blocks first fix complete, AHU installations Blocks A-C', 'pu-1779621355828'),
  ('app-kbp-04', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 4, 'January 2026',  '2026-01-31', '2026-02-28', '2026-03-05', 473728,  455000,  455000,  22750, 'Paid', 'Month 4 — Second fix commence all blocks, BMS panels installed', 'pu-1779621355828'),
  ('app-kbp-05', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 5, 'February 2026', '2026-02-28', '2026-03-31', '2026-04-03', 592160,  575000,  575000,  28750, 'Paid', 'Month 5 — Second fix 85% complete, commissioning strategy agreed', 'pu-1779621355828'),
  ('app-kbp-06', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 6, 'March 2026',    '2026-03-31', '2026-04-30', '2026-05-02', 710592,  695000,  695000,  34750, 'Paid', 'Month 6 — Commissioning in progress, O&M documentation commenced', 'pu-1779621355828'),
  ('app-kbp-07', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 7, 'April 2026',    '2026-04-30', '2026-05-31', '2026-06-04', 829024,  810000,  810000,  40500, 'Paid', 'Month 7 — Commissioning complete Blocks A and B, snagging underway', 'pu-1779621355828'),
  ('app-kbp-08', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 8, 'May 2026',      '2026-05-31', '2026-06-30', '2026-07-03', 947456,  925000,  925000,  46250, 'Paid', 'Month 8 — Snagging 90% closed, witnessing and handover packs in progress', 'pu-1779621355828'),
  ('app-kbp-09', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 9, 'June 2026',     '2026-06-30', '2026-07-31', null,         1065888, 1040000, 0,       52000, 'Certified', 'Month 9 — Substantial completion achieved Block A and C. Block B outstanding items.', 'pu-1779621355828')
ON CONFLICT (id) DO NOTHING;
