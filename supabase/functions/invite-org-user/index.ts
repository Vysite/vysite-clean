import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonError(msg: string, status: number, diag?: Record<string, unknown>) {
  console.error(`[invite-org-user] ERROR ${status}: ${msg}`, diag ?? "");
  return new Response(JSON.stringify({ error: msg, _diag: diag }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonOk(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Roles in vy_platform_users that are permitted to invite other users
const INVITE_ALLOWED_ROLES = ["Admin", "Commercial Lead"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller identity via their JWT ─────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Missing Authorization header", 401);

    // Use a caller-scoped client solely to resolve auth.uid() from the JWT.
    // We intentionally avoid relying on RLS for the permission check below —
    // we use the service-role client instead to avoid RLS edge cases.
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();

    if (callerAuthErr || !callerUser) {
      return jsonError("Unauthorized: invalid or expired session", 401, {
        auth_error: callerAuthErr?.message,
      });
    }

    const callerAuthUserId = callerUser.id;
    console.log(`[invite-org-user] Caller auth.uid: ${callerAuthUserId} (${callerUser.email})`);

    // ── 2. Service-role client for all privileged lookups ───────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 3. Resolve caller's platform user record and org via service role ───
    // Using service role bypasses RLS — this is intentional because the
    // permission check must be authoritative regardless of RLS policy state.
    const { data: callerPlatformUser, error: puErr } = await adminClient
      .from("vy_platform_users")
      .select("id, role, org_id, email, status")
      .eq("auth_user_id", callerAuthUserId)
      .eq("status", "Active")
      .maybeSingle();

    console.log(`[invite-org-user] Platform user lookup:`, {
      table: "vy_platform_users",
      filter: { auth_user_id: callerAuthUserId, status: "Active" },
      result: callerPlatformUser
        ? { id: callerPlatformUser.id, role: callerPlatformUser.role, org_id: callerPlatformUser.org_id }
        : null,
      error: puErr?.message ?? null,
    });

    if (puErr) {
      return jsonError("Failed to look up your user record", 500, { db_error: puErr.message });
    }

    if (!callerPlatformUser) {
      // Caller has an auth account but no platform user record — check if
      // they are a super admin (super admins span all orgs)
      const { data: superAdmin } = await adminClient
        .from("vy_super_admins")
        .select("id, status")
        .eq("auth_user_id", callerAuthUserId)
        .eq("status", "active")
        .maybeSingle();

      if (!superAdmin) {
        return jsonError("Forbidden: no active platform user record found for your account", 403, {
          caller_auth_user_id: callerAuthUserId,
          caller_email: callerUser.email,
          diagnosis: "auth_user_id not matched in vy_platform_users with status=Active, and not in vy_super_admins",
        });
      }

      // Super admins cannot invite to org-scoped users without an explicit org context.
      // Parse org_id from the request body instead.
    }

    // Resolve the org this caller belongs to
    const callerOrgId = callerPlatformUser?.org_id ?? null;
    const callerRole = callerPlatformUser?.role ?? null;

    console.log(`[invite-org-user] Permission check:`, {
      caller_auth_user_id: callerAuthUserId,
      caller_email: callerUser.email,
      caller_org_id: callerOrgId,
      caller_role: callerRole,
      allowed_roles: INVITE_ALLOWED_ROLES,
      is_allowed: callerRole ? INVITE_ALLOWED_ROLES.includes(callerRole) : false,
    });

    if (!callerOrgId) {
      return jsonError("Forbidden: your account is not associated with an organisation", 403, {
        caller_auth_user_id: callerAuthUserId,
        diagnosis: "org_id is null on vy_platform_users row",
      });
    }

    if (!callerRole || !INVITE_ALLOWED_ROLES.includes(callerRole)) {
      return jsonError(
        `Forbidden: your role (${callerRole ?? "unknown"}) does not have permission to invite users. Required: ${INVITE_ALLOWED_ROLES.join(" or ")}`,
        403,
        {
          caller_role: callerRole,
          required_roles: INVITE_ALLOWED_ROLES,
          diagnosis: "role not in INVITE_ALLOWED_ROLES list",
        }
      );
    }

    // ── 4. Parse and validate the request body ──────────────────────────────
    const body = await req.json();
    const { email, name, role, company, assigned_project_ids, permissions, app_url } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return jsonError("Valid email address is required", 400);
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return jsonError("Name must be at least 2 characters", 400);
    }
    if (!role || typeof role !== "string") {
      return jsonError("Role is required", 400);
    }

    const orgId = callerOrgId;
    const normalizedEmail = email.trim().toLowerCase();
    const redirectUrl = `${(app_url ?? "https://app.vysite.com").replace(/\/$/, "")}/set-password`;

    console.log(`[invite-org-user] Invite params:`, {
      invitee_email: normalizedEmail,
      invitee_name: name.trim(),
      invitee_role: role,
      org_id: orgId,
      redirect_url: redirectUrl,
    });

    // ── 5. Check org user limit ─────────────────────────────────────────────
    const { data: orgSettings } = await adminClient
      .from("org_settings")
      .select("user_limit")
      .eq("org_id", orgId)
      .maybeSingle();

    if (orgSettings?.user_limit) {
      const { count } = await adminClient
        .from("vy_platform_users")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "Active");

      if ((count ?? 0) >= orgSettings.user_limit) {
        return jsonError(
          `Your organisation has reached its user limit of ${orgSettings.user_limit}. Please contact support to increase your limit.`,
          403
        );
      }
    }

    // ── 6. Check if this email is already a member of this org ──────────────
    const { data: existingMember } = await adminClient
      .from("vy_platform_users")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingMember) {
      return jsonError("This email address is already a member of your organisation", 409);
    }

    // ── 7. Send the Supabase invite email ───────────────────────────────────
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: redirectUrl,
        data: {
          invited_to_org: orgId,
          invited_name: name.trim(),
        },
      }
    );

    let authUserId: string;

    if (inviteErr) {
      console.error(`[invite-org-user] inviteUserByEmail error:`, inviteErr);

      // Email already has an auth account — reuse existing auth user id
      if (
        inviteErr.message?.includes("already been registered") ||
        (inviteErr as { code?: string }).code === "email_exists"
      ) {
        const { data: userList } = await adminClient.auth.admin.listUsers();
        const existingAuthUser = userList?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail
        );
        if (!existingAuthUser) {
          return jsonError(`Invite failed: ${inviteErr.message}`, 500);
        }
        authUserId = existingAuthUser.id;
        console.log(`[invite-org-user] Reusing existing auth user: ${authUserId}`);
      } else {
        return jsonError(`Invite failed: ${inviteErr.message}`, 500);
      }
    } else {
      authUserId = inviteData.user.id;
      console.log(`[invite-org-user] Auth user created/invited: ${authUserId}`);
    }

    // ── 8. Upsert the vy_platform_users row ─────────────────────────────────
    const initials = name.trim().split(" ").map((w: string) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
    const platformUserRow = {
      id: `pu-${authUserId}`,
      auth_user_id: authUserId,
      org_id: orgId,
      name: name.trim(),
      email: normalizedEmail,
      role: role,
      company: company ?? "",
      status: "Active",
      avatar_initials: initials,
      join_date: new Date().toISOString().split("T")[0],
      assigned_project_ids: assigned_project_ids ?? [],
      permissions: permissions && Object.keys(permissions).length > 0 ? permissions : null,
    };

    const { error: platformUserErr } = await adminClient
      .from("vy_platform_users")
      .upsert(platformUserRow, { onConflict: "id" });

    if (platformUserErr) {
      return jsonError(`Failed to create user record: ${platformUserErr.message}`, 500);
    }

    // ── 9. Insert user_orgs row to link auth user → org ─────────────────────
    // user_orgs.role constraint: platform_admin | company_owner | manager | user | viewer
    // Map from the VYSITE platform display role to the constrained user_orgs role.
    const USER_ORGS_ROLE_MAP: Record<string, string> = {
      "Admin": "company_owner",
      "Commercial Lead": "manager",
      "Project Manager": "manager",
      "Site Manager": "manager",
      "Engineer": "manager",
      "Estimator / QS": "manager",
      "Client": "viewer",
      "Client User": "viewer",
      "External / Subcontractor": "viewer",
    };
    const userOrgRole = USER_ORGS_ROLE_MAP[role] ?? "user";
    console.log(`[invite-org-user] user_orgs role mapping: "${role}" -> "${userOrgRole}"`);

    const { error: userOrgErr } = await adminClient
      .from("user_orgs")
      .upsert(
        { user_id: authUserId, org_id: orgId, role: userOrgRole, status: "active" },
        { onConflict: "user_id,org_id" }
      );

    if (userOrgErr) {
      return jsonError(`Failed to link user to organisation: ${userOrgErr.message}`, 500);
    }

    console.log(`[invite-org-user] Invite complete. auth_user_id=${authUserId} org_id=${orgId}`);

    return jsonOk({
      success: true,
      auth_user_id: authUserId,
      message: `Invitation sent to ${normalizedEmail}`,
    });

  } catch (err) {
    console.error(`[invite-org-user] Unexpected error:`, err);
    return jsonError(`Unexpected error: ${String(err)}`, 500);
  }
});
