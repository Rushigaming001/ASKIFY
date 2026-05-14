import { useEffect, useMemo, useState } from 'react';
// framer-motion not installed in this project — use plain divs
const motion = { div: (props: any) => <div {...props} /> } as any;
const AnimatePresence = ({ children }: { children: React.ReactNode; mode?: string }) => <>{children}</>;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  Lock, Search, Eye, Download, Copy, Sparkles, Trash2, Upload,
  Brain, History, Settings as SettingsIcon, Star, Loader2, Wand2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { OWNER_EMAIL } from '@/lib/groq';
import {
  SSC_SUBJECTS, SSC_YEARS, sscAccess, listPapers, upsertPaper, deletePaper,
  recordView, listHistory, analyzeSubject, predictPaper, cacheAnalysis, loadCachedAnalysis,
  type BoardPaper, type SscSubject, type AnalysisResult,
} from '@/lib/sscIntel';

export default function BoardIntelligence() {
  const { user } = useAuth();
  const isOwner = user?.email === OWNER_EMAIL;
  const [unlocked, setUnlocked] = useState(sscAccess.isUnlocked() || isOwner);
  const [showUnlock, setShowUnlock] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  const [papers, setPapers] = useState<BoardPaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => { setPapers(await listPapers()); setLoading(false); })(); }, []);

  async function tryUnlock() {
    setVerifying(true);
    const ok = await sscAccess.verify(code.trim());
    setVerifying(false);
    if (ok) {
      sscAccess.setUnlocked(true);
      setUnlocked(true); setShowUnlock(false);
      toast({ title: 'Access granted', description: 'Welcome to Board Intelligence.' });
    } else {
      toast({ title: 'Invalid pass', description: 'Ask the owner for a valid access pass.', variant: 'destructive' });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center shadow-lg">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">SSC Board Paper Intelligence</h1>
              <p className="text-[11px] text-muted-foreground">Maharashtra Board · 2015 → 2026 · AI-powered</p>
            </div>
          </div>
          {!unlocked && (
            <Button size="sm" onClick={() => setShowUnlock(true)}>
              <Lock className="h-4 w-4 mr-1" /> Unlock
            </Button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 relative">
        {!unlocked && <AccessGate onUnlock={() => setShowUnlock(true)} />}

        <div className={unlocked ? '' : 'pointer-events-none blur-md select-none'}>
          <Tabs defaultValue="papers" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto bg-muted/40 backdrop-blur">
              <TabsTrigger value="papers" className="text-xs sm:text-sm">📚 Board Papers</TabsTrigger>
              <TabsTrigger value="repeated" className="text-xs sm:text-sm">🔁 Most Repeated</TabsTrigger>
              <TabsTrigger value="predict" className="text-xs sm:text-sm">🔮 2027 Predictor</TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm">🕘 History</TabsTrigger>
              {isOwner && <TabsTrigger value="owner" className="text-xs sm:text-sm">⚙️ Owner</TabsTrigger>}
            </TabsList>

            <TabsContent value="papers"><BoardPapersGrid loading={loading} papers={papers} reload={async () => setPapers(await listPapers())} /></TabsContent>
            <TabsContent value="repeated"><RepeatedQuestionsPanel papers={papers} /></TabsContent>
            <TabsContent value="predict"><PredictorPanel papers={papers} /></TabsContent>
            <TabsContent value="history"><HistoryPanel /></TabsContent>
            {isOwner && <TabsContent value="owner"><OwnerSettings papers={papers} reload={async () => setPapers(await listPapers())} /></TabsContent>}
          </Tabs>
        </div>
      </div>

      <Dialog open={showUnlock} onOpenChange={setShowUnlock}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Access Pass Required</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the access pass shared by your owner / admin to unlock SSC Board Intelligence.</p>
            <Input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access pass" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUnlock(false)}>Cancel</Button>
            <Button onClick={tryUnlock} disabled={verifying || !code.trim()}>
              {verifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="absolute inset-x-4 top-10 z-10 mx-auto max-w-md"
    >
      <Card className="border-primary/30 bg-background/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle>Premium Feature Locked</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Real Maharashtra SSC papers (2015–2026), AI trend analysis, repeated questions, and 2027 predictions — unlock with your access pass.</p>
          <Button className="w-full" onClick={onUnlock}><Lock className="h-4 w-4 mr-1" /> Enter Access Pass</Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------- Board Papers Grid ----------
function BoardPapersGrid({ loading, papers, reload }: { loading: boolean; papers: BoardPaper[]; reload: () => Promise<void> }) {
  const [subject, setSubject] = useState<SscSubject | 'All'>('All');
  const [year, setYear] = useState<number | 'All'>('All');
  const [q, setQ] = useState('');
  const [viewing, setViewing] = useState<BoardPaper | null>(null);
  const { toast } = useToast();

  const filtered = useMemo(() => papers.filter((p) =>
    (subject === 'All' || p.subject === subject) &&
    (year === 'All' || p.year === year) &&
    (q.trim() === '' || p.title.toLowerCase().includes(q.toLowerCase()))
  ), [papers, subject, year, q]);

  async function openPaper(p: BoardPaper) {
    setViewing(p);
    await recordView(p.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Search papers..." />
        </div>
        <Select value={subject} onValueChange={(v) => setSubject(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All subjects</SelectItem>
            {SSC_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(v === 'All' ? 'All' : Number(v))}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All years</SelectItem>
            {SSC_YEARS.slice().reverse().map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading papers…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="group h-full bg-background/60 backdrop-blur border-border/60 hover:border-primary/40 transition shadow-sm hover:shadow-lg">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="outline" className="mb-1">{p.year}</Badge>
                      <CardTitle className="text-sm leading-tight">{p.subject}</CardTitle>
                    </div>
                    {p.is_featured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.title}</p>
                  {!p.content && <Badge variant="secondary" className="text-[10px]">Awaiting upload</Badge>}
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => openPaper(p)} className="h-7 text-[11px]"><Eye className="h-3 w-3 mr-1" /> View</Button>
                    {p.pdf_url && (
                      <Button size="sm" variant="outline" asChild className="h-7 text-[11px]">
                        <a href={p.pdf_url} target="_blank" rel="noreferrer"><Download className="h-3 w-3 mr-1" /> PDF</a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={!p.content}
                      onClick={() => { navigator.clipboard.writeText(p.content); toast({ title: 'Copied' }); }}
                      className="h-7 text-[11px]"><Copy className="h-3 w-3 mr-1" /> Copy</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-8">No papers match your filters.</p>}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader><DialogTitle>{viewing?.year} — {viewing?.subject}</DialogTitle></DialogHeader>
          <ScrollArea className="h-[60vh] pr-3">
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{viewing?.content || '(No paper content yet — owner needs to upload it from Owner Settings.)'}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Repeated Questions ----------
function RepeatedQuestionsPanel({ papers }: { papers: BoardPaper[] }) {
  const [subject, setSubject] = useState<SscSubject>('Mathematics 1');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => { (async () => setAnalysis(await loadCachedAnalysis(subject)))(); }, [subject]);

  async function run() {
    setBusy(true);
    try {
      const res = await analyzeSubject(subject, papers);
      setAnalysis(res);
      const ids = papers.filter((p) => p.subject === subject && p.content).map((p) => p.id);
      if (ids.length) await cacheAnalysis(subject, ids, res);
      toast({ title: 'Analysis complete', description: `${res.repeatedQuestions.length} repeated patterns found.` });
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  const grouped = useMemo(() => {
    if (!analysis) return {} as Record<string, AnalysisResult['repeatedQuestions']>;
    const g: Record<string, AnalysisResult['repeatedQuestions']> = {};
    for (const q of analysis.repeatedQuestions) (g[q.chapter || 'General'] = g[q.chapter || 'General'] || []).push(q);
    return g;
  }, [analysis]);

  return (
    <div className="space-y-4">
      <Card className="bg-background/60 backdrop-blur border-border/60">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Select value={subject} onValueChange={(v) => setSubject(v as SscSubject)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{SSC_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={run} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Analyze with AI
          </Button>
          {analysis?.coverage && (
            <span className="text-xs text-muted-foreground">
              {analysis.coverage.withContent}/{analysis.coverage.totalProvided} papers analyzed
              {analysis.coverage.yearsMissing.length > 0 && ` · missing: ${analysis.coverage.yearsMissing.join(', ')}`}
            </span>
          )}
        </CardContent>
      </Card>

      {analysis?.note && <p className="text-sm text-amber-600 dark:text-amber-400">⚠ {analysis.note}</p>}

      {analysis && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Card className="bg-background/60 backdrop-blur">
            <CardHeader className="pb-2"><CardTitle className="text-sm">📈 Board Trends</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              {analysis.trends.length === 0 ? <p className="text-muted-foreground">No trends yet.</p>
                : analysis.trends.map((t, i) => <p key={i}>• {t}</p>)}
            </CardContent>
          </Card>
          <Card className="bg-background/60 backdrop-blur">
            <CardHeader className="pb-2"><CardTitle className="text-sm">⚖️ Chapter Weightage</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              {Object.keys(analysis.chapterWeightage).length === 0
                ? <p className="text-muted-foreground">No data.</p>
                : Object.entries(analysis.chapterWeightage).sort((a, b) => Number(b[1]) - Number(a[1])).map(([c, m]) => (
                  <div key={c} className="flex justify-between"><span>{c}</span><span className="font-mono">{Number(m).toFixed(1)}m</span></div>
                ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(grouped).map(([chapter, qs]) => (
          <Card key={chapter} className="bg-background/60 backdrop-blur border-border/60">
            <CardHeader className="pb-2"><CardTitle className="text-sm">{chapter}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {qs.sort((a, b) => b.frequency - a.frequency).map((q, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-3 bg-background/40">
                  <p className="text-sm">{q.question}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="default" className="text-[10px]">Asked {q.frequency}×</Badge>
                    {q.tag && <Badge variant="secondary" className="text-[10px]">{q.tag}</Badge>}
                    <Badge variant="outline" className="text-[10px]">Confidence {(q.confidence * 100).toFixed(0)}%</Badge>
                    {q.yearsAsked && q.yearsAsked.length > 0 && <Badge variant="outline" className="text-[10px]">Years: {q.yearsAsked.join(', ')}</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Predictor ----------
function PredictorPanel({ papers }: { papers: BoardPaper[] }) {
  const [subject, setSubject] = useState<SscSubject>('Mathematics 1');
  const [targetYear, setTargetYear] = useState(2027);
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState<string>('');
  const { toast } = useToast();

  async function predict() {
    setBusy(true);
    try {
      const cached = await loadCachedAnalysis(subject);
      const res = await predictPaper(subject, targetYear, cached, papers);
      setPaper(res.paper);
    } catch (e: any) {
      toast({ title: 'Prediction failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  function download() {
    const blob = new Blob([paper], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `SSC-${targetYear}-${subject}-Predicted.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary/10 via-background/60 to-background/60 backdrop-blur border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="h-4 w-4" /> 2027 Prediction Mode</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={subject} onValueChange={(v) => setSubject(v as SscSubject)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{SSC_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} className="w-[110px]" />
          <Button onClick={predict} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Predict Paper
          </Button>
          {paper && <Button variant="outline" onClick={download}><Download className="h-4 w-4 mr-1" /> Download</Button>}
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {paper && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="bg-background/60 backdrop-blur">
              <CardContent className="p-4">
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-[60vh] overflow-auto">{paper}</pre>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- History ----------
function HistoryPanel() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof listHistory>>>([]);
  useEffect(() => { (async () => setItems(await listHistory()))(); }, []);
  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No history yet — open any paper to track it here.</p>}
      {items.map((it) => (
        <Card key={it.id} className="bg-background/60 backdrop-blur">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{it.ssc_board_papers?.year} — {it.ssc_board_papers?.subject}</p>
              <p className="text-[11px] text-muted-foreground">Viewed {new Date(it.viewed_at).toLocaleString()}</p>
            </div>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Owner Settings ----------
function OwnerSettings({ papers, reload }: { papers: BoardPaper[]; reload: () => Promise<void> }) {
  const { toast } = useToast();
  const [pass, setPass] = useState('');
  const [year, setYear] = useState<number>(2026);
  const [subject, setSubject] = useState<SscSubject>('Mathematics 1');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [featured, setFeatured] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [savingPaper, setSavingPaper] = useState(false);

  async function savePass() {
    if (pass.trim().length < 4) { toast({ title: 'Pass must be ≥4 chars', variant: 'destructive' }); return; }
    setSavingPass(true);
    const ok = await sscAccess.setPass(pass.trim());
    setSavingPass(false);
    if (ok) { setPass(''); toast({ title: 'Access pass updated' }); }
    else toast({ title: 'Failed to set pass', variant: 'destructive' });
  }

  async function savePaper() {
    if (!title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    setSavingPaper(true);
    const out = await upsertPaper({ year, subject, title: title.trim(), content, pdf_url: pdfUrl || null, is_featured: featured });
    setSavingPaper(false);
    if (out) { toast({ title: 'Paper saved' }); setTitle(''); setContent(''); setPdfUrl(''); setFeatured(false); await reload(); }
    else toast({ title: 'Save failed', variant: 'destructive' });
  }

  async function remove(id: string) {
    await deletePaper(id); await reload();
    toast({ title: 'Deleted' });
  }

  async function toggleFeatured(p: BoardPaper) {
    await upsertPaper({ ...p, is_featured: !p.is_featured });
    await reload();
  }

  return (
    <div className="space-y-4">
      <Card className="bg-background/60 backdrop-blur">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><SettingsIcon className="h-4 w-4" /> Access Pass</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="New access pass (min 4 chars)" />
          <Button onClick={savePass} disabled={savingPass}>{savingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set Pass'}</Button>
        </CardContent>
      </Card>

      <Card className="bg-background/60 backdrop-blur">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Upload / Replace Paper</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SSC_YEARS.slice().reverse().map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={subject} onValueChange={(v) => setSubject(v as SscSubject)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SSC_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. SSC Board March 2023 - Maths 1)" />
          <Input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} placeholder="Optional PDF URL" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste full paper text (questions, marks, sections)..." rows={8} className="font-mono text-xs" />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} /> Mark as featured</label>
          <Button onClick={savePaper} disabled={savingPaper} className="w-full">
            {savingPaper ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Save Paper
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-background/60 backdrop-blur">
        <CardHeader><CardTitle className="text-sm">Manage Papers ({papers.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[40vh]">
            <div className="space-y-1">
              {papers.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs border border-border/40 rounded-md p-2">
                  <div className="flex-1 truncate">
                    <span className="font-mono">{p.year}</span> · {p.subject}
                    {!p.content && <Badge variant="secondary" className="ml-2 text-[10px]">empty</Badge>}
                    {p.is_featured && <Star className="inline h-3 w-3 ml-1 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleFeatured(p)} title="Toggle featured">
                      <Star className={`h-3.5 w-3.5 ${p.is_featured ? 'text-yellow-500 fill-yellow-500' : ''}`} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(p.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
