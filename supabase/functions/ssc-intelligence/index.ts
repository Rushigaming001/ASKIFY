// SSC Board Paper Intelligence — analyze, predict, inject creative-question styles.
// Powered by OpenAI / Gemini / Claude / Anthropic. All actions require authenticated callers.

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
  const usable = papers.filter((p) => p.content && p.content.trim().length > 200);
  const yearsWithContent = usable.map((p) => p.year).sort();
  const allYears = Array.from({ length: 12 }, (_, i) => 2015 + i); // 2015..2026
  const samples = usable
    .slice(0, 6) // up to 6 reference papers across years
    .map((p) => `### Reference — ${p.year} ${p.subject}\n${p.content.slice(0, 2200)}`)
    .join("\n\n---\n\n");
  const trendsTxt = (analysis?.trends || []).slice(0, 15).map((t: string) => `- ${t}`).join("\n") || "(no trends supplied — use your knowledge of Maharashtra SSC pattern)";
  const conceptsTxt = (analysis?.importantConcepts || []).slice(0, 20).map((t: string) => `- ${t}`).join("\n") || "(use full SSC syllabus)";
  const repeatedTxt = (analysis?.repeatedQuestions || []).slice(0, 15)
    .map((q: any) => `- [${q.chapter}] ${q.question} (asked ${q.frequency}× — ${q.tag || "Important"})`)
    .join("\n") || "(use repeated SSC patterns from 2015–2026)";

  const blueprint = subject.startsWith("Mathematics")
    ? "MATHEMATICS BLUEPRINT (40 marks): Q1 MCQ (4×1=4), Q1B fill-blanks/short (4×1=4), Q2A complete activity (3×2=6), Q2B solve (3×2=6), Q3A activity (2×3=6), Q3B solve (3×3=9), Q4 (2×4=8), Q5 challenging (1×3=3). Total ≈ 46 questions to choose ≈ 40 marks."
    : subject === "English"
    ? "ENGLISH BLUEPRINT (80 marks): Section A Reading Skills (Seen + Unseen passages, 20m), Section B Writing Skills (Letter, Speech, Report, Appeal, View-counterview, Information transfer, 20m), Section C Poetry (Appreciation + comprehension, 10m), Section D Genre Novel/Drama (10m), Section E Grammar & Vocabulary (20m)."
    : "SCIENCE BLUEPRINT (40 marks): Q1A MCQ (5×1=5), Q1B one-word/match (5×1=5), Q2A complete chart/diagram (3×2=6), Q2B short answer (3×2=6), Q3 (5×3=15), Q4 long answer (1×5=5). Include diagram-based and reasoning questions.";

  const json = await callGateway([
    {
      role: "system",
      content:
        "You are the senior Maharashtra State Board (SSC) paper setter with 15+ years of experience. You have studied EVERY board paper from 2015 through 2026 across English, Mathematics 1, Mathematics 2, Science 1 and Science 2. Generate a COMPLETE, full-length, exam-grade predicted paper that strictly follows the official SSC blueprint, language, formatting, mark distribution and section layout. Every question must be MEANINGFUL, syllabus-accurate, classroom-tested, and worth its marks — no filler, no vague prompts, no off-syllabus content. Do NOT include answers. Output PLAIN TEXT ONLY (no markdown, no asterisks, no code fences).",
    },
    {
      role: "user",
      content:
`Generate the FULL predicted SSC board paper for ${targetYear} — Subject: ${subject}.

You MUST draw patterns, repeated questions, weightage and difficulty from ALL Maharashtra SSC board papers across the years 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025 and 2026 — NOT only one year. Reference papers actually uploaded so far cover years: ${yearsWithContent.length ? yearsWithContent.join(", ") : "none uploaded — rely entirely on your training knowledge of SSC papers across 2015–2026"}. For the remaining years (${allYears.filter((y) => !yearsWithContent.includes(y)).join(", ") || "none"}) use your historical knowledge of Maharashtra SSC board papers and chapter weightage.

${blueprint}

Begin the output with these EXACT lines (do not modify):
ASKIFY
Welcome To The World of Possibilities
SSC BOARD ${targetYear} (Predicted) — ${subject}
Time: 2 Hours                                          Total Marks: ${subject === "English" ? 80 : 40}
General Instructions:
(i) All questions are compulsory.
(ii) Use of calculator is not allowed.
(iii) Figures to the right indicate full marks.
(iv) Draw neat, labelled diagrams wherever necessary.

Then produce the COMPLETE paper, properly sectioned (Q1, Q2, Q3 ...), with sub-parts (A), (B) and clear marks in brackets at the end of each question, e.g. (3 marks). Cover the FULL syllabus chapters with realistic weightage based on the historical pattern.

Use these board trends from 2015–2026:
${trendsTxt}

Prioritize these high-frequency / repeated questions across years:
${repeatedTxt}

Important concepts to weave in:
${conceptsTxt}

Inject EXACTLY 3 creative-style bonus questions clearly tagged with one of: ${CREATIVE_STYLES.join(", ")} — placed naturally inside relevant sections, not at the end.

End the paper with the EXACT line (no changes):
Referred from Maharashtra State Board Question Papers 2015–2026

Hard rules:
- Total questions and marks must EXACTLY match the blueprint.
- Every question must be meaningful, exam-ready, syllabus-accurate.
- No placeholder text, no "TBD", no half-questions, no duplicates.
- Diagrams referenced must make sense (you may write "[Diagram: ...]").

${samples ? `Reference layouts from real uploaded papers:\n\n${samples}` : ""}`,
    },
  ], { model: STRONG_MODEL, maxTokens: 7000 });

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
