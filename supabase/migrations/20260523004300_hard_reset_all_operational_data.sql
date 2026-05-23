/*
  # Hard reset — truncate all operational data tables

  ## Summary
  Permanently removes all records from every user-generated data table.
  This covers all demo, test, seed, and operational data created during development.
  The schema, RLS policies, and workspace settings row are preserved intact.

  ## Tables cleared
  - vy_platform_users      (all users including demo/seed users)
  - vy_projects            (all projects)
  - vy_actions             (all actions)
  - vy_snags               (all snagging tickets)
  - vy_site_forms          (all site forms / RFIs)
  - vy_tenders             (all tenders and estimating records)
  - vy_tc_records          (all testing & commissioning records)
  - vy_notifications       (all notifications)
  - vy_attachments         (all file attachments)
  - vy_project_documents   (all project documents)

  ## Tables preserved
  - vy_settings            (workspace config, branding, accent colour)

  ## Notes
  - Cascade: vy_attachments and vy_project_documents reference other tables by ID.
    Truncating those parent tables first avoids FK constraint issues.
  - After this migration the app loads with clean empty states on all pages.
  - Auto-seeding has been permanently removed from the codebase — no data returns.
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
