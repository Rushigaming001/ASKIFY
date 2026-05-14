// SSC Board Paper Intelligence — analyze, predict, inject creative-question styles.
// Uses Lovable AI Gateway. All actions require authenticated callers (verify_jwt = true).

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FAST_MODEL = "google/gemini-2.5-flash";
const STRONG_MODEL = "google/gemini-2.5-pro";

type Subject = "English" | "Mathematics 1" | "Mathematics 2" | "Science 1" | "Science 2";

interface PaperRef {
  year: number;
  subject: string;
  title: string;
  content: string;
}

const CREATIVE_STYLES = [
  "Did You Know?", "Fun Fact", "Challenge Question",
  "Board Trick Question", "Examiner Favorite",
  "Most Confusing Concept", "Concept Booster", "Memory Trick",
];

async function callGateway(messages: any[], opts: { model?: string; maxTokens?: number; tools?: any[]; toolChoice?: any } = {}) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const body: Record<string, unknown> = {
    model: opts.model || FAST_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? 2400,
  };
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new Error("Rate limited by AI gateway, please retry shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 300)}`);
  }
  return await res.json();
}

function extractText(json: any): string {
  return json?.choices?.[0]?.message?.content?.toString().trim() ?? "";
}

function extractToolArgs(json: any): any | null {
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return null;
  try { return JSON.parse(call.function.arguments); } catch { return null; }
}

// ----- Action: analyze -----
async function analyze(subject: Subject, papers: PaperRef[]) {
  const usable = papers.filter((p) => p.content && p.content.trim().length > 200);
  const coverage = {
    totalProvided: papers.length,
    withContent: usable.length,
    yearsAvailable: usable.map((p) => p.year).sort(),
    yearsMissing: papers.filter((p) => !p.content || p.content.trim().length <= 200).map((p) => p.year).sort(),
  };

  if (usable.length === 0) {
    return {
      subject,
      coverage,
      repeatedQuestions: [],
      chapterWeightage: {},
      trends: [],
      importantConcepts: [],
      note: "No paper content available yet. Owner must upload paper text in Owner Settings before analysis can run.",
    };
  }

  const corpus = usable
    .map((p) => `### ${p.year} — ${p.subject}\n${p.content.slice(0, 4500)}`)
    .join("\n\n---\n\n");

  const tool = {
    type: "function",
    function: {
      name: "report_analysis",
      description: "Return a structured analysis of Maharashtra SSC board papers.",
      parameters: {
        type: "object",
        properties: {
          repeatedQuestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                chapter: { type: "string" },
                frequency: { type: "integer" },
                yearsAsked: { type: "array", items: { type: "integer" } },
                confidence: { type: "number" },
                tag: { type: "string", description: "e.g. 'Most Expected', 'Important Theorem', 'Frequently Repeated'" },
              },
              required: ["question", "chapter", "frequency", "confidence"],
            },
          },
          chapterWeightage: {
            type: "object",
            description: "Map of chapter name → average marks across papers",
            additionalProperties: { type: "number" },
          },
          trends: { type: "array", items: { type: "string" } },
          importantConcepts: { type: "array", items: { type: "string" } },
        },
        required: ["repeatedQuestions", "chapterWeightage", "trends", "importantConcepts"],
      },
    },
  };

  const json = await callGateway([
    {
      role: "system",
      content:
        "You are a Maharashtra SSC board exam analyst. Read past board papers and produce structured intelligence: repeated questions, chapter weightage, trends, important concepts. Be precise and grounded in what is actually present in the supplied papers — do not fabricate.",
    },
    {
      role: "user",
      content: `Subject: ${subject}\nPapers (${usable.length}):\n\n${corpus}\n\nProduce the structured analysis now.`,
    },
  ], { model: FAST_MODEL, maxTokens: 3000, tools: [tool], toolChoice: { type: "function", function: { name: "report_analysis" } } });

  const args = extractToolArgs(json) || { repeatedQuestions: [], chapterWeightage: {}, trends: [], importantConcepts: [] };
  return { subject, coverage, ...args };
}

// ----- Action: predict -----
async function predict(subject: Subject, targetYear: number, analysis: any, papers: PaperRef[]) {
  const sample = papers.find((p) => p.content && p.content.length > 500);
  const styleSample = sample ? `\n\nReference layout from ${sample.year}:\n${sample.content.slice(0, 2500)}` : "";
  const trendsTxt = (analysis?.trends || []).slice(0, 12).map((t: string) => `- ${t}`).join("\n") || "(no trends supplied)";
  const conceptsTxt = (analysis?.importantConcepts || []).slice(0, 15).map((t: string) => `- ${t}`).join("\n") || "(none)";
  const repeatedTxt = (analysis?.repeatedQuestions || []).slice(0, 12)
    .map((q: any) => `- [${q.chapter}] ${q.question} (asked ${q.frequency}× — ${q.tag || "Important"})`)
    .join("\n") || "(none)";

  const json = await callGateway([
    {
      role: "system",
      content:
        "You are a senior Maharashtra SSC board paper setter. Generate a realistic full-length predicted paper that mirrors the official SSC blueprint, language, and layout. Do not include answers. Output plain text only — no markdown.",
    },
    {
      role: "user",
      content:
`Predicted Paper for: ${targetYear} — Subject: ${subject}

Begin with these EXACT lines (no changes):
ASKIFY
Welcome To The World of Possibilities
SSC BOARD ${targetYear} (Predicted) — ${subject}

Use these board trends:
${trendsTxt}

Prioritize these high-frequency questions and concepts:
${repeatedTxt}

Important concepts to weave in:
${conceptsTxt}

Inject 3 creative-style questions clearly labeled with one of: ${CREATIVE_STYLES.join(", ")}.
Show marks in brackets e.g. (3 marks). End the paper with the EXACT line:
Referred from Maharashtra State Board Question Papers 2015–2026
${styleSample}`,
    },
  ], { model: STRONG_MODEL, maxTokens: 3500 });

  return { paper: extractText(json), targetYear, subject };
}

// ----- Action: inject-styles -----
async function injectStyles(paper: string) {
  const json = await callGateway([
    {
      role: "system",
      content: "You enhance Maharashtra SSC papers by adding 3-5 creative-style bonus questions inline (Did You Know?, Fun Fact, Challenge Question, Board Trick, Examiner Favorite, Memory Trick). Preserve all existing questions and marks structure.",
    },
    { role: "user", content: paper },
  ], { model: FAST_MODEL, maxTokens: 2400 });
  return { paper: extractText(json) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, subject, papers, targetYear, analysis, paper } = await req.json();
    let result: unknown;

    switch (action) {
      case "analyze":
        if (!subject || !Array.isArray(papers)) throw new Error("analyze requires { subject, papers[] }");
        result = await analyze(subject, papers);
        break;
      case "predict":
        if (!subject || !targetYear) throw new Error("predict requires { subject, targetYear, analysis?, papers[] }");
        result = await predict(subject, Number(targetYear), analysis || {}, Array.isArray(papers) ? papers : []);
        break;
      case "inject-styles":
        if (!paper) throw new Error("inject-styles requires { paper }");
        result = await injectStyles(String(paper));
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ ok: true, ...(result as object) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[ssc-intelligence] error:", msg, e instanceof Error ? e.stack : "");
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
