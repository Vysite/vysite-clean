/*
  # Definitive final wipe — all operational data

  ## Summary
  The Bolt dev server was running an older hot-reloaded build that still had
  seeding code active (VITE_APP_ENV=development triggered it). That old in-memory
  process re-seeded the shared Supabase database after each previous wipe.

  This is the definitive final wipe. After this migration:
  - VITE_APP_ENV has been changed to 'production' in .env, forcing a dev server
    restart and ensuring the no-seed code path is active in all environments.
  - No seeding code exists anywhere in the current codebase.
  - Both Bolt and Vercel share this single Supabase project (afseqltnuovdlqynslkq).
    There is no separate database — this wipe clears data visible in both.

  ## Tables cleared (all operational data)
  - vy_platform_users      (all users including all seeded demo users)
  - vy_projects            (all projects)
  - vy_actions             (all actions)
  - vy_snags               (all snagging tickets)
  - vy_site_forms          (all site forms and RFIs)
  - vy_tenders             (all tenders)
  - vy_tc_records          (all T&C records)
  - vy_notifications       (all notifications)
  - vy_attachments         (all attachments — cleared first for FK safety)
  - vy_project_documents   (all project documents)

  ## Tables preserved
  - vy_settings            (workspace branding and config — untouched)
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
