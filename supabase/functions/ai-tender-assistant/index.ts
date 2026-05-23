import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.30.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type AITask =
  | "draft-rfi"
  | "suggest-assumptions"
  | "suggest-exclusions"
  | "draft-scope-note"
  | "identify-risks"
  | "review-document"
  | "consolidate-review";

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
  mergedResult?: unknown;
  totalPages?: number;
  chunkCount?: number;
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

/**
 * Attempts to extract a JSON object or array from a Claude response that may
 * contain markdown fences, prose preamble, or other non-JSON wrapping.
 */
function sanitizeJsonResponse(raw: string): string {
  let s = raw.trim();

  // Strip markdown fences: ```json ... ``` or ``` ... ```
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  // If there's still no leading { or [, find the first one
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

  // Trim trailing prose after the final } or ]
  const lastBrace = s.lastIndexOf("}");
  const lastBracket = s.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket);
  if (end >= 0 && end < s.length - 1) s = s.slice(0, end + 1);

  return s.trim();
}

/**
 * Safely normalises a parsed AI response to the DocumentReviewResult shape.
 * Any missing or malformed fields are replaced with empty arrays.
 */
function normalizeReviewResult(parsed: unknown): {
  rfis: unknown[];
  assumptions: string[];
  exclusions: string[];
  scopeNotes: string[];
  risks: unknown[];
} {
  const obj = (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))
    ? parsed as Record<string, unknown>
    : {};

  function safeStringArray(val: unknown): string[] {
    if (!Array.isArray(val)) return [];
    return val.filter((x): x is string => typeof x === "string");
  }

  function safeArray(val: unknown): unknown[] {
    return Array.isArray(val) ? val : [];
  }

  return {
    rfis: safeArray(obj["rfis"]),
    assumptions: safeStringArray(obj["assumptions"]),
    exclusions: safeStringArray(obj["exclusions"]),
    scopeNotes: safeStringArray(obj["scopeNotes"] ?? obj["scope_notes"] ?? obj["scopenotes"]),
    risks: safeArray(obj["risks"]),
  };
}

/**
 * Parses a raw AI response string, applying sanitisation and normalisation.
 * Throws if JSON cannot be extracted after sanitisation.
 */
function parseReviewResponse(raw: string): ReturnType<typeof normalizeReviewResult> {
  const sanitized = sanitizeJsonResponse(raw);
  const parsed = JSON.parse(sanitized); // throws if still invalid
  return normalizeReviewResult(parsed);
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
      const chunkCtx = body.chunkInfo ? `\n\nSection context: ${body.chunkInfo}` : "";
      return `${tenderCtx}Review the attached tender document${body.documentName ? ` (${body.documentName})` : ""} and extract commercially useful information for a UK construction tender submission.${chunkCtx}

Respond with ONLY this exact JSON structure — no markdown fences, no commentary, nothing outside the JSON:
{
  "rfis": [
    {"subject":"concise RFI subject","query":"clear query wording","responseRequired":"what information is needed","impact":"commercial or programme impact if not resolved"}
  ],
  "assumptions": ["assumption string starting with Assumed or It is assumed that"],
  "exclusions": ["exclusion string"],
  "scopeNotes": ["scope note or key commercial information extracted from document"],
  "risks": [
    {"risk":"risk description","severity":"High|Medium|Low","suggestedAction":"RFI|Assumption|Exclusion|Scope Note|None","actionNote":"recommended action"}
  ]
}

RFIs: missing/unclear/conflicting information needing clarification — design responsibility, missing specs, ambiguous scope, missing drawings, commissioning requirements.
Assumptions: start each with "Assumed" or "It is assumed that" — based on what the document states or implies.
Exclusions: items to exclude from tender price — builders work, asbestos, scaffolding, out-of-hours, statutory fees, design, utility charges.
Scope Notes: key commercial information — named products, equipment references, performance requirements, technical standards, specified systems, interface requirements.
Risks: commercial/programme/technical risks — unclear scope, incomplete info, coordination risks, long-lead equipment, unusual specifications, commercial exposure.

Aim for 3-8 items per section based only on document content. Do not invent items.`;
    }

    case "consolidate-review": {
      const merged = JSON.stringify(body.mergedResult, null, 2);
      return `${tenderCtx}The following is a combined tender review extracted from a ${body.totalPages}-page document reviewed in ${body.chunkCount} sections. It may contain duplicates or near-duplicates across sections.

Consolidate into one clean deduplicated review:

${merged}

Rules:
1. Remove exact duplicate items
2. Merge near-identical RFIs into one — keep the most complete version
3. Merge near-identical assumptions, exclusions, scope notes into one
4. Keep all genuinely distinct risks; merge near-duplicates keeping highest severity
5. Tidy wording where needed — keep professional UK construction tone
6. Do not invent new items not present in the input
7. Preserve all genuinely distinct commercial findings

Respond with ONLY this JSON structure — no markdown, no commentary:
{
  "rfis": [{"subject":"...","query":"...","responseRequired":"...","impact":"..."}],
  "assumptions": ["..."],
  "exclusions": ["..."],
  "scopeNotes": ["..."],
  "risks": [{"risk":"...","severity":"High|Medium|Low","suggestedAction":"...","actionNote":"..."}]
}`;
    }
  }
}

// ─── Request handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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

    if (!isDocumentTask && !body.context?.trim()) {
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

    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(task, body);

    let message: Anthropic.Message;

    if (task === "review-document" && body.documentBase64 && body.documentMimeType === "application/pdf") {
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 4096,
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
    } else if (task === "review-document" && body.documentBase64 && body.documentMimeType) {
      const textContent = body.documentText ?? "Document content not available for this file type.";
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: `${prompt}\n\n--- DOCUMENT CONTENT ---\n${textContent}` }],
      });
    } else if (task === "review-document" && body.documentText) {
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: `${prompt}\n\n--- DOCUMENT CONTENT ---\n${body.documentText}` }],
      });
    } else if (task === "consolidate-review") {
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 6000,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });
    } else {
      message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });
    }

    const rawText = message.content[0]?.type === "text" ? message.content[0].text : "";

    // For document review tasks, apply full sanitisation + normalisation
    if (isDocumentTask) {
      try {
        const normalized = parseReviewResponse(rawText);
        return new Response(
          JSON.stringify({ result: normalized }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        // Last-ditch: return empty structure rather than a hard failure
        // so the client can continue processing remaining chunks
        const empty = normalizeReviewResult({});
        return new Response(
          JSON.stringify({
            result: empty,
            warning: "AI response could not be parsed — this section may have returned no results.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For non-document tasks (single-call), parse normally
    let parsed: unknown;
    try {
      parsed = JSON.parse(sanitizeJsonResponse(rawText));
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned an unexpected response format. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ result: parsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const lower = message.toLowerCase();

    const isCredit =
      lower.includes("credit balance") ||
      lower.includes("insufficient_quota") ||
      lower.includes("insufficient funds") ||
      lower.includes("billing") ||
      lower.includes("payment") ||
      lower.includes("quota exceeded") ||
      (err as { status?: number })?.status === 402;

    if (isCredit) {
      return new Response(
        JSON.stringify({
          error: "AI review could not continue because the connected Anthropic account has insufficient API credit. Please add credit to the Anthropic account and retry.",
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
        JSON.stringify({
          error: "This PDF section still exceeds the AI page limit. The document may not have split correctly — please try uploading a smaller section manually.",
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
