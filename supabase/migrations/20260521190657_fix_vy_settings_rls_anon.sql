/*
  # Fix vy_settings RLS policies for anon access

  The app uses the Supabase anon key (not authenticated JWT), so policies
  must allow anon role, not just authenticated.

  Drops the authenticated policies and replaces with anon-compatible ones.
*/

DROP POLICY IF EXISTS "Authenticated users can read settings" ON vy_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON vy_settings;

CREATE POLICY "anon can read settings"
  ON vy_settings FOR SELECT TO anon USING (true);

CREATE POLICY "anon can insert settings"
  ON vy_settings FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon can update settings"
  ON vy_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
