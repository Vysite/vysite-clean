/*
  # Maintenance & Servicing Module — vy_maintenance_jobs

  ## Summary
  Adds the core table for the new Maintenance & Servicing module.

  ## New Tables

  ### vy_maintenance_jobs
  Each row represents one maintenance/service job.

  | Column              | Type          | Notes                                      |
  |---------------------|---------------|--------------------------------------------|
  | id                  | text PK       | Client-generated (mj-<timestamp>)          |
  | org_id              | uuid NOT NULL | Multi-tenancy scoping (matches other tables)|
  | job_number          | text NOT NULL | Auto-generated display ref (e.g. MJ-0001)  |
  | client_name         | text          |                                            |
  | site_address        | text          |                                            |
  | contact_name        | text          |                                            |
  | contact_number      | text          |                                            |
  | assigned_engineer   | text          |                                            |
  | description         | text          | Job description                            |
  | priority            | text          | Low / Medium / High / Critical             |
  | status              | text          | Job lifecycle status                       |
  | engineer_notes      | text          |                                            |
  | internal_notes      | text          |                                            |
  | materials           | jsonb         | Array of { item, qty, unit } objects       |
  | comments            | jsonb         | Array of { id, user, datetime, text }      |
  | target_date         | text          |                                            |
  | completion_date     | text          |                                            |
  | created_at          | timestamptz   | Auto-set on insert                         |
  | updated_at          | timestamptz   | Auto-set on insert/update                  |

  ## Security
  - RLS enabled
  - Org-scoped read: all org members can read their org's jobs
  - Write (insert/update/delete): org managers and above only
  - Engineers get read-only by default; can be granted write via permission overrides
*/

CREATE TABLE IF NOT EXISTS vy_maintenance_jobs (
  id                text PRIMARY KEY,
  org_id            uuid NOT NULL,
  job_number        text NOT NULL DEFAULT '',
  client_name       text NOT NULL DEFAULT '',
  site_address      text NOT NULL DEFAULT '',
  contact_name      text NOT NULL DEFAULT '',
  contact_number    text NOT NULL DEFAULT '',
  assigned_engineer text NOT NULL DEFAULT '',
  description       text NOT NULL DEFAULT '',
  priority          text NOT NULL DEFAULT 'Medium',
  status            text NOT NULL DEFAULT 'New Job',
  engineer_notes    text NOT NULL DEFAULT '',
  internal_notes    text NOT NULL DEFAULT '',
  materials         jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments          jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_date       text NOT NULL DEFAULT '',
  completion_date   text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_vy_maintenance_jobs_org_id
  ON vy_maintenance_jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_vy_maintenance_jobs_status
  ON vy_maintenance_jobs (org_id, status);
CREATE INDEX IF NOT EXISTS idx_vy_maintenance_jobs_engineer
  ON vy_maintenance_jobs (org_id, assigned_engineer);

-- Row Level Security
ALTER TABLE vy_maintenance_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read maintenance jobs"
  ON vy_maintenance_jobs FOR SELECT
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_member(auth.uid(), org_id)
  );

CREATE POLICY "Org managers can insert maintenance jobs"
  ON vy_maintenance_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );

CREATE POLICY "Org managers can update maintenance jobs"
  ON vy_maintenance_jobs FOR UPDATE
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );

CREATE POLICY "Org managers can delete maintenance jobs"
  ON vy_maintenance_jobs FOR DELETE
  TO authenticated
  USING (
    org_id IS NOT NULL
    AND is_org_manager_or_above(auth.uid(), org_id)
  );
