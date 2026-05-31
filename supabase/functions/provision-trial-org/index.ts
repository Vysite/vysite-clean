import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NOTIFY_EMAIL = "hello@vysite.com";
const TRIAL_DAYS = 14;

const DEFAULT_MODULES = {
  tenders: true,
  projects: true,
  maintenance: true,
  "site-forms": true,
  snagging: true,
  actions: true,
  testing: true,
  reports: true,
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
  "snagging.create": true, "snagging.edit": true, "snagging.delete": true, "snagging.export": true,
  "actions.create": true, "actions.edit": true, "actions.delete": true, "actions.export": true,
  "site_forms.create": true, "site_forms.edit": true, "site_forms.delete": true, "site_forms.export": true,
  "commissioning.create": true, "commissioning.edit": true, "commissioning.delete": true, "commissioning.export": true,
  "maintenance.view": true, "maintenance.create": true, "maintenance.edit": true, "maintenance.delete": true,
  "maintenance.assign": true, "maintenance.export": true, "maintenance.comment": true, "maintenance.upload": true, "maintenance.complete": true,
  "programmes.view": true, "programmes.create": true, "programmes.edit": true, "programmes.delete": true, "programmes.export": true,
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

// Send a plain notification email via Supabase's built-in auth.admin.generateLink
// trick is not suitable here — instead we use the Supabase email OTP endpoint as a
// simple relay, or just log the notification. For production use, wire this to your
// mail provider (Resend, SendGrid, etc.) via an environment variable.
async function sendNotificationEmail(
  adminClient: ReturnType<typeof createClient>,
  companyName: string,
  adminName: string,
  adminEmail: string,
  trialExpiresAt: string,
  source: string,
): Promise<void> {
  const subject = `New VYSITE trial: ${companyName}`;
  const body = [
    `A new trial organisation has been provisioned on VYSITE.`,
    ``,
    `Company: ${companyName}`,
    `Admin: ${adminName} <${adminEmail}>`,
    `Source: ${source}`,
    `Trial expires: ${new Date(trialExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`,
    ``,
    `You can manage this organisation from the VYSITE Admin Panel.`,
  ].join("\n");

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (RESEND_API_KEY) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "VYSITE <noreply@vysite.com>",
          to: [NOTIFY_EMAIL],
          subject,
          text: body,
        }),
      });
    } catch {
      // Non-fatal — trial is already provisioned
    }
    return;
  }

  // Fallback: use Supabase's auth admin to send a magic link email as a proxy.
  // This is best-effort and only works if the notify address is registered.
  // In production always set RESEND_API_KEY.
  console.log("[provision-trial-org] Notification (no mail provider configured):", subject);
  console.log(body);
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
    const { data: existingUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    const emailAlreadyExists = existingUsers?.users?.some(
      (u: { email?: string }) => u.email?.toLowerCase() === adminEmail,
    );
    if (emailAlreadyExists) {
      return new Response(
        JSON.stringify({ error: "An account with this email address already exists. Please contact support if you need access." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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

    // ── 8. Create the auth user (invite — user sets their own password) ───────
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      adminEmail,
      {
        data: {
          trial_org_id: org.id,
          full_name: adminName,
        },
        redirectTo: `${Deno.env.get("SITE_URL") ?? "https://app.vysite.com"}/`,
      },
    );

    if (inviteErr || !inviteData?.user) {
      // Roll back org and settings
      await adminClient.from("org_settings").delete().eq("org_id", org.id);
      await adminClient.from("organisations").delete().eq("id", org.id);
      return new Response(JSON.stringify({ error: `Failed to create user account: ${inviteErr?.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUserId = inviteData.user.id;

    // ── 9. Create vy_platform_users row ───────────────────────────────────────
    const { error: puErr } = await adminClient
      .from("vy_platform_users")
      .insert({
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

    // ── 11. Send notification to hello@vysite.com ─────────────────────────────
    await sendNotificationEmail(adminClient, companyName, adminName, adminEmail, trialExpiresAt, source);

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
