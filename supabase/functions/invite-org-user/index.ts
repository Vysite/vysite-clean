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

// Invite links are sent to external recipients who must always land on the
// public production app. dev.vysite.com and localhost are internal environments
// behind Vercel protection — recipients cannot access them.
const INVITE_BASE_URL = "https://app.vysite.com";

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function sendInviteEmail(
  resendKey: string,
  inviteeEmail: string,
  inviteeName: string,
  inviteUrl: string,
  orgName: string,
): Promise<{ ok: boolean; error?: string }> {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; margin: 0; padding: 32px 16px; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #0d1628; padding: 32px; text-align: center; }
    .logo { display: inline-flex; align-items: center; gap: 10px; }
    .logo-icon { width: 44px; height: 44px; background: #f97316; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #fff; }
    .logo-text { font-size: 22px; font-weight: 900; color: #fff; letter-spacing: -0.5px; }
    .logo-text span { color: #f97316; }
    .body { padding: 36px 32px; }
    h1 { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f172a; }
    p { margin: 0 0 16px; font-size: 15px; color: #475569; line-height: 1.6; }
    .cta { display: block; margin: 28px auto 0; max-width: 240px; padding: 14px 24px; background: #f97316; color: #fff !important; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 700; text-align: center; }
    .url-box { margin: 20px 0 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748b; word-break: break-all; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
    .footer a { color: #f97316; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">V</div>
        <div class="logo-text">VY<span>SITE</span></div>
      </div>
    </div>
    <div class="body">
      <h1>You've been invited to VYSITE</h1>
      <p>Hi ${escHtml(inviteeName)},</p>
      <p>You've been invited to join <strong>${escHtml(orgName)}</strong> on VYSITE — the construction project management platform.</p>
      <p>Click the button below to create your password and access your account.</p>
      <a href="${escHtml(inviteUrl)}" class="cta">Create your password</a>
      <div class="url-box">
        <strong>Link not working?</strong> Copy and paste this URL into your browser:<br />
        ${escHtml(inviteUrl)}
      </div>
      <p style="margin-top:20px;font-size:13px;color:#94a3b8;">This invite link expires in 24 hours. If you did not expect this invitation, you can ignore this email.</p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} VYSITE &mdash; Authorised access only &mdash; <a href="mailto:hello@vysite.com">hello@vysite.com</a>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "VYSITE <noreply@vysite.com>",
      to: [inviteeEmail],
      subject: `You've been invited to VYSITE — ${orgName}`,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText };
  }
  return { ok: true };
}

// Roles in vy_platform_users that are permitted to invite other users
const INVITE_ALLOWED_ROLES = ["Admin", "Commercial Lead"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller identity ───────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonError("Missing Authorization header", 401);

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
    console.log(`[invite-org-user] Caller: ${callerAuthUserId} (${callerUser.email})`);

    // ── 2. Service-role client ──────────────────────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 3. Resolve caller's platform user record ────────────────────────────
    const { data: callerPu, error: puErr } = await adminClient
      .from("vy_platform_users")
      .select("id, role, org_id, email, status")
      .eq("auth_user_id", callerAuthUserId)
      .eq("status", "Active")
      .maybeSingle();

    if (puErr) {
      return jsonError("Failed to look up your user record", 500, { db_error: puErr.message });
    }

    if (!callerPu) {
      const { data: superAdmin } = await adminClient
        .from("vy_super_admins")
        .select("id, status")
        .eq("auth_user_id", callerAuthUserId)
        .eq("status", "active")
        .maybeSingle();

      if (!superAdmin) {
        return jsonError("Forbidden: no active platform user record found for your account", 403, {
          caller_auth_user_id: callerAuthUserId,
        });
      }
    }

    const callerOrgId = callerPu?.org_id ?? null;
    const callerRole = callerPu?.role ?? null;

    if (!callerOrgId) {
      return jsonError("Forbidden: your account is not associated with an organisation", 403);
    }

    if (!callerRole || !INVITE_ALLOWED_ROLES.includes(callerRole)) {
      return jsonError(
        `Forbidden: your role (${callerRole ?? "unknown"}) does not have permission to invite users`,
        403,
        { caller_role: callerRole, required_roles: INVITE_ALLOWED_ROLES }
      );
    }

    // ── 4. Parse request body ───────────────────────────────────────────────
    const body = await req.json();
    const { email, name, role, company, assigned_project_ids, permissions } = body;

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

    const baseUrl = INVITE_BASE_URL;
    console.log(`[invite-org-user] Base URL: ${baseUrl} (Origin: ${req.headers.get("Origin") ?? "none"})`);

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

    // ── 7. Look up org name for email ───────────────────────────────────────
    const { data: orgRow } = await adminClient
      .from("organisations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    const orgName = orgRow?.name ?? "VYSITE";

    // ── 8. Check Resend key ─────────────────────────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return jsonError("Email service not configured (RESEND_API_KEY missing)", 500);
    }

    // ── 9. Resolve existing auth user ───────────────────────────────────────
    const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = userList?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === normalizedEmail
    ) ?? null;

    let authUserId: string;
    let inviteUrl: string;

    if (existingAuthUser && existingAuthUser.confirmed_at) {
      // ── Confirmed user: generate a password-reset link ──────────────────
      // generateLink with type 'recovery' produces a token_hash we can use
      // in our own URL without relying on Supabase's redirect allow-list.
      console.log(`[invite-org-user] Existing confirmed user ${existingAuthUser.id} — generating recovery link`);

      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        console.error(`[invite-org-user] generateLink(recovery) error:`, linkErr);
        return jsonError(`Failed to generate password reset link: ${linkErr?.message ?? "no token returned"}`, 500);
      }

      const token = linkData.properties.hashed_token;
      inviteUrl = `${baseUrl}/set-password?token_hash=${encodeURIComponent(token)}&type=recovery`;
      authUserId = existingAuthUser.id;

    } else {
      // ── New or unconfirmed user: generate an invite link ────────────────
      // generateLink with type 'invite' creates or re-uses the auth user
      // and returns a hashed_token we build into our own URL.
      console.log(`[invite-org-user] New/unconfirmed user — generating invite link`);

      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          data: {
            invited_to_org: orgId,
            invited_name: name.trim(),
          },
        },
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        console.error(`[invite-org-user] generateLink(invite) error:`, linkErr);
        return jsonError(`Failed to generate invite link: ${linkErr?.message ?? "no token returned"}`, 500);
      }

      const token = linkData.properties.hashed_token;
      inviteUrl = `${baseUrl}/set-password?token_hash=${encodeURIComponent(token)}&type=invite`;
      authUserId = linkData.user.id;
    }

    console.log(`[invite-org-user] Invite URL: ${inviteUrl}`);

    // ── 10. Send email via Resend ───────────────────────────────────────────
    const emailResult = await sendInviteEmail(resendKey, normalizedEmail, name.trim(), inviteUrl, orgName);
    if (!emailResult.ok) {
      console.error(`[invite-org-user] Resend error:`, emailResult.error);
      return jsonError(`Failed to send invite email: ${emailResult.error}`, 502);
    }

    console.log(`[invite-org-user] Invite email sent to ${normalizedEmail} | auth_user_id=${authUserId}`);

    // ── 11. Upsert vy_platform_users row ────────────────────────────────────
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

    // ── 12. Upsert user_orgs row ─────────────────────────────────────────────
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

    const { error: userOrgErr } = await adminClient
      .from("user_orgs")
      .upsert(
        { user_id: authUserId, org_id: orgId, role: userOrgRole, status: "active" },
        { onConflict: "user_id,org_id" }
      );

    if (userOrgErr) {
      return jsonError(`Failed to link user to organisation: ${userOrgErr.message}`, 500);
    }

    console.log(`[invite-org-user] Complete. auth_user_id=${authUserId} org_id=${orgId} base_url=${baseUrl}`);

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
