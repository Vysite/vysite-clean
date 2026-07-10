-- ─── Demo Data: Valuation Workbooks & Valuations ──────────────────────────────
-- Org: NEXA Solutions (d0000000-0000-4000-a000-000000000001)

DO $$
DECLARE
  v_org  uuid := 'd0000000-0000-4000-a000-000000000001';
  v_wb_hf uuid;
  v_wb_kb uuid;
  v_val1  uuid;
  v_val2  uuid;
  v_val3  uuid;
  v_val4  uuid;
  v_val5  uuid;
BEGIN

  v_wb_hf := 'fb000001-0000-4000-a000-000000000001'::uuid;
  v_wb_kb := 'fb000002-0000-4000-a000-000000000001'::uuid;
  v_val1  := 'ca000001-0000-4000-a000-000000000001'::uuid;
  v_val2  := 'ca000002-0000-4000-a000-000000000001'::uuid;
  v_val3  := 'ca000003-0000-4000-a000-000000000001'::uuid;
  v_val4  := 'ca000004-0000-4000-a000-000000000001'::uuid;
  v_val5  := 'ca000005-0000-4000-a000-000000000001'::uuid;

-- ── Workbooks ────────────────────────────────────────────────────────────────

INSERT INTO vy_valuation_workbooks (id, org_id, project_id, title, retention_pct, mcd_pct)
VALUES
  (v_wb_hf, v_org, 'p1780569420807',    'Hartfield MC — Contract Workbook',  3.0, 1.5),
  (v_wb_kb, v_org, 'p-demo-00000000002','Kelston BP — Contract Workbook',    3.0, 2.0)
ON CONFLICT (id) DO NOTHING;

-- ── Workbook Lines — Hartfield MC ────────────────────────────────────────────

INSERT INTO vy_workbook_lines (id, org_id, workbook_id, item_number, description, section, unit, quantity, rate, contract_value, sort_order)
VALUES
  (gen_random_uuid(), v_org, v_wb_hf, '1.1', 'LTHW Pipework, Fittings & Valves',            'Mechanical', 'Item', 1, 45000, 45000, 10),
  (gen_random_uuid(), v_org, v_wb_hf, '1.2', 'AHU Supply & Extract Ductwork System',         'Mechanical', 'Item', 1, 32500, 32500, 20),
  (gen_random_uuid(), v_org, v_wb_hf, '1.3', 'Fan Coil Units & Associated Controls',         'Mechanical', 'Nr',  18,  1597, 28746, 30),
  (gen_random_uuid(), v_org, v_wb_hf, '1.4', 'Pump Sets, HIU & Plant Equipment',             'Mechanical', 'Item', 1, 18200, 18200, 40),
  (gen_random_uuid(), v_org, v_wb_hf, '1.5', 'Thermal Insulation to Pipework & Ductwork',   'Mechanical', 'Item', 1, 12400, 12400, 50),
  (gen_random_uuid(), v_org, v_wb_hf, '2.1', 'LV Distribution & Distribution Board Works',   'Electrical', 'Item', 1, 38600, 38600, 60),
  (gen_random_uuid(), v_org, v_wb_hf, '2.2', 'Power, Lighting & General Small Power',        'Electrical', 'Item', 1, 22300, 22300, 70),
  (gen_random_uuid(), v_org, v_wb_hf, '2.3', 'Emergency Lighting & Fire Alarm Modifications','Electrical', 'Item', 1, 14800, 14800, 80),
  (gen_random_uuid(), v_org, v_wb_hf, '2.4', 'BMS Controls, Sensors & Integration',          'Electrical', 'Item', 1, 31500, 31500, 90),
  (gen_random_uuid(), v_org, v_wb_hf, '3.1', 'Hydraulic Pressure Testing',                   'Commissioning & Testing', 'Item', 1, 4200, 4200, 100),
  (gen_random_uuid(), v_org, v_wb_hf, '3.2', 'Flushing, Cleaning & Chemical Dosing',         'Commissioning & Testing', 'Item', 1, 6800, 6800, 110),
  (gen_random_uuid(), v_org, v_wb_hf, '3.3', 'Commissioning, Balancing & Validation',        'Commissioning & Testing', 'Item', 1, 9500, 9500, 120),
  (gen_random_uuid(), v_org, v_wb_hf, '3.4', 'O&M Manuals & As-Built Documentation',         'Commissioning & Testing', 'Item', 1, 3500, 3500, 130)
ON CONFLICT (id) DO NOTHING;

-- ── Workbook Lines — Kelston BP ───────────────────────────────────────────────

INSERT INTO vy_workbook_lines (id, org_id, workbook_id, item_number, description, section, unit, quantity, rate, contract_value, sort_order)
VALUES
  (gen_random_uuid(), v_org, v_wb_kb, '1.1', 'Boiler Plant, Flues & LTHW Distribution',         'Mechanical', 'Item', 1, 82000,  82000, 10),
  (gen_random_uuid(), v_org, v_wb_kb, '1.2', 'Air-Cooled Chiller Plant & CHWS Distribution',    'Mechanical', 'Item', 1, 76500,  76500, 20),
  (gen_random_uuid(), v_org, v_wb_kb, '1.3', 'Air Handling Units & Associated Ductwork',         'Mechanical', 'Item', 1, 94200,  94200, 30),
  (gen_random_uuid(), v_org, v_wb_kb, '1.4', 'Fan Coil Units & Terminal Equipment',              'Mechanical', 'Nr',  42,   984,  41328, 40),
  (gen_random_uuid(), v_org, v_wb_kb, '1.5', 'Domestic Hot & Cold Water Systems',                'Mechanical', 'Item', 1, 28800,  28800, 50),
  (gen_random_uuid(), v_org, v_wb_kb, '1.6', 'Gas Installation & Connections',                   'Mechanical', 'Item', 1, 12600,  12600, 60),
  (gen_random_uuid(), v_org, v_wb_kb, '2.1', 'HV/LV Transformer, Switchgear & Main Switchroom', 'Electrical', 'Item', 1, 58400,  58400, 70),
  (gen_random_uuid(), v_org, v_wb_kb, '2.2', 'Lighting & Emergency Lighting Installation',       'Electrical', 'Item', 1, 47200,  47200, 80),
  (gen_random_uuid(), v_org, v_wb_kb, '2.3', 'Small Power, Data & Containment Infrastructure',  'Electrical', 'Item', 1, 29700,  29700, 90),
  (gen_random_uuid(), v_org, v_wb_kb, '2.4', 'Addressable Fire Detection & Alarm System',        'Electrical', 'Item', 1, 36100,  36100, 100),
  (gen_random_uuid(), v_org, v_wb_kb, '2.5', 'Security, Access Control & CCTV',                  'Electrical', 'Item', 1, 22800,  22800, 110),
  (gen_random_uuid(), v_org, v_wb_kb, '2.6', 'BMS Building Controls & Integration',              'Electrical', 'Item', 1, 68500,  68500, 120),
  (gen_random_uuid(), v_org, v_wb_kb, '3.1', 'Hydraulic Pressure Testing & Flushing',            'Commissioning', 'Item', 1,  8900,  8900, 130),
  (gen_random_uuid(), v_org, v_wb_kb, '3.2', 'Air Balancing, Commissioning & Validation',        'Commissioning', 'Item', 1, 14200, 14200, 140),
  (gen_random_uuid(), v_org, v_wb_kb, '3.3', 'BMS Commissioning & System Integration',           'Commissioning', 'Item', 1, 18600, 18600, 150),
  (gen_random_uuid(), v_org, v_wb_kb, '3.4', 'Verification, Validation & O&M Documentation',    'Commissioning', 'Item', 1,  7400,  7400, 160)
ON CONFLICT (id) DO NOTHING;

-- ── Valuations — Hartfield MC ────────────────────────────────────────────────

INSERT INTO vy_valuations (id, org_id, project_id, ref, title, valuation_date, period, client, contractor, notes, status, created_by, workbook_id)
VALUES
  (v_val1, v_org, 'p1780569420807', 'VAL-001',
   'January 2026 Valuation', '2026-01-31', 'Period 1',
   'Brindley Construction Group', 'NEXA Solutions Ltd',
   'First valuation. Mobilisation, pipe first fix and materials delivered to site.',
   'certified', 'demo-user', v_wb_hf),

  (v_val2, v_org, 'p1780569420807', 'VAL-002',
   'February 2026 Valuation', '2026-02-28', 'Period 2',
   'Brindley Construction Group', 'NEXA Solutions Ltd',
   'Ductwork installation progressing well. FCU installations commenced. BMS cabling first fix underway.',
   'certified', 'demo-user', v_wb_hf),

  (v_val3, v_org, 'p1780569420807', 'VAL-003',
   'March 2026 Valuation', '2026-03-31', 'Period 3',
   'Brindley Construction Group', 'NEXA Solutions Ltd',
   'Mechanical works substantially complete. Electrical second fix in progress. Snagging list issued to subcontractors.',
   'draft', 'demo-user', v_wb_hf)
ON CONFLICT (id) DO NOTHING;

-- ── Valuations — Kelston BP ───────────────────────────────────────────────────

INSERT INTO vy_valuations (id, org_id, project_id, ref, title, valuation_date, period, client, contractor, notes, status, created_by, workbook_id)
VALUES
  (v_val4, v_org, 'p-demo-00000000002', 'VAL-001',
   'April 2026 Valuation', '2026-04-30', 'Period 1',
   'Kelston Commercial Developments Ltd', 'NEXA Solutions Ltd',
   'Mobilisation complete. Plant room groundworks, structural steelwork and boiler/chiller plant deliveries underway.',
   'certified', 'demo-user', v_wb_kb),

  (v_val5, v_org, 'p-demo-00000000002', 'VAL-002',
   'May 2026 Valuation', '2026-05-31', 'Period 2',
   'Kelston Commercial Developments Ltd', 'NEXA Solutions Ltd',
   'Chiller and boiler plant installed and pressure tested. LTHW first fix to floors 1-3 complete. HV transformer energised.',
   'submitted', 'demo-user', v_wb_kb)
ON CONFLICT (id) DO NOTHING;

END $$;
