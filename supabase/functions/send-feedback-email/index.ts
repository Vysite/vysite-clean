import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CRM_ENDPOINT = "https://arqultkwzbqyjtrfwgay.supabase.co/functions/v1/saas-feedback";
const CRM_API_KEY = "93298374ec31b83bc0f4af70dc980a9d212039390d95835b406b65c43457bf03";
const NOTIFY_EMAIL = "hello@vysite.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { org_id, user_name, user_email, feedback_type, message, urgent } = await req.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the org name
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let orgName = "";
    if (org_id) {
      const { data: orgRow } = await adminClient
        .from("organisations")
        .select("name")
        .eq("id", org_id)
        .maybeSingle();
      if (orgRow?.name) orgName = orgRow.name;
    }

    const isBug = feedback_type === "bug";
    const isSuggestion = feedback_type === "suggestion";

    // ── 1. CRM ticket (primary — surface failure to user) ────────────────────
    const crmPayload: Record<string, string> = {
      title: isBug ? "Bug Report" : isSuggestion ? "Feature Suggestion" : "Feedback",
      description: message.trim(),
      ticket_type: isBug ? "Bug Report" : isSuggestion ? "Feature Request" : "Support Request",
      priority: isBug ? (urgent ? "High" : "Medium") : "Low",
    };
    if (user_name) crmPayload.name = user_name;
    if (user_email) crmPayload.email = user_email;
    if (orgName) crmPayload.company_name = orgName;

    const crmRes = await fetch(CRM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CRM_API_KEY,
      },
      body: JSON.stringify(crmPayload),
    });

    if (!crmRes.ok) {
      const errText = await crmRes.text();
      console.error("[send-feedback-email] CRM error:", crmRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to create support ticket. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Internal notification email (secondary — log failure, don't block) ─
    const submittedAt = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
    });

    const typeLabel = isBug ? "Bug Report" : isSuggestion ? "Feature Suggestion" : "Other";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; margin: 0; padding: 32px 16px; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: #0d1628; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; }
    .header p { margin: 4px 0 0; font-size: 13px; color: #94a3b8; }
    .body { padding: 28px 32px; }
    .row { margin-bottom: 18px; }
    .row-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 4px; }
    .row-value { font-size: 14px; color: #1e293b; font-weight: 500; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
    .message-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
    .type-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .type-bug { background: #fee2e2; color: #dc2626; }
    .type-suggestion { background: #d1fae5; color: #059669; }
    .type-other { background: #f1f5f9; color: #475569; }
    .footer { padding: 16px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>New VYSITE Feedback Submission</h1>
      <p>An in-app feedback submission has been received.</p>
    </div>
    <div class="body">
      <div class="row">
        <div class="row-label">Organisation</div>
        <div class="row-value">${escHtml(orgName || "Unknown")}</div>
      </div>
      <div class="row">
        <div class="row-label">Submitted By</div>
        <div class="row-value">${escHtml(user_name || "Unknown")}</div>
      </div>
      <div class="row">
        <div class="row-label">Email</div>
        <div class="row-value">${escHtml(user_email || "Not provided")}</div>
      </div>
      <div class="row">
        <div class="row-label">Type</div>
        <div class="row-value">
          <span class="type-badge type-${isBug ? "bug" : isSuggestion ? "suggestion" : "other"}">${escHtml(typeLabel)}</span>
        </div>
      </div>
      ${isBug && urgent ? `<div class="row"><div class="row-label">Priority</div><div class="row-value" style="color:#dc2626;font-weight:700;">URGENT</div></div>` : ""}
      <div class="row">
        <div class="row-label">Submitted</div>
        <div class="row-value">${escHtml(submittedAt)}</div>
      </div>
      <hr class="divider" />
      <div class="row">
        <div class="row-label">Message</div>
        <div class="message-box">${escHtml(message.trim())}</div>
      </div>
    </div>
    <div class="footer">
      This is an automated internal notification from the VYSITE platform. Do not reply directly to this email.
    </div>
  </div>
</body>
</html>`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "VYSITE Feedback <noreply@vysite.com>",
          to: [NOTIFY_EMAIL],
          subject: `[VYSITE Feedback] ${typeLabel} from ${orgName || user_email || "Unknown"}`,
          html: htmlBody,
        }),
      });
      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error("[send-feedback-email] Resend error:", errText);
      }
    } else {
      console.warn("[send-feedback-email] RESEND_API_KEY not set — skipping notification email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[send-feedback-email] Unexpected error:", err);
    return new Response(JSON.stringify({ error: `Unexpected error: ${String(err)}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
