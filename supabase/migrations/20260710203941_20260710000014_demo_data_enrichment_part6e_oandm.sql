-- ============================================================
-- DEMO DATA — Part 6: O&M Manuals, Sections, Items
-- source_module must be: tc_record | site_form | project_document
-- ============================================================

DO $$
DECLARE
  v_manual_hmc  uuid := 'aa000001-0000-4000-a000-000000000001';
  v_manual_kbp  uuid := 'aa000002-0000-4000-a000-000000000001';
  v_sec_hmc_pi  uuid := 'ab000001-0000-4000-a000-000000000001';
  v_sec_hmc_ahu uuid := 'ab000002-0000-4000-a000-000000000001';
  v_sec_hmc_bms uuid := 'ab000003-0000-4000-a000-000000000001';
  v_sec_hmc_cer uuid := 'ab000005-0000-4000-a000-000000000001';
  v_sec_kbp_me  uuid := 'ab000006-0000-4000-a000-000000000001';
  v_sec_kbp_bms uuid := 'ab000008-0000-4000-a000-000000000001';
  v_sec_kbp_com uuid := 'ab000009-0000-4000-a000-000000000001';
BEGIN

INSERT INTO vy_o_and_m_manuals (id, org_id, project_id, title, status, version, notes, created_by, cover_image_data_url, introduction) VALUES
  (v_manual_hmc, 'd0000000-0000-4000-a000-000000000001', 'p1780569420807',
   'Hartfield Medical Centre — M&E Refurbishment O&M Manual', 'in_progress', 'v1.2',
   'Draft in progress. Mechanical sections being populated by Caldwell. BMS section from Axiom Controls due week commencing 14 July.',
   'Tom Foreman', '',
   'This Operation and Maintenance Manual has been prepared by NEXA Solutions Ltd for the M&E refurbishment works at Hartfield Medical Centre, East Sussex, carried out on behalf of Brindley Construction Group. The manual contains operation and maintenance information for all installed mechanical, electrical, ventilation and building management systems.'),
  (v_manual_kbp, 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002',
   'Kelston Business Park — New Build M&E O&M Manual', 'finalised', 'v2.0',
   'Final version submitted to Alderton Developments on 2026-06-28. Witnessed and accepted.',
   'Oliver Troman', '',
   'This Operation and Maintenance Manual has been prepared by NEXA Solutions Ltd for the new build mechanical and electrical services installation at Kelston Business Park, Bristol, on behalf of Alderton Developments Ltd. Covers all mechanical, electrical, ventilation, BMS and fire systems across Blocks A, B and C.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vy_o_and_m_sections (id, org_id, manual_id, project_id, title, description, sort_order) VALUES
  (v_sec_hmc_pi,  'd0000000-0000-4000-a000-000000000001', v_manual_hmc, 'p1780569420807', 'Pipework Systems — LTHW, CHW and Domestic Services', 'Low temperature hot water, chilled water and domestic hot and cold water distribution systems.', 1),
  (v_sec_hmc_ahu, 'd0000000-0000-4000-a000-000000000001', v_manual_hmc, 'p1780569420807', 'Air Handling Units and Ventilation', 'Supply and extract ventilation systems including AHU schedules, duct layouts and commissioning data.', 2),
  (v_sec_hmc_bms, 'd0000000-0000-4000-a000-000000000001', v_manual_hmc, 'p1780569420807', 'Building Management System', 'Axiom Controls BMS installation covering LTHW, CHW, ventilation control and monitoring.', 3),
  (v_sec_hmc_cer, 'd0000000-0000-4000-a000-000000000001', v_manual_hmc, 'p1780569420807', 'Certificates and Test Results', 'Commissioning certificates, pressure test records and manufacturers declarations.', 4),
  (v_sec_kbp_me,  'd0000000-0000-4000-a000-000000000001', v_manual_kbp, 'p-demo-00000000002', 'Mechanical Services — Heating, Cooling and Plumbing', 'All mechanical systems including VRF, fan coil units, LTHW distribution and plumbing.', 1),
  (v_sec_kbp_bms, 'd0000000-0000-4000-a000-000000000001', v_manual_kbp, 'p-demo-00000000002', 'Building Management System', 'Trend BMS covering HVAC, metering and tenant interface for all three blocks.', 2),
  (v_sec_kbp_com, 'd0000000-0000-4000-a000-000000000001', v_manual_kbp, 'p-demo-00000000002', 'Commissioning Records and Certificates', 'System commissioning results, balancing reports, pressure tests and handover certificates.', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO vy_o_and_m_items (id, org_id, section_id, manual_id, project_id, source_module, source_record_id, title, subtitle, notes, sort_order, created_by) VALUES
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_hmc_pi, v_manual_hmc, 'p1780569420807', 'project_document', 'hmc-doc-lthw', 'LTHW System Design and Operating Parameters', 'Low Temperature Hot Water — 80/60 degrees C flow/return', 'LTHW system operates at 80 degrees C flow and 60 degrees C return. Maximum working pressure 3.0 bar. System volume 850 litres. Pressurisation unit set point 1.5 bar cold fill. Fully zoned with motorised zone valves controlled via BMS. Annual chemical dosing check required.', 1, 'Tom Foreman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_hmc_pi, v_manual_hmc, 'p1780569420807', 'project_document', 'hmc-doc-chw', 'Chilled Water System Design and Operating Parameters', 'Chilled Water — 6/12 degrees C flow/return', 'CHW system serves fan coil units on Levels 1 and 2. Operating temperatures 6 degrees C flow, 12 degrees C return. Working pressure 2.5 bar. Includes pressurisation unit, expansion vessel and automatic air vents at high points. Glycol concentration to be checked annually — target 25% propylene glycol.', 2, 'Tom Foreman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_hmc_pi, v_manual_hmc, 'p1780569420807', 'project_document', 'hmc-doc-caldwell', 'Caldwell Pipework Ltd — Operation and Maintenance Instructions', 'Specialist subcontractor O&M submission', 'Full O&M data pack submitted by Caldwell Pipework Ltd. Includes valve schedules, strainer maintenance procedures, pump data sheets and recommended spare parts list. Reference: CPL-OAM-HMC-001 Rev B.', 3, 'Tom Foreman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_hmc_ahu, v_manual_hmc, 'p1780569420807', 'project_document', 'hmc-doc-ahu01', 'AHU-01 — Carrier 30RBS-070 Supply and Extract Unit', 'Plant Room Level B1 — serving Levels 1 and 2', 'Carrier 30RBS-070 packaged AHU. Supply air 4,500 l/s, extract air 4,200 l/s. LTHW heating coil, CHW cooling coil, heat recovery wheel (78% efficiency). G4 pre-filters and F7 bag filters. Filter replacement interval 6 months.', 1, 'Tom Foreman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_hmc_ahu, v_manual_hmc, 'p1780569420807', 'project_document', 'hmc-doc-ahu-comm', 'Ventilation Commissioning Data — AHU-01', 'Commissioning results by Vertex Commissioning Services Ltd', 'Commissioning completed 2026-06-18 by Adam Cole, Vertex Commissioning Services Ltd. Supply air balance within 5% of design. CIBSE Commissioning Code A procedures followed. Certificate reference VCS-HMC-001.', 2, 'Tom Foreman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_hmc_bms, v_manual_hmc, 'p1780569420807', 'project_document', 'hmc-doc-bms-overview', 'Axiom Controls BMS — System Overview', 'Bacnet IP-based building management system', 'BMS installed and commissioned by Axiom Building Controls Ltd using Siemens DESIGO CC platform. Monitors and controls LTHW heating zones, CHW plant, AHU-01 operation and all motorised valves. Remote access via secure VPN. Reference: AXIOM-HMC-BMS-001.', 1, 'Oliver Troman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_hmc_bms, v_manual_hmc, 'p1780569420807', 'project_document', 'hmc-doc-bms-training', 'BMS Operator Training Notes', 'Staff training delivered 2026-07-01', 'Training session delivered to Trust facilities team on 1 July 2026. Covered: system overview, set point adjustment, alarm response, fault finding and emergency override procedures. Training certificate issued by Axiom Controls.', 2, 'Oliver Troman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_kbp_me, v_manual_kbp, 'p-demo-00000000002', 'project_document', 'kbp-doc-vrf', 'VRF System — Daikin VRV IV Heat Recovery', 'Blocks B and C — units 10-24', 'Daikin VRV IV Heat Recovery system serving units 10-24. 40HP outdoor units at roof level. 52 indoor units. Addressable via Daikin centralised controller. Refrigerant R-410A. F-Gas certificate ref: FGAS-KBP-2026-003. Annual maintenance required by F-Gas registered engineer.', 1, 'Oliver Troman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_kbp_me, v_manual_kbp, 'p-demo-00000000002', 'project_document', 'kbp-doc-lthw', 'LTHW Heating System — Blocks A and B', 'Ideal Logic commercial condensing boilers', 'Twin Ideal Logic 80kW condensing boilers in plant room Block A. Cascade control via BMS. LTHW 75/65 degrees C design temperatures. Low loss header. Grundfos MAGNA3 pumps duty/standby. Gas Safe certificate ref: GS-KBP-2026-001.', 2, 'Oliver Troman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_kbp_bms, v_manual_kbp, 'p-demo-00000000002', 'project_document', 'kbp-doc-bms', 'Trend BMS — System Overview and Operating Instructions', 'Trend IQ4E controllers — all three blocks', 'Trend IQ4E BMS covering all three blocks. Controls HVAC, heating, metering and tenant interface panels. Webserver accessible via secure browser interface.', 1, 'Oliver Troman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_kbp_com, v_manual_kbp, 'p-demo-00000000002', 'project_document', 'kbp-doc-mech-comm', 'Mechanical Commissioning Report — All Blocks', 'Vertex Commissioning Services Ltd — Final Report June 2026', 'Final mechanical commissioning report by Vertex Commissioning Services Ltd. All HVAC systems commissioned and balanced. LTHW and CHW pressure tested and signed off. VRF systems commissioned and handed over. Reference VCS-KBP-MCR-001 Rev Final.', 1, 'Oliver Troman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_kbp_com, v_manual_kbp, 'p-demo-00000000002', 'project_document', 'kbp-doc-eic', 'Electrical Test Certificates — Blocks A, B and C', 'Stratos Electrical Contractors Ltd — EIC', 'Electrical Installation Certificates issued by Stratos Electrical Contractors Ltd upon completion of each block. All circuits tested to BS 7671:2018 18th Edition. Reference: SEC-KBP-EIC-001 to 003.', 2, 'Oliver Troman'),
  (gen_random_uuid(), 'd0000000-0000-4000-a000-000000000001', v_sec_kbp_com, v_manual_kbp, 'p-demo-00000000002', 'project_document', 'kbp-doc-water', 'Water System Commissioning and Hygiene Certificates', 'L8 compliance — flushing and disinfection', 'All domestic water systems flushed, cleaned and disinfected to BSRIA BG 29/2012 prior to handover. Legionella risk assessment completed. Water hygiene certificate ref: WHC-KBP-2026-001. Hot water above 50 degrees C and cold below 20 degrees C confirmed.', 3, 'Oliver Troman')
ON CONFLICT (id) DO NOTHING;

END $$;
