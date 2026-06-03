import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonError(msg: string, status: number, diag?: Record<string, unknown>) {
  console.error(`[delete-org] ERROR ${status}: ${msg}`, diag ?? "");
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller is a super admin ───────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Missing Authorization header", 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: isSuperAdmin } = await callerClient.rpc("is_super_admin");
    if (!isSuperAdmin) {
      return jsonError("Forbidden: super admin access required", 403);
    }

    // ── 2. Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const orgId = body?.org_id as string | undefined;
    if (!orgId) return jsonError("org_id is required", 400);

    // ── 3. Service-role client ───────────────────────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 4. Collect auth user IDs for all platform users in this org ──────────
    // Must be done BEFORE the RPC deletes the platform_users rows.
    const { data: platformUsers, error: puErr } = await adminClient
      .from("vy_platform_users")
      .select("auth_user_id")
      .eq("org_id", orgId);

    if (puErr) {
      return jsonError(`Failed to look up platform users: ${puErr.message}`, 500);
    }

    const authUserIds: string[] = (platformUsers ?? [])
      .map((u: { auth_user_id: string | null }) => u.auth_user_id)
      .filter((id): id is string => !!id);

    console.log(`[delete-org] org_id=${orgId} — found ${authUserIds.length} auth user(s) to delete`);

    // ── 5. Run the RPC to delete all application data ────────────────────────
    const { error: rpcErr } = await adminClient.rpc("super_admin_delete_org", { p_org_id: orgId });
    if (rpcErr) {
      return jsonError(`Delete failed: ${rpcErr.message}`, 500);
    }

    console.log(`[delete-org] RPC complete — org data deleted`);

    // ── 6. Delete auth users ─────────────────────────────────────────────────
    // The RPC has already removed vy_platform_users and user_orgs rows.
    // Now remove the auth.users records so the email can be re-used.
    const deleteErrors: string[] = [];
    for (const authUserId of authUserIds) {
      const { error: delErr } = await adminClient.auth.admin.deleteUser(authUserId);
      if (delErr) {
        // Log but continue — don't let a single auth user deletion block the rest
        console.error(`[delete-org] Failed to delete auth user ${authUserId}:`, delErr.message);
        deleteErrors.push(`${authUserId}: ${delErr.message}`);
      } else {
        console.log(`[delete-org] Deleted auth user ${authUserId}`);
      }
    }

    if (deleteErrors.length > 0) {
      return jsonOk({
        success: true,
        partialAuthErrors: deleteErrors,
        message: `Organisation deleted. ${authUserIds.length - deleteErrors.length}/${authUserIds.length} auth users removed. Some auth users could not be deleted: ${deleteErrors.join("; ")}`,
      });
    }

    return jsonOk({
      success: true,
      deletedAuthUsers: authUserIds.length,
      message: `Organisation and all associated data deleted (${authUserIds.length} user account(s) removed).`,
    });

  } catch (err) {
    console.error(`[delete-org] Unexpected error:`, err);
    return jsonError(`Unexpected error: ${String(err)}`, 500);
  }
});
