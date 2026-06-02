import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── 1. Verify the caller is an authenticated org admin ──────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Missing Authorization header", 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Resolve caller's identity and org membership in one query.
    // RLS on user_orgs ensures only active members of an org can see their own row.
    const { data: callerOrg, error: callerErr } = await callerClient
      .from("user_orgs")
      .select("org_id, role")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (callerErr || !callerOrg) {
      return jsonError("Forbidden: you must be an active org member to invite users", 403);
    }

    // Enforce that only Admin-role platform users can invite
    const { data: callerPlatformUser } = await callerClient
      .from("vy_platform_users")
      .select("role")
      .eq("org_id", callerOrg.org_id)
      .maybeSingle();

    if (!callerPlatformUser || !["Admin", "Commercial Lead"].includes(callerPlatformUser.role)) {
      return jsonError("Forbidden: only Admins can invite users", 403);
    }

    // ── 2. Parse and validate the request body ──────────────────────────────
    const body = await req.json();
    const {
      email,
      name,
      role,
      company,
      assigned_project_ids,
      permissions,
      app_url,
    } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return jsonError("Valid email address is required", 400);
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return jsonError("Name must be at least 2 characters", 400);
    }
    if (!role || typeof role !== "string") {
      return jsonError("Role is required", 400);
    }

    const orgId: string = callerOrg.org_id;
    const normalizedEmail = email.trim().toLowerCase();
    const redirectUrl = `${(app_url ?? "https://app.vysite.com").replace(/\/$/, "")}/set-password`;

    // ── 3. Service-role client for privileged operations ────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 4. Check org user limit ─────────────────────────────────────────────
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

    // ── 5. Check if this email is already a member of this org ──────────────
    const { data: existingMember } = await adminClient
      .from("vy_platform_users")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingMember) {
      return jsonError("This email address is already a member of your organisation", 409);
    }

    // ── 6. Send the Supabase invite email ───────────────────────────────────
    // inviteUserByEmail creates an auth.users record (or reuses an existing one)
    // and dispatches an email containing a magic link pointing to redirectUrl.
    // The invited user clicks the link → lands on /set-password with token_hash.
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
      // If this email already has an auth account (e.g. member of another org),
      // reuse their existing auth_user_id — no new invite email, but we still
      // add them to this org's platform users and user_orgs.
      if (
        inviteErr.message?.includes("already been registered") ||
        inviteErr.code === "email_exists"
      ) {
        const { data: userList } = await adminClient.auth.admin.listUsers();
        const existing = userList?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail
        );
        if (!existing) {
          return jsonError(`Invite failed: ${inviteErr.message}`, 500);
        }
        authUserId = existing.id;
      } else {
        return jsonError(`Invite failed: ${inviteErr.message}`, 500);
      }
    } else {
      authUserId = inviteData.user.id;
    }

    // ── 7. Upsert the vy_platform_users row ─────────────────────────────────
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

    // ── 8. Insert user_orgs row to link auth user → org ─────────────────────
    const { error: userOrgErr } = await adminClient
      .from("user_orgs")
      .upsert(
        {
          user_id: authUserId,
          org_id: orgId,
          role: "member",
          status: "active",
        },
        { onConflict: "user_id,org_id" }
      );

    if (userOrgErr) {
      return jsonError(`Failed to link user to organisation: ${userOrgErr.message}`, 500);
    }

    return jsonOk({
      success: true,
      auth_user_id: authUserId,
      message: `Invitation sent to ${normalizedEmail}`,
    });

  } catch (err) {
    return jsonError(`Unexpected error: ${String(err)}`, 500);
  }
});
