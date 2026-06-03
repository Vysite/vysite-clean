import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Invite links always go to the public production app.
const INVITE_BASE_URL = "https://app.vysite.com";

function jsonError(msg: string, status: number, diag?: Record<string, unknown>) {
  console.error(`[resend-trial-invite] ERROR ${status}: ${msg}`, diag ?? "");
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
    .cta { display: block; margin: 28px auto 0; max-width: 260px; padding: 14px 24px; background: #f97316; color: #fff !important; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 700; text-align: center; }
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
      <h1>Your VYSITE trial is ready</h1>
      <p>Hi ${escHtml(inviteeName)},</p>
      <p>Your 14-day free trial for <strong>${escHtml(orgName)}</strong> on VYSITE has been set up — the construction project management platform.</p>
      <p>Click the button below to create your password and access your account. All modules are enabled, no restrictions.</p>
      <a href="${escHtml(inviteUrl)}" class="cta">Set Password &amp; Sign In</a>
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
      subject: `Your VYSITE trial is ready — ${orgName}`,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return { ok: false, error: errText };
  }
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller is a super admin ────────────────────────────────────
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
    const orgId = (body?.org_id as string | undefined)?.trim();
    if (!orgId) return jsonError("org_id is required", 400);

    // ── 3. Service-role client ───────────────────────────────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 4. Look up org ───────────────────────────────────────────────────────
    const { data: org } = await adminClient
      .from("organisations")
      .select("id, name")
      .eq("id", orgId)
      .maybeSingle();

    if (!org) return jsonError("Organisation not found", 404);

    // ── 5. Look up the admin platform user for this org ──────────────────────
    const { data: adminUser } = await adminClient
      .from("vy_platform_users")
      .select("name, email, auth_user_id")
      .eq("org_id", orgId)
      .eq("role", "Admin")
      .eq("status", "Active")
      .maybeSingle();

    if (!adminUser?.email) {
      return jsonError(
        "No active Admin user found for this organisation. The trial may not have been fully provisioned — delete it and create a new one.",
        404,
      );
    }

    const { name: adminName, email: adminEmail, auth_user_id: existingAuthUserId } = adminUser;

    console.log(`[resend-trial-invite] org=${orgId} (${org.name}) admin=${adminEmail}`);

    // ── 6. Check Resend key ──────────────────────────────────────────────────
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return jsonError("Email service not configured (RESEND_API_KEY missing)", 500);
    }

    // ── 7. Resolve or create auth user, generate invite link ─────────────────
    // Check if an auth user already exists for this email
    const { data: userList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = userList?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === adminEmail.toLowerCase()
    ) ?? null;

    let inviteUrl: string;
    let authUserId: string;

    if (existingAuthUser && existingAuthUser.confirmed_at) {
      // User has already set their password — generate a recovery link so they
      // can reset and get back in
      console.log(`[resend-trial-invite] User ${existingAuthUser.id} is confirmed — generating recovery link`);

      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: adminEmail,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        return jsonError(`Failed to generate recovery link: ${linkErr?.message ?? "no token returned"}`, 500);
      }

      const token = linkData.properties.hashed_token;
      inviteUrl = `${INVITE_BASE_URL}/set-password?token_hash=${encodeURIComponent(token)}&type=recovery`;
      authUserId = existingAuthUser.id;

    } else {
      // New or unconfirmed user — use generateLink(invite) which is the proven
      // single-step mechanism (creates auth user + token atomically)
      if (existingAuthUser && !existingAuthUser.confirmed_at) {
        // Delete the stale unconfirmed user so generateLink creates a fresh one
        console.log(`[resend-trial-invite] Deleting stale unconfirmed auth user ${existingAuthUser.id}`);
        await adminClient.auth.admin.deleteUser(existingAuthUser.id);
      }

      console.log(`[resend-trial-invite] Generating invite link for ${adminEmail}`);

      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: adminEmail,
        options: {
          data: {
            invited_to_org: orgId,
            invited_name: adminName,
          },
        },
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        return jsonError(`Failed to generate invite link: ${linkErr?.message ?? "no token returned"}`, 500);
      }

      const token = linkData.properties.hashed_token;
      inviteUrl = `${INVITE_BASE_URL}/set-password?token_hash=${encodeURIComponent(token)}&type=invite`;
      authUserId = linkData.user.id;

      // If the auth_user_id changed (because we deleted stale + recreated), update the platform user row
      if (existingAuthUserId && existingAuthUserId !== authUserId) {
        await adminClient
          .from("vy_platform_users")
          .update({ auth_user_id: authUserId })
          .eq("org_id", orgId)
          .eq("email", adminEmail);

        await adminClient
          .from("user_orgs")
          .update({ user_id: authUserId })
          .eq("org_id", orgId)
          .eq("user_id", existingAuthUserId);
      }
    }

    console.log(`[resend-trial-invite] Invite URL: ${inviteUrl} | auth_user_id=${authUserId}`);

    // ── 8. Send email ────────────────────────────────────────────────────────
    const emailResult = await sendInviteEmail(resendKey, adminEmail, adminName, inviteUrl, org.name);
    if (!emailResult.ok) {
      console.error(`[resend-trial-invite] Resend error:`, emailResult.error);
      return jsonError(`Failed to send invite email: ${emailResult.error}`, 502);
    }

    console.log(`[resend-trial-invite] Invite email sent to ${adminEmail}`);

    return jsonOk({
      success: true,
      message: `Invite email sent to ${adminEmail}`,
      sentTo: adminEmail,
    });

  } catch (err) {
    console.error(`[resend-trial-invite] Unexpected error:`, err);
    return jsonError(`Unexpected error: ${String(err)}`, 500);
  }
});
