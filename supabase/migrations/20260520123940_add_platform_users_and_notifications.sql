/*
  # Platform Users & Notifications — Phase 1 Governance Layer

  ## New Tables

  ### `vy_platform_users`
  Stores team members with operational role and company context.
  - id, name, email, role (Admin | Manager | User | Client User)
  - company, status (Active | Inactive), avatar_initials, join_date
  - assigned_project_ids: array of project IDs the user is assigned to

  ### `vy_notifications`
  In-app operational alerts linked to records.
  - id, recipient_id (references platform user), type (action_assigned | snag_assigned | overdue | form_submitted | comment_added)
  - title, body, linked_type, linked_id, project_id, project_name
  - read (boolean, default false), created_at

  ## Security
  - RLS enabled on both tables
  - Anon can read/insert/update/delete for demo purposes (no auth yet)
*/

CREATE TABLE IF NOT EXISTS vy_platform_users (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'User',
  company text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  avatar_initials text NOT NULL DEFAULT '',
  join_date text NOT NULL DEFAULT '',
  assigned_project_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vy_platform_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read platform users"
  ON vy_platform_users FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert platform users"
  ON vy_platform_users FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update platform users"
  ON vy_platform_users FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete platform users"
  ON vy_platform_users FOR DELETE
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS vy_notifications (
  id text PRIMARY KEY,
  recipient_id text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  linked_type text NOT NULL DEFAULT '',
  linked_id text NOT NULL DEFAULT '',
  project_id text NOT NULL DEFAULT '',
  project_name text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vy_notifications_recipient_idx ON vy_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS vy_notifications_read_idx ON vy_notifications(read);

ALTER TABLE vy_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read notifications"
  ON vy_notifications FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert notifications"
  ON vy_notifications FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update notifications"
  ON vy_notifications FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete notifications"
  ON vy_notifications FOR DELETE
  TO anon
  USING (true);
