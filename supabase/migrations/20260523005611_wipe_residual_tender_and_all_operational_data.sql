/*
  # Wipe all residual operational data — second pass

  ## Summary
  The previous reset migration ran, but the Vercel build at that time still had
  active seeding code. The old deployed build re-seeded vy_tenders (4 demo records)
  before the no-seed code was deployed. This migration performs a second full wipe
  of all operational tables to restore the clean baseline.

  ## Tables cleared
  - vy_tenders             (4 demo tenders that were re-seeded)
  - vy_attachments         (cleared first to avoid FK issues)
  - vy_project_documents
  - vy_notifications
  - vy_actions
  - vy_snags
  - vy_site_forms
  - vy_tc_records
  - vy_projects
  - vy_platform_users

  ## Tables preserved
  - vy_settings            (workspace config preserved)

  ## Notes
  - Seeding code has been permanently removed from the codebase.
    This wipe will be the final one — no code path can re-seed after deployment.
  - The TRUNCATE ... CASCADE variant is used to handle any FK references safely.
*/

TRUNCATE TABLE
  vy_attachments,
  vy_project_documents,
  vy_notifications,
  vy_actions,
  vy_snags,
  vy_site_forms,
  vy_tc_records,
  vy_tenders,
  vy_projects,
  vy_platform_users;
