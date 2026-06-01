import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.30.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Pricing per 1M tokens (claude-opus-4-5 as of 2025)
const COST_PER_1M_INPUT        = 15.0;
const COST_PER_1M_OUTPUT       = 75.0;
const COST_PER_1M_CACHE_READ   = 1.5;
const COST_PER_1M_CACHE_WRITE  = 18.75;

type AITask =
  | "draft-rfi"
  | "suggest-assumptions"
  | "suggest-exclusions"
  | "draft-scope-note"
  | "identify-risks"
  | "review-document"
  | "consolidate-review"
  | "reconcile-findings";

interface RequestBody {
  task: AITask;
  context?: string;
  tenderName?: string;
  tenderClient?: string;
  documentBase64?: string;
  documentMimeType?: string;
  documentText?: string;
  documentName?: string;
  chunkInfo?: string;
  chunkIndex?: number;
  chunkTotal?: number;
  chunkPageRange?: string;
  mergedResult?: unknown;
  totalPages?: number;
  chunkCount?: number;
  allFindings?: unknown;
  // Usage tracking fields from frontend
  orgId?: string;
  userId?: string;
  pagesProcessed?: number;
  documentSizeKb?: number;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const systemPrompt = `You are an expert construction commercial assistant embedded inside VYSITE, a construction operational control platform. Your role is to assist with tender and estimating workflows.

You must:
- Keep all output professional, concise and construction-focused
- Use clear, commercially aware language appropriate for UK construction tenders
- Avoid aggressive legal wording and unsupported contractual claims
- Only refer to information explicitly provided — never invent details
- Format output clearly for direct use in tender documentation
- Keep tone practical and confident, not overly formal or verbose

CRITICAL OUTPUT RULE:
You must respond with ONLY valid JSON. Do not include:
- Markdown code fences (\`\`\`json or \`\`\`)
- Explanatory text before or after the JSON
- Comments inside the JSON
- Any prose, preamble, or conversational text
Your entire response must be parseable by JSON.parse() with no preprocessing.`;

// ─── Response sanitisation ────────────────────────────────────────────────────

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

function tryRecoverTruncatedJson(raw: string): Record<string, unknown[]> | null {
  const result: Record<string, unknown[]> = {
    rfis: [], assumptions: [], exclusions: [], scopeNotes: [], risks: [],
  };
  let recovered = 0;

  const fields: Array<{ key: string; altKeys?: string[] }> = [
    { key: "rfis" },
    { key: "assumptions" },
    { key: "exclusions" },
    { key: "scopeNotes", altKeys: ["scope_notes", "scopenotes", "ScopeNotes"] },
    { key: "risks" },
  ];

  for (const { key, altKeys } of fields) {
    const searchKeys = [key, ...(altKeys ?? [])];
    let arrayStart = -1;
    let foundKey = key;
    for (const k of searchKeys) {
      const idx = raw.indexOf(`"${k}"`);
      if (idx >= 0) { arrayStart = idx; foundKey = k; break; }
    }
    if (arrayStart < 0) continue;

    const bracketIdx = raw.indexOf("[", arrayStart + foundKey.length + 2);
    if (bracketIdx < 0) continue;

    const items: unknown[] = [];
    let pos = bracketIdx + 1;
    let depth = 0;
    let itemStart = -1;

    while (pos < raw.length) {
      const ch = raw[pos];
      if (ch === "{" || ch === "[") {
        if (depth === 0) itemStart = pos;
        depth++;
      } else if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0 && itemStart >= 0) {
          try {
            const item = JSON.parse(raw.slice(itemStart, pos + 1));
            items.push(item);
          } catch { /* skip malformed item */ }
          itemStart = -1;
        }
        if (depth < 0) break;
      } else if (ch === '"' && depth === 0) {
        let strEnd = pos + 1;
        while (strEnd < raw.length && !(raw[strEnd] === '"' && raw[strEnd - 1] !== "\\")) strEnd++;
        if (strEnd < raw.length) {
          try {
            const str = JSON.parse(raw.slice(pos, strEnd + 1));
            if (typeof str === "string" && str.trim().length > 0) items.push(str);
          } catch { /* skip */ }
          pos = strEnd;
        }
      }
      pos++;
    }

    if (items.length > 0) {
      result[key] = items;
      recovered += items.length;
    }
  }

  if (recovered === 0) return null;
  console.log(`[recovery] Partial JSON recovery: ${recovered} items recovered from truncated response`);
  return result;
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function normalizeSource(src: unknown): Record<string, string> | undefined {
  if (!src || typeof src !== "object" || Array.isArray(src)) return undefined;
  const s = src as Record<string, unknown>;
  return {
    document: typeof s["document"] === "string" && s["document"].trim() ? s["document"].trim() : "Not identified",
    pageRange: typeof s["pageRange"] === "string" && s["pageRange"].trim() ? s["pageRange"].trim() : "Not identified",
    section: typeof s["section"] === "string" && s["section"].trim() ? s["section"].trim() : "Not identified",
    clause: typeof s["clause"] === "string" && s["clause"].trim() ? s["clause"].trim() : "Not identified",
  };
}

function safeTextArray(val: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(val)) {
    if (val !== undefined && val !== null) {
      console.warn(`[normalise] ${fieldName}: expected array, got ${typeof val} — skipping field`);
    }
    return [];
  }
  const kept: unknown[] = [];
  let discarded = 0;
  for (const x of val) {
    if (typeof x === "string") {
      if (x.trim().length > 0) {
        kept.push(x.trim());
      } else {
        discarded++;
      }
    } else if (typeof x === "object" && x !== null && !Array.isArray(x)) {
      const obj = x as Record<string, unknown>;
      if (typeof obj["text"] === "string" && obj["text"].trim().length > 0) {
        const source = normalizeSource(obj["source"]);
        kept.push(source ? { text: obj["text"].trim(), source } : obj["text"].trim());
      } else if (typeof obj["text"] === "string") {
        discarded++;
      } else {
        const keys = Object.keys(obj);
        const hasRfiKeys = keys.includes("subject") || keys.includes("query");
        if (hasRfiKeys) {
          const text = [obj["subject"], obj["query"]].filter(v => typeof v === "string").join(" — ");
          if (text.trim()) kept.push(text.trim());
          else discarded++;
        } else {
          discarded++;
        }
      }
    } else {
      discarded++;
    }
  }
  if (discarded > 0 || kept.length > 0) {
    console.log(`[normalise] ${fieldName}: kept=${kept.length} discarded=${discarded}`);
  }
  return kept;
}

function safeObjectArray(val: unknown, fieldName: string, requiredKey: string): unknown[] {
  if (!Array.isArray(val)) {
    if (val !== undefined && val !== null) {
      console.warn(`[normalise] ${fieldName}: expected array, got ${typeof val}`);
    }
    return [];
  }
  const kept: unknown[] = [];
  let discarded = 0;
  for (const x of val) {
    if (typeof x === "object" && x !== null && !Array.isArray(x)) {
      const obj = x as Record<string, unknown>;
      const keyVal = obj[requiredKey];
      if (typeof keyVal === "string" && keyVal.trim().length > 0) {
        kept.push(obj["source"] !== undefined ? { ...obj, source: normalizeSource(obj["source"]) } : obj);
      } else if (keyVal !== undefined) {
        discarded++;
      } else {
        const keys = Object.keys(obj);
        const firstStringKey = keys.find(k => typeof obj[k] === "string" && (obj[k] as string).trim().length > 0);
        if (firstStringKey) {
          kept.push({ ...obj, [requiredKey]: obj[firstStringKey] });
        } else {
          discarded++;
        }
      }
    } else if (typeof x === "string" && x.trim().length > 0) {
      kept.push({ [requiredKey]: x.trim() });
    } else {
      discarded++;
    }
  }
  if (discarded > 0 || kept.length > 0) {
    console.log(`[normalise] ${fieldName}: kept=${kept.length} discarded=${discarded}`);
  }
  return kept;
}

function normalizeReviewResult(parsed: unknown): {
  rfis: unknown[];
  assumptions: unknown[];
  exclusions: unknown[];
  scopeNotes: unknown[];
  risks: unknown[];
} {
  const obj = (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : {};

  const rfis        = safeObjectArray(obj["rfis"], "rfis", "subject");
  const assumptions = safeTextArray(obj["assumptions"], "assumptions");
  const exclusions  = safeTextArray(obj["exclusions"], "exclusions");
  const scopeNotes  = safeTextArray(
    obj["scopeNotes"] ?? obj["scope_notes"] ?? obj["scopenotes"] ?? obj["ScopeNotes"],
    "scopeNotes"
  );
  const risks       = safeObjectArray(obj["risks"], "risks", "risk");

  const total = rfis.length + assumptions.length + exclusions.length + scopeNotes.length + risks.length;
  console.log(`[normalise] FINAL: rfis=${rfis.length} assumptions=${assumptions.length} exclusions=${exclusions.length} scopeNotes=${scopeNotes.length} risks=${risks.length} TOTAL=${total}`);

  return { rfis, assumptions, exclusions, scopeNotes, risks };
}

function parseReviewResponse(raw: string): { result: ReturnType<typeof normalizeReviewResult>; recovered: boolean } {
  const sanitized = sanitizeJsonResponse(raw);
  try {
    const parsed = JSON.parse(sanitized);
    return { result: normalizeReviewResult(parsed), recovered: false };
  } catch (parseErr) {
    console.warn(`[parse] Primary JSON.parse failed: ${parseErr instanceof Error ? parseErr.message : parseErr}. Attempting partial recovery from ${raw.length} chars.`);
    const partial = tryRecoverTruncatedJson(raw);
    if (partial) {
      return { result: normalizeReviewResult(partial), recovered: true };
    }
    throw parseErr;
  }
}

function countFindings(result: ReturnType<typeof normalizeReviewResult>): Record<string, number> {
  return {
    rfis: result.rfis.length,
    assumptions: result.assumptions.length,
    exclusions: result.exclusions.length,
    scopeNotes: result.scopeNotes.length,
    risks: result.risks.length,
    total: result.rfis.length + result.assumptions.length + result.exclusions.length +
           result.scopeNotes.length + result.risks.length,
  };
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

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPrompt(task: AITask, body: RequestBody): string {
  const tenderCtx = body.tenderName
    ? `Tender: ${body.tenderName}${body.tenderClient ? ` | Client: ${body.tenderClient}` : ""}\n\n`
    : "";

  switch (task) {
    case "draft-rfi":
      return `${tenderCtx}Convert the following rough notes into a professional RFI.

Notes: "${body.context}"

Respond with ONLY this JSON object — no markdown, no commentary:
{
  "subject": "concise RFI subject line",
  "query": "clear professional query (2-4 sentences)",
  "responseRequired": "specific statement of what response is needed",
  "impact": "brief commercial or programme impact note (1-2 sentences)"
}`;

    case "suggest-assumptions":
      return `${tenderCtx}Suggest practical pricing and programme assumptions for the following tender context.

Context: "${body.context}"

Consider: access, design responsibility, programme, builders work, commissioning, client attendance, utilities.

Respond with ONLY a JSON array of assumption strings. Each must start with "Assumed" or "It is assumed that". Aim for 6-10 items.
Example: ["Assumed clear and unobstructed access to all work areas during normal working hours.", "..."]`;

    case "suggest-exclusions":
      return `${tenderCtx}Suggest appropriate exclusions for the following tender scope.

Context: "${body.context}"

Consider: builders work, asbestos, scaffolding, out-of-hours working, utility charges, specialist surveys, design responsibility, statutory fees, client-supplied equipment, unknown services.

Respond with ONLY a JSON array of exclusion strings. Aim for 6-10 items.
Example: ["All builders work, cutting, chasing, making good and structural modifications.", "..."]`;

    case "draft-scope-note":
      return `${tenderCtx}Convert the following rough wording into a professional scope note.

Notes: "${body.context}"

Respond with ONLY this JSON object — no markdown, no commentary:
{
  "scopeNote": "professional scope note text (2-5 sentences)"
}`;

    case "identify-risks":
      return `${tenderCtx}Identify commercial, programme and technical risks in the following tender notes.

Notes: "${body.context}"

Consider: unclear scope, missing specification, incomplete drawings, design responsibility gaps, access constraints, programme risks, commercial exposure, coordination risk.

Respond with ONLY a JSON array of risk objects:
[{"risk":"brief description","severity":"High|Medium|Low","suggestedAction":"RFI|Assumption|Exclusion|Scope Note|None","actionNote":"recommended action"}]
Aim for 5-10 risks based only on the provided information.`;

    case "review-document": {
      const chunkProgressCtx = (body.chunkIndex !== undefined && body.chunkTotal !== undefined)
        ? `\n\nThis is section ${body.chunkIndex + 1} of ${body.chunkTotal} (${body.chunkInfo ?? ""}). Extract every commercially relevant finding from THIS section — do not skip items assuming they will be covered elsewhere.`
        : "";

      return `${tenderCtx}Review the attached tender document and extract ALL commercially useful information for a UK MEP/construction tender submission.${chunkProgressCtx}

Extract every commercially relevant item. Do not skip, omit, or summarise — include each distinct finding as a separate item.

Respond with ONLY this JSON structure — no markdown, no commentary, nothing outside the JSON:
{
  "rfis": [
    {"subject": "concise subject", "query": "clear query", "responseRequired": "what is needed", "impact": "commercial impact"}
  ],
  "assumptions": [
    "Assumed ..."
  ],
  "exclusions": [
    "Exclusion text"
  ],
  "scopeNotes": [
    "Key commercial information or technical requirement"
  ],
  "risks": [
    {"risk": "description", "severity": "High", "suggestedAction": "RFI", "actionNote": "action"}
  ]
}

RFIs: missing/unclear/conflicting information — design responsibility, missing specs, ambiguous scope, commissioning requirements, interface responsibilities, testing obligations, approval requirements.
Assumptions: start with "Assumed" or "It is assumed that" — based on what the document states, implies, or omits.
Exclusions: items excluded from tender price — builders work, asbestos, scaffolding, out-of-hours, statutory fees, design fees, utility charges, specialist surveys, fire stopping, painting.
Scope Notes: key commercial/technical information — named products, equipment, performance requirements, standards, specified systems, installation requirements, testing requirements, clearance distances, support spacing, cable restrictions, bonding requirements, commissioning procedures.
Risks: commercial/programme/technical risks — unclear scope, missing information, unusual specs, design gaps, coordination risks, long-lead items.

Extract 5-20 items per category as appropriate. Prioritise completeness over brevity.`;
    }

    case "consolidate-review": {
      const merged = body.mergedResult as Record<string, unknown[]>;
      const inCounts = {
        rfis:        Array.isArray(merged?.rfis)        ? merged.rfis.length        : 0,
        assumptions: Array.isArray(merged?.assumptions) ? merged.assumptions.length : 0,
        exclusions:  Array.isArray(merged?.exclusions)  ? merged.exclusions.length  : 0,
        scopeNotes:  Array.isArray(merged?.scopeNotes)  ? merged.scopeNotes.length  : 0,
        risks:       Array.isArray(merged?.risks)        ? merged.risks.length       : 0,
      };
      const inTotal = Object.values(inCounts).reduce((a, b) => a + b, 0);
      console.log(`[consolidate] incoming: rfis=${inCounts.rfis} assumptions=${inCounts.assumptions} exclusions=${inCounts.exclusions} scopeNotes=${inCounts.scopeNotes} risks=${inCounts.risks} total=${inTotal}`);

      const conservativeNote = inTotal > 80
        ? `\n\nIMPORTANT: ${inTotal} items incoming. Be CONSERVATIVE — only remove true exact duplicates. Output must retain at least ${Math.floor(inTotal * 0.6)} items.`
        : "";

      return `${tenderCtx}Consolidate the following tender review findings extracted from a ${body.totalPages}-page document (${body.chunkCount} sections). Remove only TRUE exact duplicates. Preserve all distinct commercial findings.${conservativeNote}

${JSON.stringify(merged, null, 2)}

Rules: remove only exact duplicates; merge near-identical RFIs keeping the most detailed; keep all distinct risks; preserve all genuinely different findings.

Respond with ONLY this JSON — no markdown, no commentary:
{
  "rfis": [{"subject":"...","query":"...","responseRequired":"...","impact":"..."}],
  "assumptions": ["..."],
  "exclusions": ["..."],
  "scopeNotes": ["..."],
  "risks": [{"risk":"...","severity":"High|Medium|Low","suggestedAction":"...","actionNote":"..."}]
}`;
    }

    case "reconcile-findings": {
      return `${tenderCtx}Perform a second-pass reconciliation review of the following AI-extracted tender findings.

For each finding that has an issue, suggest one action: Keep, Remove, Reclassify, Merge, Convert to Scope Note, Convert to Confirmed Requirement, or Mark as Answered.

FINDINGS:
${JSON.stringify(body.allFindings, null, 2)}

Only include findings where you suggest something other than Keep. Be conservative.

Respond with ONLY a JSON array — no markdown:
[{"category":"rfi|assumption|exclusion|scopeNote|risk","itemIndex":0,"itemText":"brief description","suggestedAction":"Remove","reason":"explanation","targetCategory":"optional","mergeWithIndex":0}]`;
    }
  }
}

// ─── Request handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured. Please add your ANTHROPIC_API_KEY to the project secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();
    const { task } = body;

    if (!task) {
      return new Response(
        JSON.stringify({ error: "Missing required field: task" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isDocumentTask = task === "review-document" || task === "consolidate-review";
    const needsContext = !isDocumentTask && task !== "reconcile-findings";

    if (needsContext && !body.context?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing required field: context" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (task === "review-document" && !body.documentBase64 && !body.documentText?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing document content: provide documentBase64 or documentText" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (task === "consolidate-review" && !body.mergedResult) {
      return new Response(
        JSON.stringify({ error: "Missing mergedResult for consolidation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (task === "reconcile-findings" && !body.allFindings) {
      return new Response(
        JSON.stringify({ error: "Missing allFindings for reconciliation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (task === "review-document") {
      const chunkLabel = (body.chunkIndex !== undefined && body.chunkTotal !== undefined)
        ? ` chunk ${body.chunkIndex + 1}/${body.chunkTotal}`
        : " (single)";
      const docSize = body.documentBase64
        ? `base64=${Math.round(body.documentBase64.length / 1024)}KB`
        : body.documentText
          ? `text=${body.documentText.length}chars`
          : "no-content";
      console.log(`[ai-tender-assistant] review-document${chunkLabel}: doc="${body.documentName ?? "unnamed"}" size=${docSize}`);
    }

    // ── Server-side allowance check ───────────────────────────────────────────
    const orgId  = body.orgId;
    const userId = body.userId;

    if (orgId) {
      const { data: allowance, error: allowanceErr } = await db
        .rpc("check_ai_allowance", { p_org_id: orgId })
        .single();

      if (allowanceErr) {
        console.warn(`[ai-tender-assistant] Allowance check error (org=${orgId}): ${allowanceErr.message}`);
      } else if (allowance) {
        if (!allowance.ai_enabled) {
          await db.from("ai_usage_log").insert({
            org_id: orgId,
            user_id: userId ?? null,
            feature: "tender-assistant",
            call_type: task,
            model: "claude-opus-4-5",
            input_tokens: 0, output_tokens: 0,
            cache_read_tokens: 0, cache_creation_tokens: 0,
            estimated_cost_usd: 0,
            status: "blocked",
            error_code: "ai_disabled",
            document_name: body.documentName ?? null,
            document_size_kb: body.documentSizeKb ?? null,
            pages_processed: body.pagesProcessed ?? null,
            chunks_total: body.chunkTotal ?? null,
            chunk_index: body.chunkIndex ?? null,
          });
          return new Response(
            JSON.stringify({ error: "AI features are not enabled for your organisation. Please contact your administrator.", code: "ai_disabled" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!allowance.allowed) {
          await db.from("ai_usage_log").insert({
            org_id: orgId,
            user_id: userId ?? null,
            feature: "tender-assistant",
            call_type: task,
            model: "claude-opus-4-5",
            input_tokens: 0, output_tokens: 0,
            cache_read_tokens: 0, cache_creation_tokens: 0,
            estimated_cost_usd: 0,
            status: "blocked",
            error_code: "allowance_exceeded",
            document_name: body.documentName ?? null,
            document_size_kb: body.documentSizeKb ?? null,
            pages_processed: body.pagesProcessed ?? null,
            chunks_total: body.chunkTotal ?? null,
            chunk_index: body.chunkIndex ?? null,
          });
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

        console.log(`[ai-tender-assistant] Allowance OK: org=${orgId} used=${allowance.used} remaining=${allowance.remaining}`);
      }
    }

    // ── Call Claude ───────────────────────────────────────────────────────────
    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(task, body);
    const maxTokens = isDocumentTask || task === "reconcile-findings" ? 8192 : 1024;

    let message: Anthropic.Message;

    if (task === "review-document" && body.documentBase64 && body.documentMimeType === "application/pdf") {
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: body.documentBase64 },
            } as Anthropic.DocumentBlockParam,
            { type: "text", text: prompt },
          ],
        }],
      });
    } else if (task === "review-document" && body.documentText) {
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: `${prompt}\n\n--- DOCUMENT CONTENT ---\n${body.documentText}` }],
      });
    } else if (task === "review-document" && body.documentBase64 && body.documentMimeType) {
      const textContent = body.documentText ?? "Document content not available for this file type.";
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: `${prompt}\n\n--- DOCUMENT CONTENT ---\n${textContent}` }],
      });
    } else {
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });
    }

    const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";
    const stopReason = message.stop_reason;
    const usage = message.usage;
    const cacheRead = (usage as Record<string, unknown>)["cache_read_input_tokens"] as number ?? 0;
    const cacheCreate = (usage as Record<string, unknown>)["cache_creation_input_tokens"] as number ?? 0;
    const costUsd = calcCost(usage);

    if (task === "review-document") {
      const chunkLabel = (body.chunkIndex !== undefined && body.chunkTotal !== undefined)
        ? ` chunk ${body.chunkIndex + 1}/${body.chunkTotal}`
        : " (single)";
      console.log(`[ai-tender-assistant] review-document${chunkLabel}: raw_len=${rawText.length} stop_reason=${stopReason} input_tokens=${usage.input_tokens} output_tokens=${usage.output_tokens}`);
      if (stopReason === "max_tokens") {
        console.warn(`[ai-tender-assistant] review-document${chunkLabel}: TRUNCATED at max_tokens=${maxTokens}.`);
      }
    }

    // ── Helper: log and increment after success ───────────────────────────────
    async function logSuccess(callType: string) {
      if (!orgId) return;
      await Promise.all([
        db.from("ai_usage_log").insert({
          org_id: orgId,
          user_id: userId ?? null,
          feature: "tender-assistant",
          call_type: callType,
          model: "claude-opus-4-5",
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_read_tokens: cacheRead,
          cache_creation_tokens: cacheCreate,
          estimated_cost_usd: costUsd,
          status: "success",
          document_name: body.documentName ?? null,
          document_size_kb: body.documentSizeKb ?? null,
          pages_processed: body.pagesProcessed ?? null,
          chunks_total: body.chunkTotal ?? null,
          chunk_index: body.chunkIndex ?? null,
        }),
        db.rpc("increment_ai_usage", { p_org_id: orgId }),
      ]);
      console.log(`[ai-tender-assistant] logged usage org=${orgId} task=${callType} tokens=${usage.input_tokens}+${usage.output_tokens} cost=$${costUsd.toFixed(6)}`);
    }

    async function logFailed(callType: string, errorCode: string) {
      if (!orgId) return;
      await db.from("ai_usage_log").insert({
        org_id: orgId,
        user_id: userId ?? null,
        feature: "tender-assistant",
        call_type: callType,
        model: "claude-opus-4-5",
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
        cache_read_tokens: cacheRead,
        cache_creation_tokens: cacheCreate,
        estimated_cost_usd: costUsd,
        status: "failed",
        error_code: errorCode,
        document_name: body.documentName ?? null,
        document_size_kb: body.documentSizeKb ?? null,
        pages_processed: body.pagesProcessed ?? null,
        chunks_total: body.chunkTotal ?? null,
        chunk_index: body.chunkIndex ?? null,
      });
    }

    // ── reconcile-findings ────────────────────────────────────────────────────
    if (task === "reconcile-findings") {
      try {
        const sanitized = sanitizeJsonResponse(rawText);
        const suggestions = JSON.parse(sanitized);
        if (!Array.isArray(suggestions)) throw new Error("Expected array");
        console.log(`[ai-tender-assistant] reconcile-findings: ${suggestions.length} suggestions`);
        await logSuccess(task);
        return new Response(
          JSON.stringify({ result: suggestions }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (parseErr) {
        console.error(`[ai-tender-assistant] reconcile-findings: parse failed. ${parseErr instanceof Error ? parseErr.message : parseErr}`);
        await logFailed(task, "parse_error");
        return new Response(
          JSON.stringify({ error: "Reconciliation response could not be parsed.", errorCode: "RECONCILE_PARSE_FAILED" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Document tasks ────────────────────────────────────────────────────────
    if (isDocumentTask) {
      let normalized: ReturnType<typeof normalizeReviewResult>;
      let recovered = false;

      try {
        const parsed = parseReviewResponse(rawText);
        normalized = parsed.result;
        recovered = parsed.recovered;
      } catch (parseErr) {
        console.error(`[ai-tender-assistant] ${task}: JSON parse FAILED. stop_reason=${stopReason}`);

        if (task === "consolidate-review") {
          await logFailed(task, "parse_error");
          return new Response(
            JSON.stringify({ error: "Consolidation response could not be parsed.", errorCode: "CONSOLIDATION_PARSE_FAILED" }),
            { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // For chunk extraction: return empty so processing continues
        const empty = normalizeReviewResult({});
        // Note: don't increment counter for empty/failed parse on chunk
        await logFailed(task, "parse_error");
        return new Response(
          JSON.stringify({
            result: empty,
            findings: countFindings(empty),
            warning: `AI response could not be parsed (stop_reason=${stopReason}). This section returned no results.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const counts = countFindings(normalized);

      if (task === "review-document") {
        const chunkLabel = (body.chunkIndex !== undefined && body.chunkTotal !== undefined)
          ? ` chunk ${body.chunkIndex + 1}/${body.chunkTotal}`
          : " (single)";
        if (counts.total === 0) {
          console.warn(`[ai-tender-assistant] review-document${chunkLabel}: ZERO findings.`);
        } else {
          console.log(`[ai-tender-assistant] review-document${chunkLabel}: total=${counts.total} stop_reason=${stopReason} recovered=${recovered}`);
        }
      }

      if (task === "consolidate-review" && counts.total === 0) {
        console.error(`[ai-tender-assistant] consolidate-review: EMPTY output.`);
        await logFailed(task, "empty_output");
        return new Response(
          JSON.stringify({ error: "Consolidation produced no output.", errorCode: "CONSOLIDATION_EMPTY" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await logSuccess(task);
      return new Response(
        JSON.stringify({ result: normalized, findings: counts }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Single tasks ──────────────────────────────────────────────────────────
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitizeJsonResponse(rawText));
    } catch {
      await logFailed(task, "parse_error");
      return new Response(
        JSON.stringify({ error: "AI returned an unexpected response format. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logSuccess(task);
    return new Response(
      JSON.stringify({ result: parsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const lower = message.toLowerCase();
    const errStatus = (err as { status?: number })?.status;

    const isAuth =
      errStatus === 401 ||
      lower.includes("invalid x-api-key") ||
      lower.includes("invalid api key") ||
      lower.includes("authentication_error") ||
      lower.includes("unauthorized");

    if (isAuth) {
      console.error(`[ai-tender-assistant] Auth error HTTP=${errStatus ?? "unknown"}: ${message}`);
      return new Response(
        JSON.stringify({
          error: "Anthropic API authentication failed. The ANTHROPIC_API_KEY secret is invalid or has expired.",
          errorCode: "INVALID_API_KEY",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isCredit =
      lower.includes("credit balance") ||
      lower.includes("insufficient_quota") ||
      lower.includes("insufficient funds") ||
      lower.includes("billing") ||
      lower.includes("payment") ||
      lower.includes("quota exceeded") ||
      errStatus === 402;

    if (isCredit) {
      console.error(`[ai-tender-assistant] Credit error HTTP=${errStatus ?? "unknown"}`);
      return new Response(
        JSON.stringify({
          error: "AI review could not continue because the Anthropic account has insufficient API credit.",
          errorCode: "INSUFFICIENT_CREDIT",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isPageLimit =
      lower.includes("maximum of 100 pdf pages") ||
      lower.includes("pdf page") ||
      lower.includes("too many pages");

    if (isPageLimit) {
      return new Response(
        JSON.stringify({ error: "This PDF section exceeds the AI page limit. The document may not have split correctly." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.error(`[ai-tender-assistant] Unhandled error HTTP=${errStatus ?? "unknown"}: ${message}`);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
