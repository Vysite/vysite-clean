/*
  # Add missing anon DELETE policies

  ## Problem
  Two tables were missing DELETE policies for the anon role, causing delete
  operations to silently fail in production (RLS blocks without an error in
  some Supabase versions, returning 0 rows affected).

  ## Changes
  - vy_projects: add anon DELETE policy (was missing; SELECT/INSERT/UPDATE existed)
  - vy_settings: add anon DELETE policy (was missing; SELECT/INSERT/UPDATE existed)
*/

CREATE POLICY "anon can delete vy_projects"
  ON vy_projects
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "anon can delete vy_settings"
  ON vy_settings
  FOR DELETE
  TO anon
  USING (true);
