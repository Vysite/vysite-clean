-- ─── Demo Data: Project Documents ─────────────────────────────────────────────
-- Org: NEXA Solutions (d0000000-0000-4000-a000-000000000001)

INSERT INTO vy_project_documents
  (id, org_id, project_id, project_name, name, doc_title, type, size, category, data_url, uploaded_by)
VALUES

-- ══ Hartfield MC — Drawings ══════════════════════════════════════════════════
('HF-DRG-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-ME-DRG-001 Rev B — Ground Floor Mechanical Layout.pdf',
 'Ground Floor Mechanical Layout',
 'application/pdf', 3421890, 'Drawing', '', 'demo-user'),

('HF-DRG-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-ME-DRG-002 Rev B — First Floor Mechanical Layout.pdf',
 'First Floor Mechanical Layout',
 'application/pdf', 3218750, 'Drawing', '', 'demo-user'),

('HF-DRG-003', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-ME-DRG-003 Rev A — LTHW System Schematic.pdf',
 'LTHW System Schematic',
 'application/pdf', 1845200, 'Drawing', '', 'demo-user'),

('HF-DRG-004', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-EL-DRG-001 Rev A — Electrical Single Line Diagram.pdf',
 'Electrical Single Line Diagram',
 'application/pdf', 2104500, 'Drawing', '', 'demo-user'),

('HF-DRG-005', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-EL-DRG-002 Rev A — BMS Architecture Drawing.pdf',
 'BMS Architecture Drawing',
 'application/pdf', 1620300, 'Drawing', '', 'demo-user'),

-- ══ Hartfield MC — Specifications ════════════════════════════════════════════
('HF-SPEC-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-SPEC-ME-001 Rev B — Mechanical & Electrical Specification.pdf',
 'Mechanical & Electrical Specification',
 'application/pdf', 5834200, 'Specification', '', 'demo-user'),

-- ══ Hartfield MC — RAMS ═══════════════════════════════════════════════════════
('HF-RAMS-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-RAMS-001 — Risk Assessment & Method Statement — Pipework Installation.pdf',
 'RAMS — Pipework Installation',
 'application/pdf', 928400, 'RAMS', '', 'demo-user'),

('HF-RAMS-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-RAMS-002 — Risk Assessment & Method Statement — Electrical First & Second Fix.pdf',
 'RAMS — Electrical First & Second Fix',
 'application/pdf', 1042600, 'RAMS', '', 'demo-user'),

('HF-RAMS-003', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-RAMS-003 — Risk Assessment & Method Statement — Ductwork & AHU Installation.pdf',
 'RAMS — Ductwork & AHU Installation',
 'application/pdf', 876500, 'RAMS', '', 'demo-user'),

-- ══ Hartfield MC — Datasheets ═════════════════════════════════════════════════
('HF-DS-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'DS — Grundfos CM Pump Series — Technical Datasheet.pdf',
 'Grundfos CM Pump Series — Technical Datasheet',
 'application/pdf', 654200, 'Datasheet', '', 'demo-user'),

('HF-DS-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'DS — Trox X-CUBE Fan Coil Unit — Technical Datasheet.pdf',
 'Trox X-CUBE Fan Coil Unit — Technical Datasheet',
 'application/pdf', 812700, 'Datasheet', '', 'demo-user'),

('HF-DS-003', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'DS — Honeywell JADE Series BMS Controllers — Technical Datasheet.pdf',
 'Honeywell JADE Series BMS Controllers — Datasheet',
 'application/pdf', 534800, 'Datasheet', '', 'demo-user'),

-- ══ Hartfield MC — Certificates ═══════════════════════════════════════════════
('HF-CERT-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-CERT-001 — Electrical Installation Certificate — LV Distribution.pdf',
 'Electrical Installation Certificate — LV Distribution',
 'application/pdf', 412000, 'Certificate', '', 'demo-user'),

('HF-CERT-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-CERT-002 — Hydraulic Pressure Test Certificate — LTHW System.pdf',
 'Hydraulic Pressure Test Certificate — LTHW System',
 'application/pdf', 324500, 'Certificate', '', 'demo-user'),

('HF-CERT-003', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 'HF-CERT-004 — L8 Flushing & Chemical Dosing Certificate.pdf',
 'L8 Flushing & Chemical Dosing Certificate',
 'application/pdf', 298100, 'Certificate', '', 'demo-user'),

-- ══ Kelston BP — Drawings ═════════════════════════════════════════════════════
('KB-DRG-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-ME-DRG-001 Rev C — Ground Floor M&E Layout.pdf',
 'Ground Floor M&E Layout',
 'application/pdf', 4821300, 'Drawing', '', 'demo-user'),

('KB-DRG-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-ME-DRG-002 Rev C — Roof Plant Layout & Equipment Schedule.pdf',
 'Roof Plant Layout & Equipment Schedule',
 'application/pdf', 3645200, 'Drawing', '', 'demo-user'),

('KB-DRG-003', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-ME-DRG-003 Rev B — Chiller & Boiler Plant Schematic.pdf',
 'Chiller & Boiler Plant Schematic',
 'application/pdf', 2934100, 'Drawing', '', 'demo-user'),

('KB-DRG-004', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-EL-DRG-001 Rev B — LV Distribution Schematic.pdf',
 'LV Distribution Schematic',
 'application/pdf', 2410600, 'Drawing', '', 'demo-user'),

('KB-DRG-005', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-EL-DRG-002 Rev A — Addressable Fire Alarm Layout — All Floors.pdf',
 'Addressable Fire Alarm Layout — All Floors',
 'application/pdf', 3102800, 'Drawing', '', 'demo-user'),

-- ══ Kelston BP — Specifications ═══════════════════════════════════════════════
('KB-SPEC-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-SPEC-ME-001 Rev C — Mechanical Engineering Specification.pdf',
 'Mechanical Engineering Specification',
 'application/pdf', 7412300, 'Specification', '', 'demo-user'),

('KB-SPEC-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-SPEC-EL-001 Rev B — Electrical Engineering Specification.pdf',
 'Electrical Engineering Specification',
 'application/pdf', 6928400, 'Specification', '', 'demo-user'),

-- ══ Kelston BP — RAMS ══════════════════════════════════════════════════════════
('KB-RAMS-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-RAMS-001 — Risk Assessment & Method Statement — Roof Plant Installation.pdf',
 'RAMS — Roof Plant Installation',
 'application/pdf', 1134200, 'RAMS', '', 'demo-user'),

('KB-RAMS-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-RAMS-002 — Risk Assessment & Method Statement — HV-LV Transformer & Switchgear.pdf',
 'RAMS — HV/LV Transformer & Switchgear',
 'application/pdf', 1298700, 'RAMS', '', 'demo-user'),

('KB-RAMS-003', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-RAMS-003 — Risk Assessment & Method Statement — Chiller & Boiler Plant.pdf',
 'RAMS — Chiller & Boiler Plant Installation',
 'application/pdf', 986400, 'RAMS', '', 'demo-user'),

-- ══ Kelston BP — Datasheets ════════════════════════════════════════════════════
('KB-DS-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'DS — Daikin EWAD-TZ Air-Cooled Chiller — Technical Datasheet.pdf',
 'Daikin EWAD-TZ Air-Cooled Chiller — Datasheet',
 'application/pdf', 1524800, 'Datasheet', '', 'demo-user'),

('KB-DS-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'DS — Mitsubishi Electric PAC-I AHU Series — Technical Datasheet.pdf',
 'Mitsubishi Electric PAC-I AHU Series — Datasheet',
 'application/pdf', 1836200, 'Datasheet', '', 'demo-user'),

('KB-DS-003', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'DS — Schneider Electric Prisma iP LV Switchgear — Technical Datasheet.pdf',
 'Schneider Electric Prisma iP LV Switchgear — Datasheet',
 'application/pdf', 1142600, 'Datasheet', '', 'demo-user'),

('KB-DS-004', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'DS — Ideal Heating Evomax 2 Commercial Boiler — Technical Datasheet.pdf',
 'Ideal Heating Evomax 2 Commercial Boiler — Datasheet',
 'application/pdf', 978300, 'Datasheet', '', 'demo-user'),

-- ══ Kelston BP — Certificates ══════════════════════════════════════════════════
('KB-CERT-001', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-CERT-001 — Electrical Installation Certificate — Main LV Distribution.pdf',
 'Electrical Installation Certificate — Main LV Distribution',
 'application/pdf', 512400, 'Certificate', '', 'demo-user'),

('KB-CERT-002', 'd0000000-0000-4000-a000-000000000001'::uuid,
 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 'KB-CERT-002 — Hydraulic Pressure Test Certificate — CHWS & LTHW Systems.pdf',
 'Hydraulic Pressure Test Certificate — CHWS & LTHW Systems',
 'application/pdf', 418700, 'Certificate', '', 'demo-user')

ON CONFLICT (id) DO NOTHING;
