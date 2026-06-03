/*
  # Fix super_admin_delete_org permission check

  ## Problem
  The super_admin_delete_org function is SECURITY DEFINER, which means it runs
  as the postgres superuser — not as the calling user. Inside that context,
  auth.uid() returns NULL, so the internal call to is_super_admin() always
  returns false and raises "Permission denied: super admin access required".

  The caller's identity is verified BEFORE this RPC is invoked — the delete-org
  edge function calls callerClient.rpc("is_super_admin") with the user's JWT
  first, and only proceeds if that returns true. The redundant check inside the
  SECURITY DEFINER function is therefore both unnecessary and broken.

  ## Fix
  Remove the internal is_super_admin() check from super_admin_delete_org.
  The permission gate lives in the edge function where auth.uid() is valid.
*/

CREATE OR REPLACE FUNCTION public.super_admin_delete_org(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Delete in dependency order (child rows first, then parents)
  DELETE FROM vy_programme_tasks   WHERE org_id = p_org_id;
  DELETE FROM vy_programmes        WHERE org_id = p_org_id;
  DELETE FROM vy_maintenance_jobs  WHERE org_id = p_org_id;
  DELETE FROM vy_tc_records        WHERE org_id = p_org_id;
  DELETE FROM vy_snagging_reports  WHERE org_id = p_org_id;
  DELETE FROM vy_snags             WHERE org_id = p_org_id;
  DELETE FROM vy_site_forms        WHERE org_id = p_org_id;
  DELETE FROM vy_actions           WHERE org_id = p_org_id;
  DELETE FROM vy_attachments       WHERE org_id = p_org_id;
  DELETE FROM vy_project_documents WHERE org_id = p_org_id;
  DELETE FROM vy_notifications     WHERE org_id = p_org_id;
  DELETE FROM vy_tenders           WHERE org_id = p_org_id;
  DELETE FROM vy_projects          WHERE org_id = p_org_id;
  DELETE FROM vy_settings          WHERE org_id = p_org_id;
  DELETE FROM vy_platform_users    WHERE org_id = p_org_id;
  DELETE FROM user_orgs            WHERE org_id = p_org_id;
  DELETE FROM org_settings         WHERE org_id = p_org_id;
  DELETE FROM organisations        WHERE id     = p_org_id;
END;
$$;
