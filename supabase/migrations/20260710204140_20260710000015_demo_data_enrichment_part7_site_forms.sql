-- ============================================================
-- DEMO DATA — Part 7: Site Forms
-- Projects: Hartfield MC (p1780569420807), Kelston BP (p-demo-00000000002)
-- All org_id must be UUID type
-- ============================================================

INSERT INTO vy_site_forms (id, type, project_id, project_name, date, completed_by, description, comments, status, submitted_date, notes, extra_data, form_comments, org_id) VALUES

-- ── Daily Site Reports ─────────────────────────────────────────
('sf-dsr-001', 'Daily Site Report', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-05-12', 'Tom Foreman',
 'Level 2 second fix pipework — FCU connections and branch isolations. 3 operatives on site.',
 'Access to Radiology corridor still restricted until 14:00. Works completed in permitted window. All isolations tested and signed off.',
 'Submitted', '2026-05-12', '',
 '{"attendance":{"operatives":3,"supervisors":1,"visitors":0},"progress":"FCU connections Rooms 2.04-2.11 complete. Branch isolations on primary circuit completed and leak tested. Waiting for Trust ICT to release Radiology corridor.","materials":["22mm copper pipe","15mm copper pipe","Fernox TF1 inhibitor dosing"],"delays":"Restricted access zone — 3 hours lost waiting for Radiology access","hs_observations":"No issues. All operatives wearing full PPE. RAMS reviewed at start of shift.","weather":"Indoor works","next_day_plan":"Level 2 remaining FCUs — rooms 2.12 onwards"}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

('sf-dsr-002', 'Daily Site Report', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-05-19', 'Tom Foreman',
 'Level 3 recovery area — ductwork first fix. 4 operatives on site.',
 'Good day — all planned works completed ahead of schedule. Level 3 recovery area ductwork spine run fully installed. No defects.',
 'Submitted', '2026-05-19', '',
 '{"attendance":{"operatives":4,"supervisors":1,"visitors":1},"progress":"Recovery area ductwork spine 32m installed. Two branch spurs to bays 1-4 installed. Fire damper positions marked up for client approval.","materials":["300x150mm rectangular duct","200mm flexible duct","Fire dampers x4"],"delays":"None","hs_observations":"Toolbox talk conducted — working at height on mobile scaffold. All signed.","weather":"Indoor works","next_day_plan":"Fire damper positions to be agreed with Trust. Continue branch spurs bays 5-8."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

('sf-dsr-003', 'Daily Site Report', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 '2026-03-08', 'Oliver Troman',
 'Block C electrical second fix — lighting and small power. 6 operatives on site.',
 'Excellent progress. All Units 1-6 second fix complete. Stratos Electrical ahead of programme.',
 'Submitted', '2026-03-08', '',
 '{"attendance":{"operatives":6,"supervisors":1,"visitors":0},"progress":"Block C Units 1-6 second fix complete — luminaires, sockets, data outlets. DB3 energised and tested. Emergency lighting duration tests passed for units 1-3.","materials":["2-gang sockets","LED recessed luminaires","Emergency light fittings"],"delays":"None","hs_observations":"No issues. All operatives inducted. COSHH sheets reviewed for installation adhesives.","weather":"Indoor works","next_day_plan":"Block C Units 7-10 second fix. DB4 energise."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── Pressure Tests ─────────────────────────────────────────────
('sf-pt-001', 'Pressure Test', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-04-17', 'Tom Foreman',
 'LTHW primary circuit — cold hydraulic pressure test',
 'Test passed. No visible leaks. Pressure held for 2 hours with less than 0.1 bar drop.',
 'Submitted', '2026-04-17', 'Witnessed by site manager Paul Harris, Brindley Construction.',
 '{"system":"LTHW Primary Circuit","medium":"Water","test_pressure_bar":4.5,"test_duration_mins":120,"start_pressure":4.5,"end_pressure":4.43,"pass_fail":"Pass","witness":"Paul Harris — Brindley Construction Group","notes":"Minor weep at flanged joint near valve M06 — re-torqued and retest passed. All other joints dry."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

('sf-pt-002', 'Pressure Test', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-05-03', 'Tom Foreman',
 'CHW distribution circuit — cold hydraulic pressure test',
 'Test passed first time. Pressure maintained throughout. Witnessed and signed off.',
 'Submitted', '2026-05-03', '',
 '{"system":"CHW Distribution Circuit — Levels 1 and 2","medium":"Water","test_pressure_bar":3.5,"test_duration_mins":120,"start_pressure":3.5,"end_pressure":3.49,"pass_fail":"Pass","witness":"Paul Harris — Brindley Construction Group","notes":"Clean test. All joints dry throughout. System ready for flushing and chemical dosing."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

('sf-pt-003', 'Pressure Test', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 '2026-01-22', 'Oliver Troman',
 'LTHW heating circuit — Block A',
 'Passed. Witnessed by client engineer.',
 'Submitted', '2026-01-22', 'Client witness: Raj Kapoor, Alderton Developments.',
 '{"system":"LTHW Heating — Block A","medium":"Water","test_pressure_bar":4.0,"test_duration_mins":120,"start_pressure":4.0,"end_pressure":3.98,"pass_fail":"Pass","witness":"Raj Kapoor — Alderton Developments Ltd","notes":"Excellent result. All distribution pipework and connections tested in one pass."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── Flushing Records ───────────────────────────────────────────
('sf-fr-001', 'Flushing Record', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-05-09', 'Tom Foreman',
 'LTHW primary circuit pre-commission flush — Stage 1 power flush',
 'Stage 1 flush complete. Water quality met BSRIA BG 29 requirements. Iron reading below 0.5mg/l at outlet.',
 'Submitted', '2026-05-09', '',
 '{"system":"LTHW Primary Circuit","flush_type":"Power Flush — Stage 1","equipment_used":"Kamco CF90 Clearflow","initial_iron_mg_l":8.4,"final_iron_mg_l":0.42,"initial_tds":620,"final_tds":210,"ph_initial":7.8,"ph_final":8.2,"pass_fail":"Pass","chemical_used":"Fernox F3 Cleaner","inhibitor_added":"Yes — Fernox F1 to 2%","notes":"Circulated at 3 bar for 4 hours. Sample taken at pump discharge and furthest point. Both readings within BSRIA BG29 requirements."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── Flushing Register ──────────────────────────────────────────
('sf-flr-001', 'Flushing Register', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 '2026-04-07', 'Oliver Troman',
 'Domestic hot and cold water flushing register — Block A, Units 1-6',
 'All outlets flushed and temperature targets achieved. Legionella control measures in place.',
 'Submitted', '2026-04-07', 'L8 compliance flushing in accordance with BSRIA BG 29/2012 and HSG274.',
 '{"outlets":[{"location":"Unit 1 Kitchen","outlet_type":"Basin tap","am_start_temp":15,"pm_end_temp":52,"pass_fail":"Pass"},{"location":"Unit 1 WC","outlet_type":"WC flush","am_start_temp":14,"pm_end_temp":null,"pass_fail":"Pass"},{"location":"Unit 2 Kitchen","outlet_type":"Basin tap","am_start_temp":15,"pm_end_temp":51,"pass_fail":"Pass"},{"location":"Unit 3 Kitchen","outlet_type":"Basin tap","am_start_temp":14,"pm_end_temp":53,"pass_fail":"Pass"},{"location":"Communal WC Block A","outlet_type":"Shower","am_start_temp":16,"pm_end_temp":54,"pass_fail":"Pass"}],"declaration":"All outlets flushed in accordance with ACoP L8 and BSRIA BG 29. Water quality satisfactory. Signed: O. Troman, NEXA Solutions Ltd."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── Temperature Water Readings ─────────────────────────────────
('sf-twr-001', 'Temperature Water Readings', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-06-24', 'Tom Foreman',
 'Domestic hot and cold water temperature survey — pre-handover compliance check',
 'All readings within acceptable parameters. Hot outlets achieved 50 degrees C within 60 seconds. Cold outlets below 20 degrees C.',
 'Submitted', '2026-06-24', 'Pre-handover L8 temperature survey.',
 '{"survey_type":"Pre-Handover L8 Temperature Survey","outlets":[{"ref":"HW-01","location":"Level 1 Staff WC — HW outlet","type":"Basin tap","20s_temp":49,"60s_temp":54,"pass_fail":"Pass"},{"ref":"HW-02","location":"Level 2 Staff WC — HW outlet","type":"Basin tap","20s_temp":48,"60s_temp":52,"pass_fail":"Pass"},{"ref":"CW-01","location":"Level 1 Staff WC — CW outlet","type":"Basin tap","static_temp":13,"flowing_temp":12,"pass_fail":"Pass"},{"ref":"CW-02","location":"Level 2 Staff WC — CW outlet","type":"Basin tap","static_temp":14,"flowing_temp":13,"pass_fail":"Pass"},{"ref":"HW-03","location":"Level 3 Treatment Room — HW outlet","type":"Clinical basin","20s_temp":50,"60s_temp":55,"pass_fail":"Pass"}],"declaration":"Temperature survey carried out in accordance with CIBSE TM64 and L8. All outlets satisfactory. Signed: Tom Foreman, NEXA Solutions Ltd."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── AHU Commissioning ──────────────────────────────────────────
('sf-ahu-001', 'AHU Commissioning', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-06-18', 'Tom Foreman',
 'AHU-01 — Carrier 30RBS-070 commissioning record',
 'All readings within 5% of design. Heat recovery wheel operating correctly. Commissioning complete.',
 'Submitted', '2026-06-18', 'Witnessed by Adam Cole, Vertex Commissioning Services Ltd.',
 '{"ahu_ref":"AHU-01","manufacturer":"Carrier","model":"30RBS-070","location":"Plant Room Level B1","design_supply_ls":4500,"measured_supply_ls":4420,"design_extract_ls":4200,"measured_extract_ls":4180,"fan_speed_rpm":1450,"motor_current_amps":18.4,"heat_recovery_eff_pct":78,"filter_type_supply":"G4/F7","filter_type_extract":"G4","pre_heat_coil":"N/A","heating_coil_design_kw":45,"heating_coil_measured_kw":44.2,"cooling_coil_design_kw":38,"cooling_coil_measured_kw":37.1,"pass_fail":"Pass","witness":"Adam Cole — Vertex Commissioning Services Ltd","notes":"All parameters within 5% of design intent. BMS setpoints configured and confirmed. CIBSE Code A procedures followed throughout."}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── RFIs ───────────────────────────────────────────────────────
('sf-rfi-001', 'RFI', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-02-20', 'Tom Foreman',
 'RFI-001: Boiler flue termination height — conflict with existing roof penetration',
 'Response received from structural engineer. Alternative route approved. See attached sketch.',
 'Submitted', '2026-02-20', 'Response received 2026-02-27.',
 '{"rfi_number":"RFI-001","subject":"Boiler flue termination height — conflict with existing roof penetration","raised_by":"NEXA Solutions Ltd","addressed_to":"Brindley Construction Group / Frost & Partners (Structural)","query":"The specified flue termination point on drawing M-001 Rev C conflicts with existing structural upstand at grid ref E7. Please confirm alternative route or structural modification.","response":"Flue route revised to terminate at grid E6 as shown on Structural sketch S-047 Rev A issued 27/02/2026. Confirmed by Frost and Partners.","response_date":"2026-02-27","impact":"None — revised route achievable within existing programme"}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

('sf-rfi-002', 'RFI', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E',
 '2025-10-28', 'Oliver Troman',
 'RFI-001: Electrical distribution board positions — Block B, Levels 1 and 2',
 'DB positions confirmed as drawn. Access requirements to be coordinated with fit-out contractor.',
 'Submitted', '2025-10-28', 'Response received 2025-11-04.',
 '{"rfi_number":"RFI-001","subject":"Electrical distribution board positions — Block B Levels 1 and 2","raised_by":"NEXA Solutions Ltd","addressed_to":"Alderton Developments Ltd","query":"DB positions on Electrical drawing E-B-103 Rev B show DB2B and DB3B in the common corridor. Please confirm these positions are acceptable to the fit-out contractor and that corridor widths will not be compromised.","response":"DB positions confirmed as drawn. Fit-out contractor to maintain clear access width of 1200mm around each board. Alderton PM confirmed 04/11/2025.","response_date":"2025-11-04","impact":"None"}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── QA Inspections ─────────────────────────────────────────────
('sf-qa-001', 'QA Inspection', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-05-28', 'Tom Foreman',
 'QA Inspection — Level 2 pipework second fix completion check',
 '3 minor snags raised. All to be cleared before commissioning. Overall quality satisfactory.',
 'Submitted', '2026-05-28', '',
 '{"inspection_area":"Level 2 — Pipework Second Fix","inspected_by":"Tom Foreman","checklist":[{"item":"Pipe supports at correct centres","result":"Pass","notes":""},{"item":"All joints made correctly — no sharps or burrs","result":"Pass","notes":""},{"item":"Valves installed and accessible","result":"Pass","notes":""},{"item":"Air vents at all high points","result":"Fail","notes":"Auto air vent missing at riser junction — Room 2.09"},{"item":"Drain cocks at all low points","result":"Pass","notes":""},{"item":"Pipe identification labels installed","result":"Fail","notes":"Labels missing on 4 valves in plant room connection area"},{"item":"Insulation complete and joints taped","result":"Fail","notes":"3 joints not yet insulated — contractor to return"}],"overall_result":"Minor Snags","snags_raised":3}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── Risk Assessments ───────────────────────────────────────────
('sf-ra-001', 'Risk Assessment', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-01-20', 'Tom Foreman',
 'RAMS — Working in occupied hospital environment — pipework installation',
 'RAMS reviewed and approved. Briefed to all operatives at induction.',
 'Submitted', '2026-01-20', 'Version 1 — reviewed prior to project commencement.',
 '{"activity":"Mechanical pipework installation in occupied hospital environment","project_ref":"HMC-001","prepared_by":"Tom Foreman — NEXA Solutions Ltd","hazards":[{"hazard":"Infection risk — working in clinical areas","likelihood":3,"severity":4,"risk_rating":12,"controls":"Full PPE including mask and gloves. Infection control induction completed. All clinical areas to be decontaminated and sealed before works commence."},{"hazard":"Patient disturbance — noise and vibration","likelihood":4,"severity":2,"risk_rating":8,"controls":"Restricted working hours agreed with Trust. No noisy cutting operations between 08:00-10:00 and 14:00-16:00. Silent works only when requested."},{"hazard":"Existing services — unknown routes","likelihood":3,"severity":4,"risk_rating":12,"controls":"Thermal imaging survey completed. CAT scan before all penetrations. Permit to penetrate required for all structural walls."},{"hazard":"Manual handling — heavy pipework sections","likelihood":3,"severity":3,"risk_rating":9,"controls":"Mechanical handling equipment available. Team lifts for sections over 25kg. All operatives manual handling trained."}],"sign_off":"All operatives to sign RAMS acknowledgement sheet on first day"}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── Toolbox Talks ──────────────────────────────────────────────
('sf-tbt-001', 'Toolbox Talk', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-04-07', 'Tom Foreman',
 'Toolbox Talk — Legionella awareness and water hygiene on site',
 'All 4 operatives attended and signed. Good engagement. No concerns raised.',
 'Submitted', '2026-04-07', '',
 '{"topic":"Legionella Awareness and Water Hygiene on Site","delivered_by":"Tom Foreman","attendees":["Dave Caldwell","J. Patel","R. Singh","M. Okonkwo"],"key_points":["Legionella risk in stagnant water — importance of regular flushing during construction","No dead-legs to be left in the system — all circuits to be flushed before isolation","Report any discoloured water or unusual smell immediately","Sampling points and flushing log to be maintained throughout"],"questions_raised":"One operative asked about the procedure for flushing domestic cold water during a weekend shutdown — confirmed: isolation valves to be closed, system to be run before re-opening","actions":"Tom Foreman to circulate flushing log template to Caldwell Pipework by Friday"}',
 '[]', 'd0000000-0000-4000-a000-000000000001'),

-- ── Site Instructions ──────────────────────────────────────────
('sf-si-001', 'Site Instruction', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment',
 '2026-03-04', 'Tom Foreman',
 'SI-001: Caldwell Pipework — boiler room completion programme',
 'Instruction issued requiring boiler room pipework to be complete and pressure tested by 28 March 2026.',
 'Submitted', '2026-03-04', '',
 '{"instruction_number":"SI-001","issued_to":"Caldwell Pipework Ltd","issued_by":"Tom Foreman — NEXA Solutions Ltd","instruction":"You are required to complete all primary pipework connections in the boiler room, including LTHW primary circuit, header manifolds and pump connections, and carry out cold hydraulic pressure test by 28 March 2026. This is required to allow the BMS contractor to commence controls wiring on 31 March.","required_by_date":"2026-03-28","acknowledged_by":"Dave Caldwell","acknowledged_date":"2026-03-05"}',
 '[]', 'd0000000-0000-4000-a000-000000000001')

ON CONFLICT (id) DO NOTHING;
