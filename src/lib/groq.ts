// Reusable AI wrapper for the Paper Generator mini-app.
// Calls the Supabase `test-generator` edge function, which tries Groq first
// (fastest), then falls back through Cohere / Pollinations / Lovable AI.

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-generator`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const ASKIFY_HEADER = 'ASKIFY';
export const ASKIFY_TAGLINE = 'Welcome To The World of Possibilities';
export const REFERRED_FOOTER = 'Referred from Maharashtra State Board Question Paper - 2015';

export interface SampleImageRef {
  /** data URL (data:image/...;base64,...) so it can be rendered offline */
  dataUrl: string;
  /** short caption / what this image represents (e.g. "Diagram for Q4", "Section B layout") */
  caption?: string;
}

export interface SamplePaperRef {
  title: string;
  content: string;
  images?: SampleImageRef[];
}

export interface GenerateOptions {
  subject: string;
  marks: string;
  difficulty: string;
  chapters: string[];
  customInstructions?: string;
  title?: string;
  /** Owner-curated sample papers used as exemplars for this subject. */
  samplePapers?: SamplePaperRef[];
}

const SAMPLE_PAPERS_KEY = 'paperapp.samplePapers.v1';
export const OWNER_EMAIL = 'yenurkarrajabhau@gmail.com';

export type SamplePapersMap = Record<string, SamplePaperRef[]>;

export function loadSamplePapers(): SamplePapersMap {
  try {
    const v = localStorage.getItem(SAMPLE_PAPERS_KEY);
    return v ? (JSON.parse(v) as SamplePapersMap) : {};
  } catch {
    return {};
  }
}
export function saveSamplePapers(map: SamplePapersMap) {
  try { localStorage.setItem(SAMPLE_PAPERS_KEY, JSON.stringify(map)); } catch { /* quota */ }
}
export function getSamplesForSubject(subject: string): SamplePaperRef[] {
  return loadSamplePapers()[subject] ?? [];
}

function isScience(subject: string) {
  return subject.toLowerCase().startsWith('science');
}

function buildGeneratePrompt(o: GenerateOptions): string {
  const sampleBlock = (o.samplePapers && o.samplePapers.length)
    ? [
        '',
        'OWNER-PROVIDED SAMPLE PAPERS (use these as the primary style/format reference):',
        ...o.samplePapers.slice(0, 3).map((s, i) => {
          const imgNote = s.images && s.images.length
            ? `\n[Owner attached ${s.images.length} reference image(s): ${s.images.map((im, k) => im.caption || `image ${k + 1}`).join('; ')}. Treat these as visual exemplars of layout, diagrams, and section style.]`
            : '';
          return `\n--- Sample ${i + 1}: ${s.title} ---${imgNote}\n${s.content.slice(0, 4000)}`;
        }),
        '--- end samples ---',
      ].join('\n')
    : '';

  const scienceExtras = isScience(o.subject)
    ? [
        '',
        'SCIENCE-SPECIFIC REQUIREMENTS:',
        '- Pull additional questions from textbook features: "Do You Know?", "Introduction", "Use Your Brain Power", and chapter-end "Activities".',
        '- Include at least 2 questions framed from "Do You Know?" boxes (concept-application style).',
        '- Include at least 1 activity-based question (observation / experiment / procedure write-up).',
        '- Include at least 1 introduction-derived conceptual question per selected chapter where possible.',
        '- Mix factual recall, reasoning, diagram-based, and application questions.',
      ].join('\n')
    : '';

  return [
    `Create a Maharashtra State Board CLASS 10 question paper.`,
    `Reference base: Maharashtra Board 2015 SSC question papers (pattern, marks split, language, section structure).`,
    `Subject: ${o.subject}`,
    `Total Marks: ${o.marks}`,
    `Difficulty: ${o.difficulty}`,
    `Chapters: ${o.chapters.length ? o.chapters.join(', ') : 'All chapters'}`,
    o.title ? `Paper Title: ${o.title}` : '',
    '',
    'STRICT OUTPUT RULES:',
    `- Line 1 must be exactly: ${ASKIFY_HEADER}`,
    `- Line 2 must be exactly: ${ASKIFY_TAGLINE}`,
    '- Line 3 should be the paper title / subject header.',
    '- Follow the SSC 2015 board pattern: Section A, B, C, D with correct marks split.',
    '- Auto-distribute 1-mark, 2-mark, 3-mark, 4/5-mark questions and MCQs as appropriate.',
    '- Show marks in brackets on every question, e.g. "(2 marks)".',
    '- Include instructions at the top (time, total marks, attempt rules).',
    '- For Math: include HOTS, proofs/derivations, construction questions.',
    '- For English: include passage, grammar, writing skills.',
    '- Do not include the answer key.',
    '- Use clean plain text formatting (no markdown bold/italics/asterisks).',
    `- The VERY LAST LINE must be exactly: ${REFERRED_FOOTER}`,
    scienceExtras,
    sampleBlock,
    o.customInstructions ? `\nCustom instructions: ${o.customInstructions}` : '',
  ].filter(Boolean).join('\n');
}

function buildCheckPrompt(paper: string): string {
  return [
    'You are an expert Maharashtra State Board Class 10 paper reviewer (using 2015 board paper as reference).',
    'Review the following question paper and produce a structured report covering:',
    '1. Marks distribution (is it balanced & correct?)',
    '2. Difficulty balance (Easy/Medium/Hard mix)',
    '3. Duplicate or repetitive questions',
    '4. Chapter coverage (which chapters are covered/missing)',
    '5. Board pattern accuracy vs 2015 SSC pattern',
    '6. Inclusion of textbook activities / Do You Know / Introduction items (for Science)',
    '7. Overall score out of 10 with key recommendations',
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
  return enforceWrapping(out);
}

/** Guarantees ASKIFY header, tagline, and 2015-reference footer even if the model forgets. */
function enforceWrapping(text: string): string {
  const lines = text.trim().split('\n');
  if (!lines[0]?.trim().toUpperCase().startsWith('ASKIFY')) {
    lines.unshift(ASKIFY_HEADER);
  }
  if (!lines[1] || !lines[1].toLowerCase().includes('welcome to the world of possibilities')) {
    lines.splice(1, 0, ASKIFY_TAGLINE);
  }
  let out = lines.join('\n');
  if (!out.toLowerCase().includes('referred from')) {
    out = `${out}\n\n${REFERRED_FOOTER}`;
  }
  return out;
}

export async function generatePaper(opts: GenerateOptions): Promise<string> {
  // Auto-attach owner sample papers for the subject if none explicitly passed.
  const samples = opts.samplePapers ?? getSamplesForSubject(opts.subject);
  const merged: GenerateOptions = { ...opts, samplePapers: samples };
  try {
    return await callAI(buildGeneratePrompt(merged));
  } catch (err) {
    console.error('[groq] generate failed, using local fallback:', err);
    return enforceWrapping(localFallbackPaper(merged));
  }
}

export async function checkPaper(paper: string): Promise<string> {
  return callAI(buildCheckPrompt(paper));
}

function localFallbackPaper(o: GenerateOptions): string {
  const date = new Date().toLocaleDateString();
  return `${ASKIFY_HEADER}
${ASKIFY_TAGLINE}
MAHARASHTRA STATE BOARD - CLASS 10
Subject: ${o.subject}        Total Marks: ${o.marks}
Date: ${date}                Difficulty: ${o.difficulty}

General Instructions:
1. All questions are compulsory.
2. Figures to the right indicate full marks.
3. Draw neat diagrams wherever necessary.

(Offline fallback template — please reconnect to generate a full AI paper.)

Section A — Objective (MCQs / Fill in the blanks)
Q1. Attempt any 5: (5 marks)

Section B — Short Answer (2 marks each)
Q2. Attempt any 4: (8 marks)

Section C — Long Answer (3 marks each)
Q3. Attempt any 3: (9 marks)

Section D — Application / HOTS (4 marks each)
Q4. Attempt any 2: (8 marks)

Chapters covered: ${o.chapters.join(', ') || 'All chapters'}
${o.customInstructions ? `\nCustom: ${o.customInstructions}` : ''}

${REFERRED_FOOTER}`;
}
