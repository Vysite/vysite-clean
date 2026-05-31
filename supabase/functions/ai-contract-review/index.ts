import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.30.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
// Strips markdown fences, trims leading/trailing non-JSON text, recovers the
// outermost JSON object. Matches the pattern used in ai-tender-assistant.

function sanitizeJsonResponse(raw: string): string {
  let s = raw.trim();

  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  // Find outermost { ... }
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
// When max_tokens truncates the response, the JSON is cut mid-object.
// Attempt to recover: extract executiveSummary and all complete findings
// from the fragment before the truncation point.

function tryRecoverTruncated(raw: string): Record<string, unknown> | null {
  const result: Record<string, unknown> = {
    executiveSummary: "",
    findings: [],
    commercialHandoverNotes: "",
  };
  let recovered = 0;

  // Try to extract executiveSummary (string field)
  const summaryMatch = raw.match(/"executiveSummary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    try { result.executiveSummary = JSON.parse(`"${summaryMatch[1]}"`); } catch { /* ignore */ }
  }

  // Try to extract commercialHandoverNotes (string field)
  const handoverMatch = raw.match(/"commercialHandoverNotes"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (handoverMatch) {
    try { result.commercialHandoverNotes = JSON.parse(`"${handoverMatch[1]}"`); } catch { /* ignore */ }
  }

  // Try to extract complete findings objects from the findings array
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
// Never crash on a missing/wrong field — log and use safe defaults.

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

  // Source traceability — all fields optional
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

  // Keep section list concise — injecting the full list inflates the prompt and
  // wastes tokens before the AI even starts reading the contract.
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

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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

    const client = new Anthropic({ apiKey });
    const prompt = buildPrompt(body);

    // Use 8192 tokens — contract review JSON schema is large.
    // Mirror the max_tokens used by ai-tender-assistant for document review.
    const MAX_TOKENS = 8192;

    let message: Anthropic.Message;

    if (body.documentBase64 && body.documentMimeType === "application/pdf") {
      // PDF: use document block — same pattern as ai-tender-assistant
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
      // Non-PDF (text, docx extracted text, etc.) — embed in prompt string
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

    // Always log response stats — essential for diagnosing parse failures
    console.log(`[contract-review]${chunkLabel}: raw_len=${rawText.length} stop_reason=${stopReason}`);

    if (stopReason === "max_tokens") {
      console.warn(`[contract-review]${chunkLabel}: TRUNCATED at max_tokens=${MAX_TOKENS}. Will attempt partial recovery.`);
    }

    if (rawText.length < 20) {
      console.warn(`[contract-review]${chunkLabel}: Very short response (${rawText.length} chars): "${rawText}"`);
    }

    // Log the first 300 chars of the raw response to help diagnose formatting issues
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
        `sanitized_len=${sanitized.length} sanitized_start="${sanitized.slice(0, 200).replace(/\n/g, "\\n")}". ` +
        `Attempting partial recovery...`
      );

      // Attempt partial recovery from truncated JSON
      const partial = tryRecoverTruncated(rawText);
      if (partial && (
        (partial.findings as unknown[]).length > 0 ||
        typeof partial.executiveSummary === "string" && (partial.executiveSummary as string).length > 10
      )) {
        parsed = partial;
        recovered = true;
        console.log(`[contract-review]${chunkLabel}: Partial recovery succeeded. findings=${(partial.findings as unknown[]).length}`);
      } else {
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
