import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.30.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Pricing per 1M tokens (claude-opus-4-5 as of 2025)
const COST_PER_1M_INPUT  = 15.0;
const COST_PER_1M_OUTPUT = 75.0;
const COST_PER_1M_CACHE_READ    = 1.5;
const COST_PER_1M_CACHE_WRITE   = 18.75;

interface RequestBody {
  tenderName?: string;
  tenderClient?: string;
  documentBase64?: string;
  documentMimeType?: string;
  documentText?: string;
  documentName?: string;
  chunkIndex?: number;
  chunkTotal?: number;
  chunkPageRange?: string;
  // Usage tracking fields from frontend
  orgId?: string;
  userId?: string;
  pagesProcessed?: number;
  documentSizeKb?: number;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const systemPrompt = `You are an expert UK construction commercial manager embedded inside VYSITE, a construction operational control platform. Your role is to review contract documents from the perspective of a specialist M&E or building services contractor.

You must:
- Focus on practical commercial and operational risks for an SME construction contractor
- Use plain, direct construction-industry language — not legal jargon
- Only refer to information explicitly found in the document — never invent clauses
- Identify real financial exposure, not theoretical risk
- Flag anything that would surprise a site or commercial team during delivery
- Be specific: name clause numbers, section references, and actual wording where possible
- Keep tone professional, practical and confident

This is NOT legal advice. This is commercial and operational contract review support.

CRITICAL OUTPUT RULE:
You MUST respond with ONLY valid JSON. Your entire response must be a single JSON object.
Do NOT include:
- Markdown code fences (\`\`\`json or \`\`\`)
- Any text before the opening {
- Any text after the closing }
- Explanatory sentences, preamble, or commentary
- Comments inside the JSON
Your response must start with { and end with } and be parseable by JSON.parse() with zero preprocessing.`;

// ─── JSON sanitisation ────────────────────────────────────────────────────────

function sanitizeJsonResponse(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  let start = -1;
  if (firstBrace >= 0 && firstBracket >= 0) {
    start = Math.min(firstBrace, firstBracket);
  } else if (firstBrace >= 0) {
    start = firstBrace;
  } else if (firstBracket >= 0) {
    start = firstBracket;
  }
  if (start > 0) s = s.slice(start);

  const lastBrace = s.lastIndexOf("}");
  const lastBracket = s.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);
  if (end >= 0 && end < s.length - 1) s = s.slice(0, end + 1);

  return s.trim();
}

// ─── Partial JSON recovery ────────────────────────────────────────────────────

function tryRecoverTruncated(raw: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {
    executiveSummary: "",
    findings: [],
    commercialHandoverNotes: "",
  };
  let recovered = 0;

  const summaryMatch = raw.match(/"executiveSummary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    try { result.executiveSummary = JSON.parse(`"${summaryMatch[1]}"`); } catch { /* ignore */ }
  }

  const handoverMatch = raw.match(/"commercialHandoverNotes"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (handoverMatch) {
    try { result.commercialHandoverNotes = JSON.parse(`"${handoverMatch[1]}"`); } catch { /* ignore */ }
  }

  const findingsStart = raw.indexOf('"findings"');
  if (findingsStart >= 0) {
    const bracketIdx = raw.indexOf("[", findingsStart);
    if (bracketIdx >= 0) {
      const findings: unknown[] = [];
      let pos = bracketIdx + 1;
      let depth = 0;
      let itemStart = -1;

      while (pos < raw.length) {
        const ch = raw[pos];
        if (ch === "{") {
          if (depth === 0) itemStart = pos;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && itemStart >= 0) {
            try {
              const item = JSON.parse(raw.slice(itemStart, pos + 1));
              findings.push(item);
              recovered++;
            } catch { /* skip malformed */ }
            itemStart = -1;
          }
          if (depth < 0) break;
        }
        pos++;
      }
      result.findings = findings;
    }
  }

  if (recovered === 0 && !result.executiveSummary) return null;
  console.log(`[contract-review] Partial recovery: summary=${!!(result.executiveSummary)} findings=${recovered}`);
  return result;
}

// ─── Schema validation & normalisation ───────────────────────────────────────

function normalizeFinding(raw: unknown, index: number): Record<string, unknown> {
  const f = (typeof raw === "object" && raw !== null && !Array.isArray(raw))
    ? raw as Record<string, unknown>
    : {};

  const id = typeof f["id"] === "string" ? f["id"] : `cr-${Date.now()}-${index}`;
  const section = typeof f["section"] === "string" && f["section"].trim() ? f["section"].trim() : "Key Commercial Risks";
  const title = typeof f["title"] === "string" && f["title"].trim() ? f["title"].trim() : "Untitled finding";
  const summary = typeof f["summary"] === "string" ? f["summary"].trim() : "";
  const rawRisk = typeof f["risk"] === "string" ? f["risk"].toLowerCase().trim() : "medium";
  const risk = (["low", "medium", "high"] as const).includes(rawRisk as "low" | "medium" | "high") ? rawRisk : "medium";
  const recommendation = typeof f["recommendation"] === "string" ? f["recommendation"].trim() : "";

  let source: Record<string, string> | undefined;
  if (typeof f["source"] === "object" && f["source"] !== null && !Array.isArray(f["source"])) {
    const s = f["source"] as Record<string, unknown>;
    source = {
      document: typeof s["document"] === "string" ? s["document"] : "",
      clause: typeof s["clause"] === "string" ? s["clause"] : "",
      section: typeof s["section"] === "string" ? s["section"] : "",
      page: typeof s["page"] === "string" ? s["page"] : "",
      snippet: typeof s["snippet"] === "string" ? s["snippet"].slice(0, 200) : "",
    };
  }

  return { id, section, title, summary, risk, recommendation, ...(source ? { source } : {}) };
}

function normalizeReviewResult(parsed: unknown, docName: string): {
  executiveSummary: string;
  findings: Record<string, unknown>[];
  commercialHandoverNotes: string;
} {
  const obj = (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : {};

  const executiveSummary = typeof obj["executiveSummary"] === "string"
    ? obj["executiveSummary"].trim()
    : "";

  const commercialHandoverNotes = typeof obj["commercialHandoverNotes"] === "string"
    ? obj["commercialHandoverNotes"].trim()
    : "";

  const rawFindings = Array.isArray(obj["findings"]) ? obj["findings"] : [];
  const findings = rawFindings.map((f, i) => normalizeFinding(f, i));

  console.log(`[contract-review] normalize: doc="${docName}" summary_len=${executiveSummary.length} findings=${findings.length} handover_len=${commercialHandoverNotes.length}`);

  return { executiveSummary, findings, commercialHandoverNotes };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(body: RequestBody): string {
  const tenderCtx = body.tenderName
    ? `Tender / Project: ${body.tenderName}${body.tenderClient ? ` — Client: ${body.tenderClient}` : ""}\n`
    : "";

  const chunkCtx = body.chunkTotal && body.chunkTotal > 1
    ? `This is section ${(body.chunkIndex ?? 0) + 1} of ${body.chunkTotal} (pages ${body.chunkPageRange ?? "unknown"}).\n`
    : "";

  const docCtx = body.documentName ? `Contract document: ${body.documentName}\n` : "";

  const sections = [
    "Key Commercial Risks", "Payment Terms", "Valuation / Application Process",
    "Notice Requirements", "Delay / Hold-Up Procedures", "Variation Procedures",
    "Retention", "Liquidated Damages", "Design Liability", "Programme / Time Obligations",
    "Key Dates / Timeframes", "Commercial Exposure", "Suggested Renegotiation Points",
    "Operational Considerations", "Commercial Handover Notes",
  ].join(", ");

  return `${tenderCtx}${docCtx}${chunkCtx}
Review this contract for a UK specialist construction contractor. Find practical commercial risks — things that will cost money, cause delays, or surprise the delivery team.

Look for: pay less notices, valuation dates, payment application method and deadlines, notice periods, variation approval/written instruction requirements, LAD rate and cap, retention %, release conditions, collateral warranties, design/fitness-for-purpose liability, delay notice time bars, EOT procedures, contra-charge exposure, termination grounds, suspension rights, final account deadlines, O&M obligations.

Respond with ONLY this JSON object — start with { and end with } — nothing else:
{
  "executiveSummary": "2-3 sentence plain-English summary of the overall risk profile",
  "findings": [
    {
      "section": "one of: ${sections}",
      "title": "short title",
      "summary": "what the contract says and why it matters commercially",
      "risk": "low or medium or high",
      "recommendation": "specific suggested action",
      "source": {
        "document": "${body.documentName ?? "Contract document"}",
        "clause": "clause ref if found",
        "section": "section heading if found",
        "page": "page ref if found",
        "snippet": "direct quote max 100 chars"
      }
    }
  ],
  "commercialHandoverNotes": "key points the delivery team must know before mobilisation"
}

Include 5-15 findings. Only include findings for clauses actually in the document. Do not output anything outside the JSON object.`;
}

// ─── Cost calculator ──────────────────────────────────────────────────────────

function calcCost(usage: Anthropic.Usage): number {
  return (
    ((usage.input_tokens ?? 0) / 1_000_000) * COST_PER_1M_INPUT +
    ((usage.output_tokens ?? 0) / 1_000_000) * COST_PER_1M_OUTPUT +
    (((usage as Record<string, unknown>)["cache_read_input_tokens"] as number ?? 0) / 1_000_000) * COST_PER_1M_CACHE_READ +
    (((usage as Record<string, unknown>)["cache_creation_input_tokens"] as number ?? 0) / 1_000_000) * COST_PER_1M_CACHE_WRITE
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Build service-role Supabase client for DB operations (allowance check + logging)
  const supabaseUrl  = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured", code: "auth_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const docName = body.documentName ?? "contract";
    const chunkLabel = (body.chunkIndex !== undefined && body.chunkTotal !== undefined)
      ? ` chunk ${body.chunkIndex + 1}/${body.chunkTotal}`
      : " (single)";

    const docSize = body.documentBase64
      ? `base64=${Math.round(body.documentBase64.length / 1024)}KB`
      : body.documentText
        ? `text=${body.documentText.length}chars`
        : "no-content";

    console.log(`[contract-review]${chunkLabel}: doc="${docName}" size=${docSize} mime=${body.documentMimeType ?? "none"}`);

    if (!body.documentBase64 && !body.documentText) {
      return new Response(
        JSON.stringify({ error: "No document content provided", code: "missing_document" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Server-side allowance check ───────────────────────────────────────────
    const orgId  = body.orgId;
    const userId = body.userId;

    if (orgId) {
      const { data: allowance, error: allowanceErr } = await db
        .rpc("check_ai_allowance", { p_org_id: orgId })
        .single();

      if (allowanceErr) {
        console.warn(`[contract-review] Allowance check error (org=${orgId}): ${allowanceErr.message}`);
        // On DB error we allow the call through rather than blocking users
      } else if (allowance) {
        if (!allowance.ai_enabled) {
          // Log blocked call
          if (orgId) {
            await db.from("ai_usage_log").insert({
              org_id: orgId,
              user_id: userId ?? null,
              feature: "contract-review",
              call_type: "contract-review",
              model: "claude-opus-4-5",
              input_tokens: 0,
              output_tokens: 0,
              cache_read_tokens: 0,
              cache_creation_tokens: 0,
              estimated_cost_usd: 0,
              status: "blocked",
              error_code: "ai_disabled",
              document_name: docName,
              document_size_kb: body.documentSizeKb ?? null,
              pages_processed: body.pagesProcessed ?? null,
              chunks_total: body.chunkTotal ?? null,
              chunk_index: body.chunkIndex ?? null,
            });
          }
          return new Response(
            JSON.stringify({ error: "AI features are not enabled for your organisation. Please contact your administrator.", code: "ai_disabled" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!allowance.allowed) {
          if (orgId) {
            await db.from("ai_usage_log").insert({
              org_id: orgId,
              user_id: userId ?? null,
              feature: "contract-review",
              call_type: "contract-review",
              model: "claude-opus-4-5",
              input_tokens: 0,
              output_tokens: 0,
              cache_read_tokens: 0,
              cache_creation_tokens: 0,
              estimated_cost_usd: 0,
              status: "blocked",
              error_code: "allowance_exceeded",
              document_name: docName,
              document_size_kb: body.documentSizeKb ?? null,
              pages_processed: body.pagesProcessed ?? null,
              chunks_total: body.chunkTotal ?? null,
              chunk_index: body.chunkIndex ?? null,
            });
          }
          return new Response(
            JSON.stringify({
              error: `Your organisation has used all ${allowance.monthly_limit + allowance.bonus_credits} AI reviews available this month. Please contact your administrator to increase your allowance.`,
              code: "allowance_exceeded",
              used: allowance.used,
              limit: allowance.monthly_limit,
              bonus: allowance.bonus_credits,
              remaining: 0,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[contract-review] Allowance OK: org=${orgId} used=${allowance.used} remaining=${allowance.remaining}`);
      }
    }

    // ── Call Claude ───────────────────────────────────────────────────────────
    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(body);
    const MAX_TOKENS = 8192;

    let message: Anthropic.Message;

    if (body.documentBase64 && body.documentMimeType === "application/pdf") {
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: body.documentBase64,
              },
            } as Anthropic.DocumentBlockParam,
            { type: "text", text: prompt },
          ],
        }],
      });
    } else {
      const textContent = body.documentText ?? "";
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: `${prompt}\n\n--- CONTRACT DOCUMENT ---\n${textContent}` }],
      });
    }

    const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";
    const stopReason = message.stop_reason;
    const usage = message.usage;

    console.log(`[contract-review]${chunkLabel}: raw_len=${rawText.length} stop_reason=${stopReason} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens}`);

    if (stopReason === "max_tokens") {
      console.warn(`[contract-review]${chunkLabel}: TRUNCATED at max_tokens=${MAX_TOKENS}. Will attempt partial recovery.`);
    }

    if (rawText.length < 20) {
      console.warn(`[contract-review]${chunkLabel}: Very short response (${rawText.length} chars): "${rawText}"`);
    }

    console.log(`[contract-review]${chunkLabel}: raw_start="${rawText.slice(0, 300).replace(/\n/g, "\\n")}"`);

    // ── Parse ──────────────────────────────────────────────────────────────────
    const sanitized = sanitizeJsonResponse(rawText);
    let parsed: unknown;
    let recovered = false;

    try {
      parsed = JSON.parse(sanitized);
    } catch (primaryErr) {
      console.warn(
        `[contract-review]${chunkLabel}: Primary JSON.parse failed (${primaryErr instanceof Error ? primaryErr.message : primaryErr}). ` +
        `sanitized_len=${sanitized.length}. Attempting partial recovery...`
      );

      const partial = tryRecoverTruncated(rawText);
      if (partial && (
        (partial.findings as unknown[]).length > 0 ||
        typeof partial.executiveSummary === "string" && (partial.executiveSummary as string).length > 10
      )) {
        parsed = partial;
        recovered = true;
        console.log(`[contract-review]${chunkLabel}: Partial recovery succeeded. findings=${(partial.findings as unknown[]).length}`);
      } else {
        // Log failed call
        if (orgId) {
          const cacheRead = (usage as Record<string, unknown>)["cache_read_input_tokens"] as number ?? 0;
          const cacheCreate = (usage as Record<string, unknown>)["cache_creation_input_tokens"] as number ?? 0;
          await db.from("ai_usage_log").insert({
            org_id: orgId,
            user_id: userId ?? null,
            feature: "contract-review",
            call_type: "contract-review",
            model: "claude-opus-4-5",
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            cache_read_tokens: cacheRead,
            cache_creation_tokens: cacheCreate,
            estimated_cost_usd: calcCost(usage),
            status: "failed",
            error_code: "parse_error",
            document_name: docName,
            document_size_kb: body.documentSizeKb ?? null,
            pages_processed: body.pagesProcessed ?? null,
            chunks_total: body.chunkTotal ?? null,
            chunk_index: body.chunkIndex ?? null,
          });
        }

        console.error(
          `[contract-review]${chunkLabel}: All parse attempts failed. ` +
          `raw_len=${rawText.length} stop_reason=${stopReason} ` +
          `raw_sample="${rawText.slice(0, 400).replace(/\n/g, "\\n")}"`
        );
        return new Response(
          JSON.stringify({
            error: stopReason === "max_tokens"
              ? "AI response was truncated before completing the JSON output. Try uploading a shorter document or splitting it into sections."
              : "AI returned a response that could not be parsed. Please retry.",
            code: "parse_error",
            stop_reason: stopReason,
            raw_sample: rawText.slice(0, 300),
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Normalise ──────────────────────────────────────────────────────────────
    const normalized = normalizeReviewResult(parsed, docName);

    if (normalized.findings.length === 0 && !normalized.executiveSummary) {
      console.warn(`[contract-review]${chunkLabel}: Normalisation produced empty result. parsed keys=${Object.keys(parsed as object).join(",")}`);
    }

    console.log(
      `[contract-review]${chunkLabel}: ` +
      `findings=${normalized.findings.length} recovered=${recovered} stop_reason=${stopReason}`
    );

    // ── Log usage + increment counter ─────────────────────────────────────────
    if (orgId) {
      const cacheRead = (usage as Record<string, unknown>)["cache_read_input_tokens"] as number ?? 0;
      const cacheCreate = (usage as Record<string, unknown>)["cache_creation_input_tokens"] as number ?? 0;
      const costUsd = calcCost(usage);

      await Promise.all([
        db.from("ai_usage_log").insert({
          org_id: orgId,
          user_id: userId ?? null,
          feature: "contract-review",
          call_type: "contract-review",
          model: "claude-opus-4-5",
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_read_tokens: cacheRead,
          cache_creation_tokens: cacheCreate,
          estimated_cost_usd: costUsd,
          status: "success",
          document_name: docName,
          document_size_kb: body.documentSizeKb ?? null,
          pages_processed: body.pagesProcessed ?? null,
          chunks_total: body.chunkTotal ?? null,
          chunk_index: body.chunkIndex ?? null,
        }),
        db.rpc("increment_ai_usage", { p_org_id: orgId }),
      ]);

      console.log(`[contract-review]${chunkLabel}: logged usage org=${orgId} tokens=${usage.input_tokens}+${usage.output_tokens} cost=$${costUsd.toFixed(6)}`);
    }

    return new Response(
      JSON.stringify({ ...normalized, _recovered: recovered }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuthError = msg.includes("401") || msg.toLowerCase().includes("authentication");
    const isCreditError = msg.includes("529") || msg.toLowerCase().includes("credit") || msg.toLowerCase().includes("overloaded");
    const code = isAuthError ? "auth_error" : isCreditError ? "credit_error" : "generic_error";
    console.error(`[contract-review] Unhandled error (${code}):`, msg);
    return new Response(
      JSON.stringify({ error: msg, code }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
