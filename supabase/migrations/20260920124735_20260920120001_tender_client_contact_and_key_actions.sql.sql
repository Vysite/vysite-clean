/*
# Add Tender Client Contact fields + Tender Key Actions table

## 1. New columns on vy_tenders (additive, no data loss)
- `client_contact_name` (text, nullable) — Contact name at the client organisation
- `client_contact_title` (text, nullable) — Job title of the contact
- `client_contact_email` (text, nullable) — Email of the contact
- `client_contact_phone` (text, nullable) — Telephone of the contact

These are optional tender-specific fields. No existing rows are modified —
all new columns default to NULL and historic tenders are unaffected.

## 2. New table: vy_tender_key_actions
Lightweight tender action tracking — a simple list of key actions per tender.

- `id` (uuid PK, default gen_random_uuid())
- `org_id` (uuid, not null) — tenant isolation
- `tender_id` (text, not null) — FK-like reference to vy_tenders(id)
- `title` (text, not null) — action text
- `due_date` (date, nullable) — optional due date
- `status` (text, not null, default 'Open') — 'Open' | 'Completed'
- `completed_at` (timestamptz, nullable) — set when action is completed
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
- `created_by` (text, nullable) — name of the user who created the action

## 3. Security
- RLS enabled on vy_tender_key_actions
- Org-scoped CRUD policies using is_org_member(org_id) — same pattern as other
  vy_ tables. All four verbs (SELECT/INSERT/UPDATE/DELETE) scoped to authenticated
  org members.
- No changes to existing vy_tenders RLS — new columns are covered by existing
  policies automatically.

## 4. Indexes
- Index on (org_id, tender_id) for efficient lookup by tender
- Index on (org_id, status) for filtering open/completed

## Notes
- Historic next_action text on vy_tenders is NOT migrated into key actions —
  it remains on the tender row and is still read/written by existing code.
- No existing rows are modified or deleted.
*/

-- 1. Add client contact columns to vy_tenders
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_tenders' AND column_name = 'client_contact_name') THEN
    ALTER TABLE vy_tenders ADD COLUMN client_contact_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_tenders' AND column_name = 'client_contact_title') THEN
    ALTER TABLE vy_tenders ADD COLUMN client_contact_title text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_tenders' AND column_name = 'client_contact_email') THEN
    ALTER TABLE vy_tenders ADD COLUMN client_contact_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vy_tenders' AND column_name = 'client_contact_phone') THEN
    ALTER TABLE vy_tenders ADD COLUMN client_contact_phone text;
  END IF;
END $$;

-- 2. Create vy_tender_key_actions table
CREATE TABLE IF NOT EXISTS vy_tender_key_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  tender_id text NOT NULL,
  title text NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'Open',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

ALTER TABLE vy_tender_key_actions ENABLE ROW LEVEL SECURITY;

-- Org-scoped CRUD policies (same is_org_member pattern as other vy_ tables)
DROP POLICY IF EXISTS "select_own_tender_key_actions" ON vy_tender_key_actions;
CREATE POLICY "select_own_tender_key_actions" ON vy_tender_key_actions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_orgs WHERE user_orgs.org_id = vy_tender_key_actions.org_id AND user_orgs.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_own_tender_key_actions" ON vy_tender_key_actions;
CREATE POLICY "insert_own_tender_key_actions" ON vy_tender_key_actions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_orgs WHERE user_orgs.org_id = vy_tender_key_actions.org_id AND user_orgs.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_own_tender_key_actions" ON vy_tender_key_actions;
CREATE POLICY "update_own_tender_key_actions" ON vy_tender_key_actions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_orgs WHERE user_orgs.org_id = vy_tender_key_actions.org_id AND user_orgs.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM user_orgs WHERE user_orgs.org_id = vy_tender_key_actions.org_id AND user_orgs.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_own_tender_key_actions" ON vy_tender_key_actions;
CREATE POLICY "delete_own_tender_key_actions" ON vy_tender_key_actions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_orgs WHERE user_orgs.org_id = vy_tender_key_actions.org_id AND user_orgs.user_id = auth.uid()));

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_tender_key_actions_org_tender ON vy_tender_key_actions (org_id, tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_key_actions_org_status ON vy_tender_key_actions (org_id, status);
