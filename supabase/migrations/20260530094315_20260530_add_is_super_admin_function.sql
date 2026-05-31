/*
  # Add is_super_admin() security definer function

  ## Summary
  The self-referential RLS SELECT policy on vy_super_admins creates a circular
  dependency: to read from the table you must already have a row, but checking
  for a row requires reading the table. PostgreSQL resolves this without infinite
  recursion, but it can silently return no rows on the first query in a fresh
  JWT session (the policy evaluates false before the row is found in the same
  scan). This is a known Supabase gotcha with self-referential RLS.

  ## Fix
  Create a SECURITY DEFINER function `public.is_super_admin()` that:
  - Runs as the postgres role (bypassing RLS entirely)
  - Checks whether auth.uid() has an active row in vy_super_admins
  - Returns a boolean — safe to call from the client via .rpc()

  The client calls this function instead of directly querying the table for the
  access gate. The existing RLS policies on vy_super_admins remain unchanged for
  all other operations (listing admins, updating, etc.).
*/

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vy_super_admins
    WHERE auth_user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Allow any authenticated user to call it (returns false for non-admins)
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
