import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PRICE_IDS: Record<string, Record<string, string>> = {
  starter:      { monthly: "price_1TeMQSLutZdDjCMu3XZNSto9", annual: "price_1TeMQSLutZdDjCMuJpXlFQoF" },
  professional: { monthly: "price_1TeMUgLutZdDjCMuKw7mVKpz", annual: "price_1TeMTXLutZdDjCMuDbykTMJm" },
  business:     { monthly: "price_1TeMWLLutZdDjCMudHOtzyGe", annual: "price_1TeMWLLutZdDjCMugVK6peUh" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan, interval } = await req.json();

    const priceId = PRICE_IDS[plan]?.[interval];
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Invalid plan or interval" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://app.vysite.com";

    // Identify the calling user via their JWT
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve org for user
    const { data: userOrg } = await adminClient
      .from("user_orgs")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!userOrg?.org_id) {
      return new Response(JSON.stringify({ error: "No organisation found for user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = userOrg.org_id;

    // Look up any existing Stripe customer ID for this org
    const { data: orgSettings } = await adminClient
      .from("org_settings")
      .select("stripe_customer_id")
      .eq("org_id", orgId)
      .maybeSingle();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: orgId,
      success_url: `${siteUrl}/?checkout_success=1`,
      cancel_url: `${siteUrl}/`,
      metadata: { org_id: orgId, plan, interval },
      allow_promotion_codes: true,
    };

    if (orgSettings?.stripe_customer_id) {
      sessionParams.customer = orgSettings.stripe_customer_id;
    } else {
      sessionParams.customer_email = user.email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-checkout] Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
