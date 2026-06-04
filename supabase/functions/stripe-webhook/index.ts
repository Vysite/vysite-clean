import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Maps Stripe Price IDs back to plan names and intervals
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1TeMQSLutZdDjCMu3XZNSto9": "starter",
  "price_1TeMQSLutZdDjCMuJpXlFQoF": "starter",
  "price_1TeMUgLutZdDjCMuKw7mVKpz": "professional",
  "price_1TeMTXLutZdDjCMuDbykTMJm": "professional",
  "price_1TeMWLLutZdDjCMudHOtzyGe": "business",
  "price_1TeMWLLutZdDjCMugVK6peUh": "business",
};

const PRICE_TO_INTERVAL: Record<string, string> = {
  "price_1TeMQSLutZdDjCMu3XZNSto9": "monthly",
  "price_1TeMQSLutZdDjCMuJpXlFQoF": "annual",
  "price_1TeMUgLutZdDjCMuKw7mVKpz": "monthly",
  "price_1TeMTXLutZdDjCMuDbykTMJm": "annual",
  "price_1TeMWLLutZdDjCMudHOtzyGe": "monthly",
  "price_1TeMWLLutZdDjCMugVK6peUh": "annual",
};

// Module sets per plan — Commercial is Business-only
const MODULES_BY_PLAN: Record<string, Record<string, boolean>> = {
  starter: {
    tenders: true, projects: true, maintenance: true,
    "site-forms": true, snagging: true, actions: true,
    testing: true, reports: true, commercial: false,
  },
  professional: {
    tenders: true, projects: true, maintenance: true,
    "site-forms": true, snagging: true, actions: true,
    testing: true, reports: true, commercial: false,
  },
  business: {
    tenders: true, projects: true, maintenance: true,
    "site-forms": true, snagging: true, actions: true,
    testing: true, reports: true, commercial: true,
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20",
    });
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

    const body = await req.text();
    const signature = req.headers.get("stripe-signature") ?? "";

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return new Response("Webhook signature verification failed", { status: 400 });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const orgId = session.client_reference_id;
        if (!orgId) {
          console.error("[stripe-webhook] checkout.session.completed: no client_reference_id");
          break;
        }

        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id ?? "";
        const planName = PRICE_TO_PLAN[priceId] ?? "starter";
        const billingInterval = PRICE_TO_INTERVAL[priceId] ?? "monthly";
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        await adminClient.from("org_settings").upsert(
          {
            org_id: orgId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_name: planName,
            billing_interval: billingInterval,
            current_period_end: currentPeriodEnd,
            account_type: "paid",
            subscription_status: "active",
            modules_enabled: MODULES_BY_PLAN[planName],
          },
          { onConflict: "org_id" },
        );

        console.log(`[stripe-webhook] Org ${orgId} activated on ${planName} (${billingInterval})`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: org } = await adminClient
          .from("org_settings")
          .select("org_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!org?.org_id) break;

        const priceId = subscription.items.data[0]?.price.id ?? "";
        const planName = PRICE_TO_PLAN[priceId] ?? "starter";
        const billingInterval = PRICE_TO_INTERVAL[priceId] ?? "monthly";
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        const updatePayload: Record<string, unknown> = {
          stripe_subscription_id: subscription.id,
          plan_name: planName,
          billing_interval: billingInterval,
          current_period_end: currentPeriodEnd,
          subscription_status: subscription.status,
          modules_enabled: MODULES_BY_PLAN[planName],
        };

        // Restore account_type to paid when subscription becomes active again
        if (subscription.status === "active" || subscription.status === "trialing") {
          updatePayload.account_type = "paid";
        }

        await adminClient.from("org_settings").update(updatePayload).eq("org_id", org.org_id);
        console.log(`[stripe-webhook] Subscription updated for org ${org.org_id}: status=${subscription.status} plan=${planName}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: org } = await adminClient
          .from("org_settings")
          .select("org_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!org?.org_id) break;

        await adminClient
          .from("org_settings")
          .update({ subscription_status: "canceled" })
          .eq("org_id", org.org_id);

        console.log(`[stripe-webhook] Subscription cancelled for org ${org.org_id}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // checkout.session.completed handles first payment; skip to avoid duplicate work
        if (invoice.billing_reason === "subscription_create") break;

        const customerId = invoice.customer as string;
        const { data: org } = await adminClient
          .from("org_settings")
          .select("org_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!org?.org_id) break;

        const subscriptionId = invoice.subscription as string;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        await adminClient.from("org_settings").update({
          subscription_status: "active",
          account_type: "paid",
          current_period_end: currentPeriodEnd,
        }).eq("org_id", org.org_id);

        console.log(`[stripe-webhook] Payment succeeded for org ${org.org_id}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: org } = await adminClient
          .from("org_settings")
          .select("org_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (!org?.org_id) break;

        await adminClient
          .from("org_settings")
          .update({ subscription_status: "past_due" })
          .eq("org_id", org.org_id);

        console.log(`[stripe-webhook] Payment failed for org ${org.org_id}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[stripe-webhook] Unexpected error:", err);
    return new Response("Internal server error", { status: 500 });
  }
});
