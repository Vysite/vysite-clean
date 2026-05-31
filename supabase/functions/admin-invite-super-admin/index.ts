import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Verify the caller is an authenticated super admin using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller-scoped client — uses their JWT to verify identity via RLS
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // This SELECT only returns a row if the caller IS a super admin (RLS enforces it)
    const { data: callerRow, error: callerErr } = await callerClient
      .from("vy_super_admins")
      .select("id")
      .maybeSingle();

    if (callerErr || !callerRow) {
      return new Response(JSON.stringify({ error: "Forbidden: super admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse and validate request body
    const { email, name } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Name must be at least 2 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Service-role client for privileged operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Check if this email is already a super admin
    const { data: existing } = await adminClient
      .from("vy_super_admins")
      .select("id, status")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "This email is already registered as a super admin" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Send the Supabase invite email — invitee sets their own password
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      { data: { invited_as_super_admin: true } }
    );

    if (inviteErr) {
      // If user already exists in auth.users (e.g. a customer user), still create
      // the super admin row using the existing auth user id
      if (inviteErr.message?.includes("already been registered") || inviteErr.code === "email_exists") {
        const { data: existingUser } = await adminClient.auth.admin.listUsers();
        const match = existingUser?.users?.find(
          (u: { email?: string }) => u.email?.toLowerCase() === email.trim().toLowerCase()
        );
        if (!match) {
          return new Response(JSON.stringify({ error: `Invite failed: ${inviteErr.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Insert row for the existing auth user
        const { error: insertErr } = await adminClient
          .from("vy_super_admins")
          .insert({ auth_user_id: match.id, email: match.email, name: name.trim(), status: "active" });

        if (insertErr) {
          return new Response(JSON.stringify({ error: `Failed to add super admin: ${insertErr.message}` }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true, note: "Existing user granted super admin access. No invite email sent." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `Invite failed: ${inviteErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Insert the super admin row — auth_user_id comes from the invite response
    const { error: insertErr } = await adminClient
      .from("vy_super_admins")
      .insert({
        auth_user_id: inviteData.user.id,
        email: inviteData.user.email,
        name: name.trim(),
        status: "active",
      });

    if (insertErr) {
      return new Response(JSON.stringify({ error: `Super admin record failed: ${insertErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: `Unexpected error: ${String(err)}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
