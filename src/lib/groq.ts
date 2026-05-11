// Reusable AI wrapper for the Paper Generator mini-app.
// Calls the Supabase `test-generator` edge function, which tries Groq first
// (fastest), then falls back through Cohere / Pollinations / Lovable AI.
// Also exposes a local fallback template when every remote provider fails.

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-generator`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface GenerateOptions {
  subject: string;
  marks: string;
  difficulty: string;
  chapters: string[];
  customInstructions?: string;
  title?: string;
}

function buildGeneratePrompt(o: GenerateOptions): string {
  return [
    `Create a Maharashtra State Board CLASS 10 question paper.`,
    `Subject: ${o.subject}`,
    `Total Marks: ${o.marks}`,
    `Difficulty: ${o.difficulty}`,
    `Chapters: ${o.chapters.length ? o.chapters.join(', ') : 'All chapters'}`,
    o.title ? `Paper Title: ${o.title}` : '',
    '',
    'Requirements:',
    '- Follow exact SSC board pattern with proper section headers (Section A, B, C, ...)',
    '- Auto-distribute 1-mark, 2-mark, 3-mark, 4/5-mark questions and MCQs as appropriate',
    '- Show marks in brackets on every question, e.g. "(2 marks)"',
    '- Include instructions at the top (time, total marks, attempt rules)',
    '- For Science: include MCQs and short-answer mixes',
    '- For Math: include HOTS and proofs/derivations',
    '- For English: include passage, grammar, writing skills',
    '- Do not include the answer key',
    '- Use clean plain text formatting (no markdown bold/italics)',
    o.customInstructions ? `\nCustom instructions: ${o.customInstructions}` : '',
  ].filter(Boolean).join('\n');
}

function buildCheckPrompt(paper: string): string {
  return [
    'You are an expert Maharashtra State Board Class 10 paper reviewer.',
    'Review the following question paper and produce a structured report covering:',
    '1. Marks distribution (is it balanced & correct?)',
    '2. Difficulty balance (Easy/Medium/Hard mix)',
    '3. Duplicate or repetitive questions',
    '4. Chapter coverage (which chapters are covered/missing)',
    '5. Board pattern accuracy (sections, instructions, marks shown)',
    '6. Overall score out of 10 with key recommendations',
    '',
    'Paper:',
    '"""',
    paper,
    '"""',
  ].join('\n');
}

async function callAI(prompt: string): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${text || 'unknown error'}`);
  }

  const data = await res.json();
  const out = (data.paper || data.result || data.text || '').toString().trim();
  if (!out) throw new Error('AI returned an empty response.');
  return out;
}

export async function generatePaper(opts: GenerateOptions): Promise<string> {
  try {
    return await callAI(buildGeneratePrompt(opts));
  } catch (err) {
    console.error('[groq] generate failed, using local fallback:', err);
    return localFallbackPaper(opts);
  }
}

export async function checkPaper(paper: string): Promise<string> {
  return callAI(buildCheckPrompt(paper));
}

function localFallbackPaper(o: GenerateOptions): string {
  const date = new Date().toLocaleDateString();
  return `MAHARASHTRA STATE BOARD - CLASS 10
Subject: ${o.subject}        Total Marks: ${o.marks}
Date: ${date}                Difficulty: ${o.difficulty}

General Instructions:
1. All questions are compulsory.
2. Figures to the right indicate full marks.
3. Draw neat diagrams wherever necessary.

(Offline fallback template — please reconnect to generate a full AI paper.)

Section A — Objective (MCQs / Fill in the blanks)
Q1. Attempt any 5: (5 marks)
   i)   ...
   ii)  ...
   iii) ...
   iv)  ...
   v)   ...

Section B — Short Answer (2 marks each)
Q2. Attempt any 4: (8 marks)

Section C — Long Answer (3 marks each)
Q3. Attempt any 3: (9 marks)

Section D — Application / HOTS (4 marks each)
Q4. Attempt any 2: (8 marks)

Chapters covered: ${o.chapters.join(', ') || 'All chapters'}
${o.customInstructions ? `\nCustom: ${o.customInstructions}` : ''}`;
}
