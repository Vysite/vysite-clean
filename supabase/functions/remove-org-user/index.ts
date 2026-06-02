import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonError(msg: string, status: number, diag?: Record<string, unknown>) {
  console.error(`[remove-org-user] ERROR ${status}: ${msg}`, diag ?? "");
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

const REMOVE_ALLOWED_ROLES = ["Admin", "Commercial Lead"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller ────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Missing Authorization header", 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser) {
      return jsonError("Unauthorized: invalid or expired session", 401);
    }

    // ── 2. Service-role client ──────────────────────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 3. Verify caller is Admin in their org ──────────────────────────────
    const { data: callerPu } = await adminClient
      .from("vy_platform_users")
      .select("role, org_id")
      .eq("auth_user_id", callerUser.id)
      .eq("status", "Active")
      .maybeSingle();

    if (!callerPu || !REMOVE_ALLOWED_ROLES.includes(callerPu.role)) {
      return jsonError("Forbidden: only Admins can remove users", 403, {
        caller_role: callerPu?.role ?? null,
      });
    }

    // ── 4. Parse request body ───────────────────────────────────────────────
    const { platform_user_id } = await req.json();
    if (!platform_user_id || typeof platform_user_id !== "string") {
      return jsonError("platform_user_id is required", 400);
    }

    // ── 5. Look up the target platform user ─────────────────────────────────
    const { data: targetPu } = await adminClient
      .from("vy_platform_users")
      .select("id, auth_user_id, org_id, email, name")
      .eq("id", platform_user_id)
      .maybeSingle();

    if (!targetPu) {
      return jsonError("User not found", 404);
    }

    // Prevent removing someone from a different org
    if (targetPu.org_id !== callerPu.org_id) {
      return jsonError("Forbidden: cannot remove users from a different organisation", 403);
    }

    // Prevent self-removal
    if (targetPu.auth_user_id === callerUser.id) {
      return jsonError("You cannot remove your own account", 400);
    }

    console.log(`[remove-org-user] Removing user: ${targetPu.email} (${targetPu.auth_user_id}) from org ${targetPu.org_id}`);

    const results: Record<string, string> = {};

    // ── 6. Delete vy_platform_users row ─────────────────────────────────────
    const { error: puErr } = await adminClient
      .from("vy_platform_users")
      .delete()
      .eq("id", platform_user_id);

    results.vy_platform_users = puErr ? `error: ${puErr.message}` : "deleted";

    // ── 7. Delete user_orgs row ─────────────────────────────────────────────
    if (targetPu.auth_user_id) {
      const { error: uoErr } = await adminClient
        .from("user_orgs")
        .delete()
        .eq("user_id", targetPu.auth_user_id)
        .eq("org_id", targetPu.org_id);

      results.user_orgs = uoErr ? `error: ${uoErr.message}` : "deleted";

      // ── 8. Delete auth.users — only if they have no other org memberships ──
      const { count: otherOrgCount } = await adminClient
        .from("user_orgs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetPu.auth_user_id);

      if ((otherOrgCount ?? 0) === 0) {
        const { error: authErr } = await adminClient.auth.admin.deleteUser(targetPu.auth_user_id);
        results.auth_user = authErr ? `error: ${authErr.message}` : "deleted";
        console.log(`[remove-org-user] auth.users deletion result:`, results.auth_user);
      } else {
        results.auth_user = `skipped: user belongs to ${otherOrgCount} other org(s)`;
        console.log(`[remove-org-user] Skipped auth deletion — user has other org memberships`);
      }
    } else {
      results.user_orgs = "skipped: no auth_user_id";
      results.auth_user = "skipped: no auth_user_id";
    }

    console.log(`[remove-org-user] Removal complete for ${targetPu.email}:`, results);

    return jsonOk({
      success: true,
      removed_email: targetPu.email,
      results,
    });

  } catch (err) {
    console.error(`[remove-org-user] Unexpected error:`, err);
    return jsonError(`Unexpected error: ${String(err)}`, 500);
  }
});
