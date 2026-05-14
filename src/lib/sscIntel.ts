import { supabase } from '@/integrations/supabase/client';

export type SscSubject = 'English' | 'Mathematics 1' | 'Mathematics 2' | 'Science 1' | 'Science 2';

export const SSC_SUBJECTS: SscSubject[] = [
  'English', 'Mathematics 1', 'Mathematics 2', 'Science 1', 'Science 2',
];

export const SSC_YEARS = Array.from({ length: 12 }, (_, i) => 2015 + i); // 2015..2026

export interface BoardPaper {
  id: string;
  year: number;
  subject: SscSubject;
  title: string;
  content: string;
  pdf_url: string | null;
  is_featured: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export interface AnalysisResult {
  subject: SscSubject;
  coverage?: { totalProvided: number; withContent: number; yearsAvailable: number[]; yearsMissing: number[] };
  repeatedQuestions: Array<{
    question: string; chapter: string; frequency: number;
    yearsAsked?: number[]; confidence: number; tag?: string;
  }>;
  chapterWeightage: Record<string, number>;
  trends: string[];
  importantConcepts: string[];
  note?: string;
}

export interface PredictResult { paper: string; targetYear: number; subject: SscSubject }

const ACCESS_KEY = 'ssc.access.v1';

export const sscAccess = {
  isUnlocked(): boolean {
    try { return localStorage.getItem(ACCESS_KEY) === 'unlocked'; } catch { return false; }
  },
  setUnlocked(v: boolean) {
    try {
      if (v) localStorage.setItem(ACCESS_KEY, 'unlocked');
      else localStorage.removeItem(ACCESS_KEY);
    } catch { /* ignore */ }
  },
  async verify(code: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('verify_ssc_access_pass', { _code: code });
    if (error) { console.error('verify_ssc_access_pass:', error); return false; }
    return !!data;
  },
  async setPass(code: string, label = 'Default'): Promise<boolean> {
    const { data, error } = await supabase.rpc('set_ssc_access_pass', { _code: code, _label: label });
    if (error) { console.error('set_ssc_access_pass:', error); return false; }
    return !!data;
  },
};

export async function listPapers(): Promise<BoardPaper[]> {
  const { data, error } = await supabase
    .from('ssc_board_papers')
    .select('*')
    .order('year', { ascending: false })
    .order('subject');
  if (error) { console.error(error); return []; }
  return (data || []) as BoardPaper[];
}

export async function upsertPaper(p: Partial<BoardPaper> & { year: number; subject: SscSubject; title: string }): Promise<BoardPaper | null> {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    year: p.year, subject: p.subject, title: p.title,
    content: p.content ?? '', pdf_url: p.pdf_url ?? null,
    is_featured: p.is_featured ?? false, uploaded_by: user?.id ?? null,
  };
  const { data, error } = await supabase
    .from('ssc_board_papers')
    .upsert(payload, { onConflict: 'year,subject' })
    .select().single();
  if (error) { console.error(error); return null; }
  return data as BoardPaper;
}

export async function deletePaper(id: string) {
  const { error } = await supabase.from('ssc_board_papers').delete().eq('id', id);
  if (error) console.error(error);
}

export async function recordView(paperId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('ssc_paper_views').insert({ user_id: user.id, paper_id: paperId });
}

export async function listHistory(): Promise<Array<{ id: string; paper_id: string; viewed_at: string; ssc_board_papers: BoardPaper | null }>> {
  const { data, error } = await supabase
    .from('ssc_paper_views')
    .select('id, paper_id, viewed_at, ssc_board_papers:paper_id(*)')
    .order('viewed_at', { ascending: false })
    .limit(50);
  if (error) { console.error(error); return []; }
  return (data || []) as any;
}

async function invokeIntel<T = any>(action: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ssc-intelligence', { body: { action, ...payload } });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error || 'AI request failed');
  return data as T;
}

export async function analyzeSubject(subject: SscSubject, papers: BoardPaper[]): Promise<AnalysisResult> {
  const slim = papers.filter((p) => p.subject === subject)
    .map((p) => ({ year: p.year, subject: p.subject, title: p.title, content: p.content || '' }));
  const res = await invokeIntel<AnalysisResult & { ok: true }>('analyze', { subject, papers: slim });
  return res;
}

export async function predictPaper(subject: SscSubject, targetYear: number, analysis: AnalysisResult | null, papers: BoardPaper[]): Promise<PredictResult> {
  const slim = papers.filter((p) => p.subject === subject && p.content)
    .map((p) => ({ year: p.year, subject: p.subject, title: p.title, content: p.content }));
  return await invokeIntel<PredictResult & { ok: true }>('predict', { subject, targetYear, analysis, papers: slim });
}

export async function cacheAnalysis(subject: SscSubject, paperIds: string[], a: AnalysisResult) {
  await supabase.from('ssc_paper_analyses').insert({
    subject, paper_ids: paperIds,
    repeated_questions: a.repeatedQuestions ?? [],
    chapter_weightage: a.chapterWeightage ?? {},
    trends: a.trends ?? [],
    important_concepts: a.importantConcepts ?? [],
  });
}

export async function loadCachedAnalysis(subject: SscSubject): Promise<AnalysisResult | null> {
  const { data } = await supabase
    .from('ssc_paper_analyses')
    .select('*')
    .eq('subject', subject)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    subject,
    repeatedQuestions: (data.repeated_questions as any) || [],
    chapterWeightage: (data.chapter_weightage as any) || {},
    trends: (data.trends as any) || [],
    importantConcepts: (data.important_concepts as any) || [],
  };
}
