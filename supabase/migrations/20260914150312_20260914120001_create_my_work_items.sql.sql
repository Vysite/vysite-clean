/*
# Create vy_my_work_items table — Personal Task Organiser

## Purpose
A lightweight personal task list ("My Work") for each authenticated VYSITE user.
Items are strictly scoped to the creating user — no other user can see, edit,
or delete another user's My Work items, including Admin users.

## New Table: vy_my_work_items
- id (uuid, PK, default gen_random_uuid())
- org_id (uuid, NOT NULL) — organisation scope
- user_id (uuid, NOT NULL, DEFAULT auth.uid()) — owner of the item
- title (text, NOT NULL) — required short title
- description (text) — optional explanation
- notes (text) — optional free-text personal notes
- project_id (text) — optional project tag for context only (no FK to avoid coupling)
- urgency (text, NOT NULL, DEFAULT 'NORMAL') — LOW | NORMAL | HIGH | URGENT
- due_date (date) — optional due date
- status (text, NOT NULL, DEFAULT 'ACTIVE') — ACTIVE | COMPLETED
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now())
- completed_at (timestamptz) — set when item is completed

## Indexes
- idx_my_work_org_user_status — (org_id, user_id, status) for fast active/completed queries
- idx_my_work_org_user_due — (org_id, user_id, due_date) for overdue and date-based filtering

## Security (RLS)
- RLS enabled on vy_my_work_items.
- Four separate policies (SELECT/INSERT/UPDATE/DELETE), all TO authenticated,
  all enforcing auth.uid() = user_id. No FOR ALL policy.
- user_id defaults to auth.uid() so inserts that omit user_id still satisfy WITH CHECK.
- No org membership check needed — user_id ownership is sufficient isolation.
  Org_id is included for data organisation and future scalability.
*/

CREATE TABLE IF NOT EXISTS vy_my_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  description text,
  notes text,
  project_id text,
  urgency text NOT NULL DEFAULT 'NORMAL',
  due_date date,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE vy_my_work_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_my_work" ON vy_my_work_items;
CREATE POLICY "select_own_my_work" ON vy_my_work_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_my_work" ON vy_my_work_items;
CREATE POLICY "insert_own_my_work" ON vy_my_work_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_my_work" ON vy_my_work_items;
CREATE POLICY "update_own_my_work" ON vy_my_work_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_my_work" ON vy_my_work_items;
CREATE POLICY "delete_own_my_work" ON vy_my_work_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_my_work_org_user_status ON vy_my_work_items (org_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_my_work_org_user_due ON vy_my_work_items (org_id, user_id, due_date);