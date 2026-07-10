-- ============================================================
-- DEMO DATA — Part 5: Key Dates
-- ============================================================

INSERT INTO vy_key_dates (id, org_id, project_id, project_name, title, date, description, comments, status, created_by, created_date, updated_at) VALUES

-- Hartfield Medical Centre
('kd-hmc-01', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment', 'Contract Start Date', '2026-01-13', 'Formal contract commencement date. All preliminaries mobilised.', '', 'Complete', 'Tom Foreman', '2026-01-08', now()),
('kd-hmc-02', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment', 'Strip-out Complete', '2026-02-07', 'All existing M&E strip-out to be complete prior to first fix commencing.', 'Completed on schedule.', 'Complete', 'Tom Foreman', '2026-01-08', now()),
('kd-hmc-03', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment', 'AHU Delivery to Site', '2026-04-14', 'Specialist AHU delivery — Carrier 30RBS unit. Requires crane lift and temporary road closure permit.', 'Delivered on revised date following EWN-002 lead time issue. No programme impact.', 'Complete', 'Tom Foreman', '2026-02-20', now()),
('kd-hmc-04', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment', 'Commissioning Start', '2026-06-09', 'Caldwell Pipework to flush and balance LTHW and CHW systems. Vertex Commissioning attending.', 'Started 2 days late due to outstanding snagging on FCU connections.', 'In Progress', 'Tom Foreman', '2026-03-01', now()),
('kd-hmc-05', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment', 'Client Witnessing', '2026-07-28', 'Client and Trust facilities team to witness commissioning of LTHW, CHW and ventilation systems.', '', 'Upcoming', 'Tom Foreman', '2026-03-01', now()),
('kd-hmc-06', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment', 'Practical Completion', '2026-10-31', 'Target PC date. 12-month DLP commences from this date.', '', 'Upcoming', 'Tom Foreman', '2026-01-08', now()),
('kd-hmc-07', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment', 'O&M Manual Submission', '2026-09-30', 'Full O&M manual to be submitted to client 4 weeks prior to PC.', '', 'Upcoming', 'Oliver Troman', '2026-03-01', now()),
('kd-hmc-08', 'd0000000-0000-4000-a000-000000000001', 'p1780569420807', 'Hartfield Medical Centre — M&E Refurbishment', 'Boiler Room Acceptance Test', '2026-07-03', 'Formal acceptance test for new boiler plant. Client, Trust engineer and Brindley PM to attend.', '', 'Upcoming', 'Tom Foreman', '2026-05-15', now()),

-- Kelston Business Park
('kd-kbp-01', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E', 'Contract Start Date', '2025-09-08', 'Contract commencement. Site mobilisation week commencing 8 September.', '', 'Complete', 'Oliver Troman', '2025-09-01', now()),
('kd-kbp-02', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E', 'Block A Practical Completion', '2026-05-22', 'Block A first to achieve PC. Tenant fit-out commences immediately.', 'PC achieved on 2026-05-22 as planned.', 'Complete', 'Oliver Troman', '2025-09-01', now()),
('kd-kbp-03', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E', 'Block C Practical Completion', '2026-06-14', 'Block C PC — shell and core complete, BMS commissioned.', 'PC achieved 2026-06-14.', 'Complete', 'Oliver Troman', '2025-09-01', now()),
('kd-kbp-04', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E', 'Block B Practical Completion', '2026-08-29', 'Final block PC. VRF variation works for units 14-18 to be complete before this date.', '', 'Upcoming', 'Oliver Troman', '2025-09-01', now()),
('kd-kbp-05', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000002', 'Kelston Business Park — New Build M&E', 'Final Account Submission', '2026-10-31', 'Target date for submission of final account to Alderton Developments. All variations to be agreed by PC.', '', 'Upcoming', 'Oliver Troman', '2026-03-15', now()),

-- Moorside Primary School
('kd-mps-01', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000003', 'Moorside Primary School — Heating and Ventilation Upgrade', 'Contract Start Date', '2026-03-03', 'Works during school Easter break. All noisy works to be completed before children return.', 'Started on time.', 'Complete', 'Tom Foreman', '2026-02-25', now()),
('kd-mps-02', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000003', 'Moorside Primary School — Heating and Ventilation Upgrade', 'Easter Shutdown Period', '2026-04-13', 'Intensive works during 2-week Easter break. All boiler plant and main distribution to be complete.', 'Boiler plant complete. Distribution 80% first fix done.', 'Complete', 'Tom Foreman', '2026-02-25', now()),
('kd-mps-03', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000003', 'Moorside Primary School — Heating and Ventilation Upgrade', 'Summer Works Period', '2026-07-22', 'Full access during 6-week summer holiday. Classroom radiator second fix, controls and commissioning.', '', 'Upcoming', 'Tom Foreman', '2026-02-25', now()),
('kd-mps-04', 'd0000000-0000-4000-a000-000000000001', 'p-demo-00000000003', 'Moorside Primary School — Heating and Ventilation Upgrade', 'Practical Completion', '2026-09-12', 'All works complete before new school year commences.', '', 'Upcoming', 'Tom Foreman', '2026-02-25', now())

ON CONFLICT (id) DO NOTHING;
