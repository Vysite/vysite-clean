import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NOTIFY_EMAIL = "hello@vysite.com";
const TRIAL_DAYS = 14;

// Invite links go to the public production app — always.
// dev.vysite.com is behind Vercel protection and external recipients cannot
// access it. Localhost is obviously not reachable. We never trust SITE_URL
// from the Supabase environment (it is a project-internal URL, not the app).
const INVITE_BASE_URL = "https://app.vysite.com";

const DEFAULT_MODULES = {
  tenders: true,
  projects: true,
  maintenance: true,
  "site-forms": true,
  snagging: true,
  actions: true,
  testing: true,
  reports: true,
  commercial: true,
};

// Full Admin role permissions — mirrors ROLE_PERMISSIONS['Admin'] in store.ts
const ADMIN_PERMISSIONS = {
  "projects.view_all": true, "projects.view_assigned": true, "projects.create": true,
  "projects.edit": true, "projects.archive": true, "projects.delete": true,
  "tender.view": true, "tender.rfi.create": true, "tender.rfi.edit": true, "tender.rfi.delete": true,
  "tender.assumptions.edit": true, "tender.exclusions.edit": true, "tender.scope_notes.edit": true,
  "tender.risks.edit": true, "tender.reclassify": true, "tender.reconcile": true,
  "commercial.view_pricing": true, "commercial.edit_pricing": true, "commercial.view_rates": true,
  "commercial.view_values": true, "commercial.view_reports": true, "commercial.export_reports": true,
  "commercial.edit_project_finance_progress": true,
  "ai.upload_docs": true, "ai.run_review": true, "ai.approve_findings": true, "ai.reconcile": true,
  "ai.import": true, "ai.export": true,
  "docs.view": true, "docs.upload": true, "docs.download": true, "docs.delete": true, "docs.view_confidential": true,
  "admin.invite_users": true, "admin.edit_users": true, "admin.assign_permissions": true,
  "admin.view_audit_logs": true, "admin.manage_settings": true,
  "modules.projects": true, "modules.snagging": true, "modules.site_forms": true, "modules.testing": true,
  "modules.actions": true, "modules.comments": true, "modules.reports": true,
  "modules.commercial": true,
  "snagging.create": true, "snagging.edit": true, "snagging.delete": true, "snagging.export": true,
  "actions.create": true, "actions.edit": true, "actions.delete": true, "actions.export": true,
  "site_forms.create": true, "site_forms.edit": true, "site_forms.delete": true, "site_forms.export": true,
  "commissioning.create": true, "commissioning.edit": true, "commissioning.delete": true, "commissioning.export": true,
  "maintenance.view": true, "maintenance.create": true, "maintenance.edit": true, "maintenance.delete": true,
  "maintenance.assign": true, "maintenance.export": true, "maintenance.comment": true, "maintenance.upload": true, "maintenance.complete": true,
  "programmes.view": true, "programmes.create": true, "programmes.edit": true, "programmes.delete": true, "programmes.export": true,
  "commercial.create": true, "commercial.edit": true, "commercial.delete": true,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    const msg = `No RESEND_API_KEY configured`;
    console.error(`[provision-trial-org] ${msg}`);
    return { ok: false, error: msg };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VYSITE <noreply@vysite.com>",
        to: [to],
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[provision-trial-org] Resend error for ${to}:`, errText);
      return { ok: false, error: errText };
    }
    return { ok: true };
  } catch (e) {
    const msg = String(e);
    console.error(`[provision-trial-org] Resend fetch failed:`, msg);
    return { ok: false, error: msg };
  }
}

async function sendOnboardingEmail(
  inviteUrl: string,
  adminName: string,
  adminEmail: string,
  companyName: string,
  trialExpiresAt: string,
): Promise<{ ok: boolean; error?: string }> {
  const firstName = adminName.split(/\s+/)[0];
  const expiryFormatted = new Date(trialExpiresAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:28px 40px;">
            <span style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px;">VY<span style="color:#f97316;">SITE</span></span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#111827;line-height:1.3;">
              Welcome to VYSITE, ${firstName}.
            </h1>
            <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
              Your 14-day free trial for <strong>${companyName}</strong> is ready. Click the button below to set your password and access your account.
            </p>
            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;">
              Your trial is active until <strong>${expiryFormatted}</strong>. All modules are enabled — no restrictions.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#f97316;">
                  <a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;border-radius:8px;">
                    Set Password &amp; Sign In
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
              This link expires in 24 hours. If you didn't request this, you can ignore this email.<br>
              Or copy this URL into your browser:<br>
              <span style="color:#6b7280;word-break:break-all;">${inviteUrl}</span>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              VYSITE &mdash; Built for construction professionals &mdash;
              <a href="mailto:hello@vysite.com" style="color:#f97316;text-decoration:none;">hello@vysite.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Welcome to VYSITE, ${firstName}.`,
    ``,
    `Your 14-day free trial for ${companyName} is ready.`,
    ``,
    `Set your password and sign in here:`,
    inviteUrl,
    ``,
    `Trial active until: ${expiryFormatted}`,
    `All modules are enabled — no restrictions.`,
    ``,
    `This link expires in 24 hours.`,
    `Questions? Email hello@vysite.com`,
  ].join("\n");

  return sendViaResend(adminEmail, `Your VYSITE trial is ready — set your password`, html, text);
}

async function sendNotificationEmail(
  companyName: string,
  adminName: string,
  adminEmail: string,
  trialExpiresAt: string,
  source: string,
): Promise<void> {
  const expiryFormatted = new Date(trialExpiresAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
  const subject = `New VYSITE trial: ${companyName}`;
  const text = [
    `A new trial organisation has been provisioned on VYSITE.`,
    ``,
    `Company: ${companyName}`,
    `Admin: ${adminName} <${adminEmail}>`,
    `Source: ${source}`,
    `Trial expires: ${expiryFormatted}`,
    ``,
    `You can manage this organisation from the VYSITE Admin Panel.`,
  ].join("\n");
  const html = `<pre style="font-family:monospace;font-size:14px;">${text}</pre>`;
  await sendViaResend(NOTIFY_EMAIL, subject, html, text);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── 1. Parse request ──────────────────────────────────────────────────────
    let body: {
      companyName?: string;
      adminName?: string;
      adminEmail?: string;
      trialDays?: number;
      source?: string; // 'super-admin' | 'website'
    };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const companyName = (body.companyName ?? "").trim();
    const adminName   = (body.adminName   ?? "").trim();
    const adminEmail  = (body.adminEmail  ?? "").trim().toLowerCase();
    const trialDays   = typeof body.trialDays === "number" && body.trialDays > 0 ? body.trialDays : TRIAL_DAYS;
    const source      = (body.source ?? "website") as string;

    if (!companyName || companyName.length < 2) {
      return new Response(JSON.stringify({ error: "Company name must be at least 2 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!adminName || adminName.length < 2) {
      return new Response(JSON.stringify({ error: "Admin name must be at least 2 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!adminEmail || !adminEmail.includes("@")) {
      return new Response(JSON.stringify({ error: "A valid email address is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. If called from super-admin panel, verify caller is a super admin ──
    if (source === "super-admin") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const callerClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: isSuperAdmin } = await callerClient.rpc("is_super_admin");
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: super admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // Website requests are public (verify_jwt: false) — no auth check needed
    // before provisioning; the function itself is the gatekeeper via business
    // logic (duplicate checks, etc.)

    // ── 3. Service-role client for all privileged writes ─────────────────────
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 4. Duplicate email check ──────────────────────────────────────────────
    // If the email already exists as an auth user, we need to distinguish cases:
    //   a) Unconfirmed user (never set password) — resend the invite link
    //   b) Confirmed user with no org linkage — resend recovery link for new trial
    //   c) Confirmed user already in an org — return 409
    const { data: existingUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = existingUsers?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === adminEmail,
    ) ?? null;

    if (existingAuthUser) {
      // Check if this user already belongs to an active org
      const { data: existingOrg } = await adminClient
        .from("vy_platform_users")
        .select("id, org_id, status")
        .eq("auth_user_id", existingAuthUser.id)
        .eq("status", "Active")
        .maybeSingle();

      if (existingOrg?.org_id) {
        // User is already active in an org — cannot create a new trial for them
        return new Response(
          JSON.stringify({ error: "An account with this email address already exists and is linked to an organisation. Please sign in or contact support." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // User exists but has no active org — resend the invite link
      // This handles the case where a trial was deleted leaving an orphaned auth user,
      // or the user never completed setup. We proceed to create a new org and resend.
      console.log(`[provision-trial-org] Existing auth user ${existingAuthUser.id} has no active org — will delete stale auth record and re-provision`);

      // Delete the stale auth user so we can create fresh
      const { error: delErr } = await adminClient.auth.admin.deleteUser(existingAuthUser.id);
      if (delErr) {
        console.error("[provision-trial-org] Failed to delete stale auth user:", delErr.message);
        return new Response(
          JSON.stringify({ error: "This email address has a pending invite. Please check your inbox or contact support to reset access." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.log(`[provision-trial-org] Stale auth user deleted — proceeding with fresh provisioning`);
    }

    // ── 5. Duplicate company name / slug check ────────────────────────────────
    let slug = slugify(companyName);
    if (!slug || slug.length < 2) {
      return new Response(JSON.stringify({ error: "Company name could not be converted to a valid slug. Please use standard characters." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure slug uniqueness by appending a numeric suffix if needed
    const { data: slugConflict } = await adminClient
      .from("organisations")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();

    if (slugConflict) {
      // Append timestamp suffix to guarantee uniqueness
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // ── 6. Create the organisation ────────────────────────────────────────────
    const { data: org, error: orgErr } = await adminClient
      .from("organisations")
      .insert({ name: companyName, slug })
      .select("id, name, slug")
      .single();

    if (orgErr || !org) {
      return new Response(JSON.stringify({ error: `Failed to create organisation: ${orgErr?.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 7. Create org_settings row ────────────────────────────────────────────
    const trialExpiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: settingsErr } = await adminClient
      .from("org_settings")
      .insert({
        org_id: org.id,
        account_status: "active",
        account_type: "trial",
        trial_expires_at: trialExpiresAt,
        modules_enabled: DEFAULT_MODULES,
        ai_enabled: true,
        ai_monthly_limit: 50,
        ai_used_this_month: 0,
        ai_bonus_credits: 0,
        user_limit: null,
        updated_by: "system:trial-provision",
      });

    if (settingsErr) {
      // Roll back the org row before returning
      await adminClient.from("organisations").delete().eq("id", org.id);
      return new Response(JSON.stringify({ error: `Failed to create org settings: ${settingsErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 8. Generate invite link using the same proven mechanism as invite-org-user ──
    // generateLink with type 'invite' creates the auth user (or re-uses an
    // existing unconfirmed one) and returns a hashed_token we build into our
    // own direct URL to /set-password — no redirect allowlist, no PKCE, no
    // existing-session interference. Mirrors invite-org-user exactly.
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email: adminEmail,
      options: {
        data: {
          trial_org_id: org.id,
          full_name: adminName,
        },
      },
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      await adminClient.from("org_settings").delete().eq("org_id", org.id);
      await adminClient.from("organisations").delete().eq("id", org.id);
      return new Response(JSON.stringify({ error: `Failed to generate invite link: ${linkErr?.message ?? "no token returned"}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = linkData.properties.hashed_token;
    const inviteUrl = `${INVITE_BASE_URL}/set-password?token_hash=${encodeURIComponent(token)}&type=invite`;
    const authUserId = linkData.user.id;

    console.log(`[provision-trial-org] Invite URL: ${inviteUrl} | auth_user_id=${authUserId}`);

    // ── 9. Create vy_platform_users row ───────────────────────────────────────
    const { error: puErr } = await adminClient
      .from("vy_platform_users")
      .insert({
        id: crypto.randomUUID(),
        name: adminName,
        email: adminEmail,
        role: "Admin",
        company: companyName,
        status: "Active",
        avatar_initials: initialsFrom(adminName),
        join_date: new Date().toISOString().split("T")[0],
        assigned_project_ids: [],
        permissions: ADMIN_PERMISSIONS,
        auth_user_id: authUserId,
        org_id: org.id,
      });

    if (puErr) {
      // Roll back in reverse order
      await adminClient.auth.admin.deleteUser(authUserId);
      await adminClient.from("org_settings").delete().eq("org_id", org.id);
      await adminClient.from("organisations").delete().eq("id", org.id);
      return new Response(JSON.stringify({ error: `Failed to create platform user record: ${puErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 10. Create user_orgs membership row ───────────────────────────────────
    const { error: uoErr } = await adminClient
      .from("user_orgs")
      .insert({
        user_id: authUserId,
        org_id: org.id,
        role: "company_owner",
        status: "active",
      });

    if (uoErr) {
      // Non-fatal in practice (user can still log in; org resolution may fail
      // without this row). Log and return the error so an admin can fix manually.
      console.error("[provision-trial-org] user_orgs insert failed:", uoErr.message);
      return new Response(JSON.stringify({ error: `Organisation and user created but membership link failed: ${uoErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 11. Send onboarding email — must succeed before returning success ────────
    const emailResult = await sendOnboardingEmail(inviteUrl, adminName, adminEmail, companyName, trialExpiresAt);
    if (!emailResult.ok) {
      // Roll back everything — do not leave orphaned records when email fails
      await adminClient.auth.admin.deleteUser(authUserId);
      await adminClient.from("user_orgs").delete().eq("user_id", authUserId).eq("org_id", org.id);
      await adminClient.from("vy_platform_users").delete().eq("auth_user_id", authUserId);
      await adminClient.from("org_settings").delete().eq("org_id", org.id);
      await adminClient.from("organisations").delete().eq("id", org.id);
      return new Response(JSON.stringify({ error: `Failed to send invite email: ${emailResult.error}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire-and-forget internal notification — failure does not block success
    sendNotificationEmail(companyName, adminName, adminEmail, trialExpiresAt, source).catch(e =>
      console.error("[provision-trial-org] notification email failed:", e)
    );

    console.log(`[provision-trial-org] Complete — org=${org.id} auth_user=${authUserId} email sent to ${adminEmail}`);

    // ── 12. Return success ────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        orgId: org.id,
        orgName: org.name,
        orgSlug: org.slug,
        trialExpiresAt,
        message: `Trial organisation created. An invite email has been sent to ${adminEmail}.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${String(err)}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
