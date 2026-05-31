import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ORG_ID = "d0000000-0000-4000-a000-000000000001";
const PASSWORD = "vysite";

const TEST_USERS = [
  {
    email: "admin.test@vysite.local",
    name: "Admin Test",
    vysiteRole: "Admin",
    orgRole: "platform_admin",
    initials: "AT",
  },
  {
    email: "commercial.test@vysite.local",
    name: "Commercial Test",
    vysiteRole: "Commercial Lead",
    orgRole: "manager",
    initials: "CT",
  },
  {
    email: "pm.test@vysite.local",
    name: "PM Test",
    vysiteRole: "Project Manager",
    orgRole: "manager",
    initials: "PT",
  },
  {
    email: "site.test@vysite.local",
    name: "Site Test",
    vysiteRole: "Site Manager",
    orgRole: "user",
    initials: "ST",
  },
  {
    email: "engineer.test@vysite.local",
    name: "Engineer Test",
    vysiteRole: "Engineer",
    orgRole: "user",
    initials: "ET",
  },
  {
    email: "qs.test@vysite.local",
    name: "QS Test",
    vysiteRole: "Estimator / QS",
    orgRole: "manager",
    initials: "QT",
  },
  {
    email: "client.test@vysite.local",
    name: "Client Test",
    vysiteRole: "Client",
    orgRole: "viewer",
    initials: "KT",
  },
  {
    email: "external.test@vysite.local",
    name: "External Test",
    vysiteRole: "External / Subcontractor",
    orgRole: "viewer",
    initials: "XT",
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Use service role key so we can call auth.admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results: Array<{ email: string; status: string; error?: string }> = [];
    const today = new Date().toISOString().split("T")[0];

    for (const u of TEST_USERS) {
      try {
        // Create via Admin API — this is the only supported method that produces
        // a fully valid auth user with correct identities and password hash.
        const { data, error: createErr } = await supabase.auth.admin.createUser({
          email: u.email,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: { is_test_user: true, name: u.name },
          app_metadata: { provider: "email", providers: ["email"] },
        });

        if (createErr) {
          // User may already exist — try to look it up
          if (createErr.message?.includes("already")) {
            results.push({ email: u.email, status: "already_exists" });
            continue;
          }
          results.push({ email: u.email, status: "error", error: createErr.message });
          continue;
        }

        const authUserId = data.user.id;

        // Insert user_orgs membership
        await supabase.from("user_orgs").upsert({
          id: crypto.randomUUID(),
          user_id: authUserId,
          org_id: ORG_ID,
          role: u.orgRole,
          status: "active",
        }, { onConflict: "user_id,org_id" });

        // Insert vy_platform_users row
        await supabase.from("vy_platform_users").upsert({
          id: `test-pu-${u.email.split(".")[0]}`,
          name: u.name,
          email: u.email,
          role: u.vysiteRole,
          company: "VYSITE Test",
          status: "Active",
          avatar_initials: u.initials,
          join_date: today,
          assigned_project_ids: [],
          auth_user_id: authUserId,
          org_id: ORG_ID,
          permissions: { is_test_user: true },
        }, { onConflict: "id" });

        results.push({ email: u.email, status: "created" });
      } catch (err) {
        results.push({ email: u.email, status: "error", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
