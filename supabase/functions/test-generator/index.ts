import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { checkDDoS } from "../_shared/ddos.ts";
import { errorResponse, installGlobalErrorHandlers } from "../_shared/errors.ts";
installGlobalErrorHandlers("test-generator");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert Maharashtra State Board question paper creator. Always produce exam-grade, class-appropriate papers with clean sectioning and exact marks distribution. Strictly scale question count with total marks, follow the user's unit-term mapping, and improve conceptual quality across Easy, Medium, Hard, and Very Difficult modes.`;

// ---------- providers ----------
type Provider = { name: string; run: (prompt: string, opts: { maxTokens: number; system?: string }) => Promise<string> };

function providers(): Provider[] {
  const list: Provider[] = [];
  const GROQ = Deno.env.get("GROQ_API_KEY");
  const COHERE = Deno.env.get("COHERE_API_KEY");
  const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
  const POLL1 = Deno.env.get("POLLINATIONS_API_KEY_1");
  const POLL2 = Deno.env.get("POLLINATIONS_API_KEY_2");

  if (GROQ) list.push({
    name: "groq",
    run: async (prompt, { maxTokens, system }) => {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: system ?? SYSTEM_PROMPT }, { role: "user", content: prompt }],
          max_tokens: maxTokens, temperature: 0.7,
        }),
      });
      if (!r.ok) throw new Error(`groq ${r.status}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content ?? "";
    },
  });

  if (COHERE) list.push({
    name: "cohere",
    run: async (prompt, { system }) => {
      const r = await fetch("https://api.cohere.ai/v2/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${COHERE}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "command-r-08-2024",
          messages: [{ role: "system", content: system ?? SYSTEM_PROMPT }, { role: "user", content: prompt }],
        }),
      });
      if (!r.ok) throw new Error(`cohere ${r.status}`);
      const d = await r.json();
      return d.message?.content?.[0]?.text ?? "";
    },
  });

  const pollRun = (key: string, label: string): Provider => ({
    name: label,
    run: async (prompt, { maxTokens, system }) => {
      const r = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages: [{ role: "system", content: system ?? SYSTEM_PROMPT }, { role: "user", content: prompt }],
          max_tokens: maxTokens,
        }),
      });
      if (!r.ok) throw new Error(`${label} ${r.status}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content ?? "";
    },
  });
  if (POLL1) list.push(pollRun(POLL1, "pollinations1"));
  if (POLL2) list.push(pollRun(POLL2, "pollinations2"));

  if (LOVABLE) list.push({
    name: "lovable",
    run: async (prompt, { maxTokens, system }) => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [{ role: "system", content: system ?? SYSTEM_PROMPT }, { role: "user", content: prompt }],
          max_tokens: maxTokens,
        }),
      });
      if (!r.ok) throw new Error(`lovable ${r.status}`);
      const d = await r.json();
      return d.choices?.[0]?.message?.content ?? "";
    },
  });

  return list;
}

async function tryProviders(prov: Provider[], prompt: string, maxTokens: number): Promise<string> {
  for (const p of prov) {
    try {
      const out = await p.run(prompt, { maxTokens });
      if (out?.trim()) { console.log(`[seq] ${p.name} ok`); return out; }
    } catch (e) { console.log(`[seq] ${p.name} failed`, (e as Error).message); }
  }
  throw new Error("All AI services unavailable.");
}

async function runAllParallel(prov: Provider[], prompt: string, maxTokens: number) {
  const results = await Promise.allSettled(prov.map((p) => p.run(prompt, { maxTokens }).then((t) => ({ name: p.name, text: t }))));
  return results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((x): x is { name: string; text: string } => !!x && !!x.text?.trim());
}

function buildSynthesisPrompt(originalPrompt: string, drafts: { name: string; text: string }[], thinking: boolean) {
  const draftBlock = drafts.map((d, i) => `--- Draft ${i + 1} (from ${d.name}) ---\n${d.text}`).join("\n\n");
  return `${thinking ? "MASTERPIECE MODE — synthesize the BEST possible paper." : "MULTI-AI MERGE — produce the best paper from the drafts."}\n\nORIGINAL TASK:\n${originalPrompt}\n\nDRAFTS FROM MULTIPLE AI MODELS:\n${draftBlock}\n\nINSTRUCTIONS:\n- Read every draft.\n- Pick the strongest questions, sectioning, marks split, and language.\n- Remove duplicates, fix marks-distribution errors, ensure board-pattern accuracy.\n- Keep the original structural rules (header line, tagline line, footer reference).\n- Output ONLY the final consolidated paper (no commentary, no answer key).${thinking ? "\n- Think carefully step-by-step internally; output only the polished paper." : ""}`;
}

function buildReviewPrompt(paper: string) {
  return `Quickly review this Maharashtra Board paper. Return a 5-line bullet report: marks balance, difficulty mix, duplicates, chapter coverage, overall score /10.\n\nPAPER:\n${paper}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ddos = checkDDoS(req, corsHeaders, { key: "test-generator", limit: 12 });
  if (ddos) return ddos;

  try {
    const body = await req.json();
    const prompt: string = body.prompt;
    const mode: "quick" | "standard" | "multi" | "thinking" = body.mode ?? "standard";

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prov = providers();
    if (prov.length === 0) {
      return new Response(JSON.stringify({ error: "No AI providers configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- QUICK: single fastest provider, smaller token budget ----
    if (mode === "quick") {
      const fast = prov[0]; // groq first if present
      const text = await fast.run(prompt + "\n\nKeep it concise but complete (target <10s).", { maxTokens: 1800 });
      return new Response(JSON.stringify({ paper: text, mode, providersUsed: [fast.name] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- MULTI / STANDARD: parallel drafts + synthesis ----
    if (mode === "multi" || mode === "standard") {
      const drafts = await runAllParallel(prov.slice(0, 4), prompt, 3000);
      if (drafts.length === 0) throw new Error("All providers failed.");
      let final = drafts[0].text;
      // Synthesize using the strongest available (Lovable > Groq)
      const synth = prov.find((p) => p.name === "lovable") ?? prov[0];
      try {
        const merged = await synth.run(buildSynthesisPrompt(prompt, drafts, false), { maxTokens: 4000 });
        if (merged?.trim()) final = merged;
      } catch (e) { console.log("synthesis failed, using best draft:", (e as Error).message); }
      return new Response(JSON.stringify({ paper: final, mode, providersUsed: drafts.map((d) => d.name), draftCount: drafts.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- THINKING (masterpiece): all providers + reasoning synthesis + review ----
    if (mode === "thinking") {
      const drafts = await runAllParallel(prov, prompt, 3500);
      if (drafts.length === 0) throw new Error("All providers failed.");
      const synth = prov.find((p) => p.name === "lovable") ?? prov[0];
      let masterpiece = drafts[0].text;
      try {
        const merged = await synth.run(buildSynthesisPrompt(prompt, drafts, true), { maxTokens: 5000 });
        if (merged?.trim()) masterpiece = merged;
      } catch (e) { console.log("masterpiece synthesis failed:", (e as Error).message); }
      // Auto-review
      let review: string | null = null;
      try { review = await synth.run(buildReviewPrompt(masterpiece), { maxTokens: 600 }); } catch { /* skip */ }
      return new Response(JSON.stringify({
        paper: masterpiece, mode, providersUsed: drafts.map((d) => d.name), draftCount: drafts.length, review,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // fallback to old sequential behavior
    const text = await tryProviders(prov, prompt, 4000);
    return new Response(JSON.stringify({ paper: text, mode: "fallback" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return errorResponse(error, { fn: "test-generator", corsHeaders });
  }
});
