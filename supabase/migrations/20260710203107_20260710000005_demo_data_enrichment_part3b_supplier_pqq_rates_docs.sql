-- ============================================================
-- DEMO DATA — Part 3: Supplier Trade Links, PQQ Responses, Labour Rates, Documents
-- ============================================================

-- Trade links
INSERT INTO vy_supplier_trade_links (supplier_id, trade_id, org_id)
VALUES
  ('sup-001', 'trade-mech-001', 'd0000000-0000-4000-a000-000000000001'),
  ('sup-001', 'trade-hvac-001', 'd0000000-0000-4000-a000-000000000001'),
  ('sup-002', 'trade-elec-001', 'd0000000-0000-4000-a000-000000000001'),
  ('sup-002', 'trade-ctrl-001', 'd0000000-0000-4000-a000-000000000001'),
  ('sup-003', 'trade-ins-001',  'd0000000-0000-4000-a000-000000000001'),
  ('sup-004', 'trade-ctrl-001', 'd0000000-0000-4000-a000-000000000001'),
  ('sup-005', 'trade-fire-001', 'd0000000-0000-4000-a000-000000000001'),
  ('sup-006', 'trade-gas-001',  'd0000000-0000-4000-a000-000000000001'),
  ('sup-006', 'trade-mech-001', 'd0000000-0000-4000-a000-000000000001'),
  ('sup-007', 'trade-test-001', 'd0000000-0000-4000-a000-000000000001')
ON CONFLICT DO NOTHING;

-- PQQ Responses — Caldwell Pipework (sup-001)
INSERT INTO vy_supplier_pqq_responses (id, supplier_id, org_id, section_key, responses, section_status, notes, completed_at, completed_by, updated_at) VALUES
  ('pqq-001-ci', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'company_info',
   '{"legal_status":"Limited Company","date_established":"2006-03-15 / 18 years","employee_count":34,"annual_turnover":2800000,"vat_registered":"Yes","ccj_history":"No","insolvency_history":"No","parent_company":""}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months'),
  ('pqq-001-hs', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'health_safety',
   '{"hs_policy":"Yes","hs_policy_reviewed":"Yes","method_statements":"Yes","toolbox_talks":"Yes","riddor_history":"No","hs_accreditation":"CHAS (exp. 2027-04), Constructionline Gold"}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months'),
  ('pqq-001-ins', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'insurance',
   '{"pl_limit":5000000,"pl_insurer":"Aviva Commercial","pl_expiry":"2027-01-31","el_limit":10000000,"el_insurer":"Aviva Commercial","el_expiry":"2027-01-31","pi_limit":2000000,"pi_expiry":"2027-01-31","cw_limit":null,"cw_expiry":""}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months'),
  ('pqq-001-qa', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'quality',
   '{"qms":"Yes","qms_description":"Operate an internal QMS aligned to ISO 9001 principles. Inspections and sign-off sheets completed on all work stages.","iso9001":"N/A","iso9001_expiry":"","env_policy":"Yes","iso14001":"N/A","waste_carrier_reg":"CBDU234871"}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months'),
  ('pqq-001-acc', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'accreditations',
   '{"chas":"Yes","chas_expiry":"2027-04-30","constructionline":"Yes","niceic":"N/A","gas_safe":"N/A","iso45001":"N/A","besa":"N/A","other_accreditations":"WRAS approved installer"}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months'),
  ('pqq-001-wf', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'workforce',
   '{"cscs_scheme":"Yes","direct_workforce_pct":85,"gang_subcontracting":"No","apprenticeships":"Yes","nvq_training":"Yes"}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months'),
  ('pqq-001-ref', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'references',
   '{"ref1_company":"Northbrook Healthcare Trust","ref1_contact":"James Pendleton","ref1_phone":"07901 232 445","ref1_works":"Plant room and pipework installation, Level 4 theatres","ref1_value":380000,"ref2_company":"Brindley Construction Group","ref2_contact":"Sharon Lacey","ref2_phone":"07812 009 110","ref2_works":"Full M&E pipework, office development","ref2_value":210000}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months'),
  ('pqq-001-com', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'commercial_pqq',
   '{"payment_terms_req":"30 days from certified application","retention_acceptable":"Yes","dlp_acceptable":"Yes","insurance_backed_warranty":"Yes","max_contract_value":750000}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months'),
  ('pqq-001-pol', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'modern_slavery',
   '{"ms_policy":"Yes","edi_policy":"Yes","equal_opportunities":"Yes","anti_bribery":"Yes","gdpr_compliant":"Yes"}',
   'complete', '', now() - interval '7 months', 'Tom Foreman', now() - interval '7 months')
ON CONFLICT (id) DO NOTHING;

-- PQQ Responses — Stratos Electrical (sup-002)
INSERT INTO vy_supplier_pqq_responses (id, supplier_id, org_id, section_key, responses, section_status, notes, completed_at, completed_by, updated_at) VALUES
  ('pqq-002-ci', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'company_info',
   '{"legal_status":"Limited Company","date_established":"2011-09-01 / 13 years","employee_count":52,"annual_turnover":4200000,"vat_registered":"Yes","ccj_history":"No","insolvency_history":"No"}',
   'complete', '', now() - interval '9 months', 'Tom Foreman', now() - interval '9 months'),
  ('pqq-002-hs', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'health_safety',
   '{"hs_policy":"Yes","hs_policy_reviewed":"Yes","method_statements":"Yes","toolbox_talks":"Yes","riddor_history":"No","hs_accreditation":"CHAS, Constructionline Gold, SafeContractor"}',
   'complete', '', now() - interval '9 months', 'Tom Foreman', now() - interval '9 months'),
  ('pqq-002-ins', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'insurance',
   '{"pl_limit":5000000,"pl_insurer":"RSA Group","pl_expiry":"2027-03-31","el_limit":10000000,"el_insurer":"RSA Group","el_expiry":"2027-03-31","pi_limit":1000000,"pi_expiry":"2027-03-31"}',
   'complete', '', now() - interval '9 months', 'Tom Foreman', now() - interval '9 months'),
  ('pqq-002-acc', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'accreditations',
   '{"chas":"Yes","chas_expiry":"2027-03-31","constructionline":"Yes","niceic":"Yes","gas_safe":"N/A","iso45001":"N/A","besa":"N/A","other_accreditations":""}',
   'complete', '', now() - interval '9 months', 'Tom Foreman', now() - interval '9 months'),
  ('pqq-002-wf', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'workforce',
   '{"cscs_scheme":"Yes","direct_workforce_pct":80,"gang_subcontracting":"No","apprenticeships":"Yes","nvq_training":"Yes"}',
   'complete', '', now() - interval '9 months', 'Tom Foreman', now() - interval '9 months'),
  ('pqq-002-ref', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'references',
   '{"ref1_company":"Alderton Developments Ltd","ref1_contact":"Rob Alderton","ref1_phone":"07922 881 004","ref1_works":"Full M&E electrical, Kelston Business Park Phase 1","ref1_value":520000,"ref2_company":"Nexford NHS Foundation Trust","ref2_contact":"Pauline Saunders","ref2_phone":"07811 553 667","ref2_works":"Ward rewire and nurse call system","ref2_value":290000}',
   'complete', '', now() - interval '9 months', 'Tom Foreman', now() - interval '9 months'),
  ('pqq-002-com', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'commercial_pqq',
   '{"payment_terms_req":"30 days from certified application","retention_acceptable":"Yes","dlp_acceptable":"Yes","insurance_backed_warranty":"Yes","max_contract_value":1000000}',
   'complete', '', now() - interval '9 months', 'Tom Foreman', now() - interval '9 months'),
  ('pqq-002-pol', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'modern_slavery',
   '{"ms_policy":"Yes","edi_policy":"Yes","equal_opportunities":"Yes","anti_bribery":"Yes","gdpr_compliant":"Yes"}',
   'complete', '', now() - interval '9 months', 'Tom Foreman', now() - interval '9 months')
ON CONFLICT (id) DO NOTHING;

-- PQQ Axiom Controls (sup-004)
INSERT INTO vy_supplier_pqq_responses (id, supplier_id, org_id, section_key, responses, section_status, notes, completed_at, completed_by, updated_at) VALUES
  ('pqq-004-ci',  'sup-004', 'd0000000-0000-4000-a000-000000000001', 'company_info',
   '{"legal_status":"Limited Company","date_established":"2014-02-11 / 10 years","employee_count":18,"annual_turnover":1900000,"vat_registered":"Yes","ccj_history":"No","insolvency_history":"No"}',
   'complete', '', now() - interval '6 months', 'Oliver Troman', now() - interval '6 months'),
  ('pqq-004-hs',  'sup-004', 'd0000000-0000-4000-a000-000000000001', 'health_safety',
   '{"hs_policy":"Yes","hs_policy_reviewed":"Yes","method_statements":"Yes","toolbox_talks":"Yes","riddor_history":"No","hs_accreditation":"Constructionline Silver"}',
   'complete', '', now() - interval '6 months', 'Oliver Troman', now() - interval '6 months'),
  ('pqq-004-ins', 'sup-004', 'd0000000-0000-4000-a000-000000000001', 'insurance',
   '{"pl_limit":5000000,"pl_insurer":"Hiscox","pl_expiry":"2027-02-28","el_limit":10000000,"el_insurer":"Hiscox","el_expiry":"2027-02-28","pi_limit":2000000,"pi_expiry":"2027-02-28"}',
   'complete', '', now() - interval '6 months', 'Oliver Troman', now() - interval '6 months'),
  ('pqq-004-acc', 'sup-004', 'd0000000-0000-4000-a000-000000000001', 'accreditations',
   '{"chas":"No","constructionline":"Yes","niceic":"N/A","gas_safe":"N/A","iso45001":"N/A","besa":"Yes","other_accreditations":"ISO 9001 certified (exp. 2026-11)"}',
   'complete', '', now() - interval '6 months', 'Oliver Troman', now() - interval '6 months'),
  ('pqq-004-wf',  'sup-004', 'd0000000-0000-4000-a000-000000000001', 'workforce',
   '{"cscs_scheme":"Yes","direct_workforce_pct":100,"gang_subcontracting":"No","apprenticeships":"N/A","nvq_training":"Yes"}',
   'complete', '', now() - interval '6 months', 'Oliver Troman', now() - interval '6 months'),
  ('pqq-004-ref', 'sup-004', 'd0000000-0000-4000-a000-000000000001', 'references',
   '{"ref1_company":"NHS Property Services","ref1_contact":"Tim Reardon","ref1_phone":"07741 220 980","ref1_works":"Siemens BMS installation and commissioning, 3-site NHS estate","ref1_value":320000,"ref2_company":"Brindley Construction Group","ref2_contact":"Sharon Lacey","ref2_phone":"07812 009 110","ref2_works":"BMS for commercial office development","ref2_value":145000}',
   'complete', '', now() - interval '6 months', 'Oliver Troman', now() - interval '6 months'),
  ('pqq-004-com', 'sup-004', 'd0000000-0000-4000-a000-000000000001', 'commercial_pqq',
   '{"payment_terms_req":"30 days","retention_acceptable":"Yes","dlp_acceptable":"Yes","insurance_backed_warranty":"N/A","max_contract_value":600000}',
   'complete', '', now() - interval '6 months', 'Oliver Troman', now() - interval '6 months'),
  ('pqq-004-pol', 'sup-004', 'd0000000-0000-4000-a000-000000000001', 'modern_slavery',
   '{"ms_policy":"N/A","edi_policy":"Yes","equal_opportunities":"Yes","anti_bribery":"Yes","gdpr_compliant":"Yes"}',
   'complete', '', now() - interval '6 months', 'Oliver Troman', now() - interval '6 months')
ON CONFLICT (id) DO NOTHING;

-- Labour Rates
INSERT INTO vy_supplier_labour_rates (id, supplier_id, org_id, rate_type_id, standard_rate, overtime_rate, weekend_rate, night_rate, updated_at) VALUES
  ('lr-001-trd', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'lrt-trd-001', 38.50, 57.75, 63.00, 77.00, now()),
  ('lr-001-skl', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'lrt-skl-001', 34.00, 51.00, 55.00, 68.00, now()),
  ('lr-001-lab', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'lrt-lab-001', 22.50, 33.75, 38.00, 45.00, now()),
  ('lr-001-sup', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'lrt-sup-001', 48.00, 72.00, 80.00, 96.00, now()),
  ('lr-002-trd', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'lrt-trd-001', 40.00, 60.00, 65.00, 80.00, now()),
  ('lr-002-skl', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'lrt-skl-001', 35.50, 53.25, 57.00, 71.00, now()),
  ('lr-002-sup', 'sup-002', 'd0000000-0000-4000-a000-000000000001', 'lrt-sup-001', 52.00, 78.00, 85.00, 104.00, now()),
  ('lr-004-trd', 'sup-004', 'd0000000-0000-4000-a000-000000000001', 'lrt-trd-001', 55.00, 82.50, 90.00, 110.00, now()),
  ('lr-004-pm',  'sup-004', 'd0000000-0000-4000-a000-000000000001', 'lrt-pm-001',  75.00, 112.50, 125.00, null, now()),
  ('lr-007-trd', 'sup-007', 'd0000000-0000-4000-a000-000000000001', 'lrt-trd-001', 65.00, 97.50, 105.00, null, now()),
  ('lr-007-pm',  'sup-007', 'd0000000-0000-4000-a000-000000000001', 'lrt-pm-001',  90.00, null, null, null, now())
ON CONFLICT (id) DO NOTHING;

-- Supplier Documents (no apostrophe in column values here, fixed by using dollar-quoting)
INSERT INTO vy_supplier_documents (id, supplier_id, org_id, document_category, document_title, file_name, file_type, file_size, data_url, issue_date, expiry_date, verified, verified_by, verification_date, notes, created_by, created_at) VALUES
  ('sdoc-001-pl',   'sup-001', 'd0000000-0000-4000-a000-000000000001', 'Insurance',     'Public Liability Certificate 2026-27',          'Caldwell_PL_Insurance_2026-27.pdf',       'application/pdf', 184320, '', '2026-02-01', '2027-01-31', true,  'Tom Foreman',   '2026-02-03', 'Aviva 5m PL confirmed',                              'pu-1779621355828', now() - interval '7 months'),
  ('sdoc-001-el',   'sup-001', 'd0000000-0000-4000-a000-000000000001', 'Insurance',     'Employers Liability Certificate 2026-27',        'Caldwell_EL_Insurance_2026-27.pdf',       'application/pdf', 184320, '', '2026-02-01', '2027-01-31', true,  'Tom Foreman',   '2026-02-03', 'Aviva 10m EL confirmed',                             'pu-1779621355828', now() - interval '7 months'),
  ('sdoc-001-chas', 'sup-001', 'd0000000-0000-4000-a000-000000000001', 'Accreditation', 'CHAS Certificate',                              'Caldwell_CHAS_2025-26.pdf',               'application/pdf', 92140,  '', '2025-05-01', '2027-04-30', true,  'Tom Foreman',   '2026-02-03', '',                                                   'pu-1779621355828', now() - interval '7 months'),
  ('sdoc-001-hs',   'sup-001', 'd0000000-0000-4000-a000-000000000001', 'Policy',        'Health and Safety Policy',                      'Caldwell_HS_Policy_v3.pdf',               'application/pdf', 248000, '', '2025-11-01', '',           true,  'Tom Foreman',   '2026-02-03', 'Reviewed Nov 2025, signed by Director',              'pu-1779621355828', now() - interval '7 months'),
  ('sdoc-002-pl',   'sup-002', 'd0000000-0000-4000-a000-000000000001', 'Insurance',     'Public Liability Certificate 2026-27',          'Stratos_PL_Insurance_2026-27.pdf',        'application/pdf', 201440, '', '2026-04-01', '2027-03-31', true,  'Tom Foreman',   '2026-04-05', 'RSA 5m PL verified',                                 'pu-1779621355828', now() - interval '3 months'),
  ('sdoc-002-el',   'sup-002', 'd0000000-0000-4000-a000-000000000001', 'Insurance',     'Employers Liability Certificate 2026-27',        'Stratos_EL_Insurance_2026-27.pdf',        'application/pdf', 201440, '', '2026-04-01', '2027-03-31', true,  'Tom Foreman',   '2026-04-05', 'RSA 10m EL verified',                                'pu-1779621355828', now() - interval '3 months'),
  ('sdoc-002-nic',  'sup-002', 'd0000000-0000-4000-a000-000000000001', 'Accreditation', 'NICEIC Approved Contractor Certificate',         'Stratos_NICEIC_2025-26.pdf',              'application/pdf', 112000, '', '2025-09-01', '2026-08-31', true,  'Tom Foreman',   '2026-04-05', 'NICEIC approved contractor registration confirmed',  'pu-1779621355828', now() - interval '3 months'),
  ('sdoc-004-pi',   'sup-004', 'd0000000-0000-4000-a000-000000000001', 'Insurance',     'Professional Indemnity Certificate 2026-27',    'Axiom_PI_Insurance_2026-27.pdf',          'application/pdf', 165000, '', '2026-03-01', '2027-02-28', true,  'Oliver Troman', '2026-03-10', 'Hiscox 2m PI verified',                              'pu-1779621355828', now() - interval '4 months'),
  ('sdoc-004-iso',  'sup-004', 'd0000000-0000-4000-a000-000000000001', 'Accreditation', 'ISO 9001 Certificate',                          'Axiom_ISO9001_Certificate.pdf',           'application/pdf', 88400,  '', '2023-11-15', '2026-11-14', true,  'Oliver Troman', '2026-03-10', 'BSI certified, scope covers BMS design and install', 'pu-1779621355828', now() - interval '4 months')
ON CONFLICT (id) DO NOTHING;
