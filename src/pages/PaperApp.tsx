import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import {
  FileText, Sparkles, Loader2, Copy, Download, Printer, RefreshCw,
  History, ClipboardCheck, Trash2, LogOut, Moon, Sun, Smartphone, Check,
  BookMarked, Plus, Zap, Brain,
} from 'lucide-react';
import {
  generatePaper, checkPaper,
  loadSamplePapers, saveSamplePapers, OWNER_EMAIL,
  type GenerateOptions, type GenerationMode, type SamplePapersMap, type SampleImageRef,
} from '@/lib/groq';
import { getDeferredPrompt, clearDeferredPrompt } from '@/registerSW';

// -------- Curriculum (Class 10 — Maharashtra State Board) --------
const CURRICULUM: Record<string, string[]> = {
  'English': [
    '1.1 Where the Mind is Without Fear', "1.2 The Thief's Story",
    '1.3 On Wings of Courage', "1.4 All the World's a Stage",
    '1.5 Joan of Arc', '1.6 The Alchemy of Nature',
    '2.1 Animals', '2.2 Three Questions', '2.3 Connecting the Dots',
    '2.4 The Pulley', "2.5 Let's March", '2.6 Science and Spirituality',
    '3.1 Night of the Scorpion', '3.2 The Night I Met Einstein',
    '3.3 Stephen Hawking', '3.4 The Will to Win',
    '3.5 Unbeatable Super Mom – Mary Kom', '3.6 The Concert',
    '4.1 A Thing of Beauty', '4.2 The Luncheon', '4.3 World Heritage',
    '4.4 The Height of the Ridiculous', '4.5 The Old Man and the Sea',
    '4.6 The Gift of the Magi',
    'Grammar', 'Writing Skills',
  ],
  'Mathematics 1': [
    '1. Linear Equations in Two Variables', '2. Quadratic Equations',
    '3. Arithmetic Progression', '4. Financial Planning',
    '5. Probability', '6. Statistics',
  ],
  'Mathematics 2': [
    '1. Similarity', '2. Pythagoras Theorem', '3. Circle',
    '4. Geometric Constructions', '5. Co-ordinate Geometry',
    '6. Trigonometry', '7. Mensuration',
  ],
  'Science 1': [
    '1. Gravitation', '2. Periodic Classification of Elements',
    '3. Chemical Reactions and Equations', '4. Effects of Electric Current',
    '5. Heat', '6. Refraction of Light', '7. Lenses',
    '8. Metallurgy', '9. Carbon Compounds', '10. Space Missions',
  ],
  'Science 2': [
    '1. Heredity and Evolution', '2. Life Processes in Living Organisms Part 1',
    '3. Life Processes in Living Organisms Part 2', '4. Environmental Management',
    '5. Towards Green Energy', '6. Animal Classification',
    '7. Introduction to Microbiology', '8. Cell Biology and Biotechnology',
    '9. Social Health', '10. Disaster Management',
  ],
};

const SUBJECTS = Object.keys(CURRICULUM);
const MARKS = ['20', '40', '80', '100'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Very Difficult'];

// -------- Storage helpers --------
const AUTH_KEY = 'paperapp.auth.v1';
const HISTORY_KEY = 'paperapp.history.v1';
const THEME_KEY = 'paperapp.theme.v1';

interface AuthRecord { email: string; password: string; loggedIn: boolean }
interface HistoryItem {
  id: string; title: string; subject: string; marks: string; difficulty: string;
  createdAt: number; paper: string;
}

const loadJSON = <T,>(k: string, fb: T): T => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fb; } catch { return fb; }
};
const saveJSON = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* quota */ } };

// =====================================================================
//  Root
// =====================================================================
export default function PaperApp() {
  const [auth, setAuth] = useState<AuthRecord | null>(() => loadJSON<AuthRecord | null>(AUTH_KEY, null));
  const [dark, setDark] = useState<boolean>(() => loadJSON<boolean>(THEME_KEY, true));

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    saveJSON(THEME_KEY, dark);
  }, [dark]);

  const handleLogin = (email: string, password: string) => {
    const record: AuthRecord = { email, password, loggedIn: true };
    saveJSON(AUTH_KEY, record);
    setAuth(record);
  };
  const handleLogout = () => {
    const next = auth ? { ...auth, loggedIn: false } : null;
    if (next) saveJSON(AUTH_KEY, next);
    setAuth(next);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      {auth?.loggedIn
        ? <PaperHome email={auth.email} onLogout={handleLogout} dark={dark} setDark={setDark} />
        : <LoginScreen onLogin={handleLogin} existing={auth} dark={dark} setDark={setDark} />}
    </div>
  );
}

// =====================================================================
//  Login Screen
// =====================================================================
function LoginScreen({
  onLogin, existing, dark, setDark,
}: { onLogin: (e: string, p: string) => void; existing: AuthRecord | null; dark: boolean; setDark: (v: boolean) => void }) {
  const [email, setEmail] = useState(existing?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@') || password.length < 4) {
      setError('Enter a valid email and a password (4+ chars).');
      return;
    }
    if (existing && existing.email === email && existing.password !== password) {
      setError('Incorrect password for this account.');
      return;
    }
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/10">
      <button
        onClick={() => setDark(!dark)}
        className="absolute top-4 right-4 p-2 rounded-full bg-card border border-border hover:bg-accent transition"
        aria-label="Toggle theme"
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <FileText className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Askify Paper Generator</CardTitle>
          <p className="text-sm text-muted-foreground">Maharashtra State Board · Class 10</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" size="lg">
              {existing ? 'Sign in' : 'Create account & continue'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Your credentials are stored locally on this device only.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================================
//  Main App (post-login)
// =====================================================================
function PaperHome({
  email, onLogout, dark, setDark,
}: { email: string; onLogout: () => void; dark: boolean; setDark: (v: boolean) => void }) {
  const [tab, setTab] = useState('generate');
  const [history, setHistory] = useState<HistoryItem[]>(() => loadJSON<HistoryItem[]>(HISTORY_KEY, []));
  const persistHistory = (next: HistoryItem[]) => { setHistory(next); saveJSON(HISTORY_KEY, next.slice(0, 50)); };

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Paper Generator</div>
            <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">{email}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => { window.location.href = '/board-intelligence'; }} className="text-[11px] h-8">
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Board Intel
          </Button>
          <InstallButton />
          <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onLogout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
        <TabsList className={`grid ${email === OWNER_EMAIL ? 'grid-cols-4' : 'grid-cols-3'} mx-4 mt-3`}>
          <TabsTrigger value="generate"><Sparkles className="h-4 w-4 mr-1" />Generate</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />History</TabsTrigger>
          <TabsTrigger value="check"><ClipboardCheck className="h-4 w-4 mr-1" />Check</TabsTrigger>
          {email === OWNER_EMAIL && (
            <TabsTrigger value="samples"><BookMarked className="h-4 w-4 mr-1" />Samples</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="generate" className="flex-1 p-4">
          <GenerateTab
            onSaved={(item) => persistHistory([item, ...history])}
          />
        </TabsContent>
        <TabsContent value="history" className="flex-1 p-4">
          <HistoryTab history={history} setHistory={persistHistory} />
        </TabsContent>
        <TabsContent value="check" className="flex-1 p-4">
          <CheckTab />
        </TabsContent>
        {email === OWNER_EMAIL && (
          <TabsContent value="samples" className="flex-1 p-4">
            <SamplesTab />
          </TabsContent>
        )}
      </Tabs>

      <footer className="text-center text-[11px] text-muted-foreground py-3">
        Askify Paper Generator · Offline-ready PWA
      </footer>
    </div>
  );
}

// =====================================================================
//  Install Button
// =====================================================================
function InstallButton() {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as unknown as { standalone?: boolean }).standalone) {
      setInstalled(true);
      return;
    }
    if (getDeferredPrompt()) setCanInstall(true);
    const onAvail = () => setCanInstall(true);
    const onInstalled = () => { setInstalled(true); setCanInstall(false); };
    window.addEventListener('pwa-install-available', onAvail);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('pwa-install-available', onAvail);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary">
        <Check className="h-3 w-3" />Installed
      </span>
    );
  }
  if (!canInstall) return null;
  return (
    <Button
      size="sm"
      variant="default"
      onClick={async () => {
        const p = getDeferredPrompt();
        if (!p) return;
        try {
          await p.prompt();
          const { outcome } = await p.userChoice;
          if (outcome === 'accepted') { clearDeferredPrompt(); setInstalled(true); setCanInstall(false); }
        } catch (e) { console.error(e); }
      }}
      className="h-8 gap-1"
    >
      <Smartphone className="h-3.5 w-3.5" />Install
    </Button>
  );
}

// =====================================================================
//  Generate Tab
// =====================================================================
function GenerateTab({ onSaved }: { onSaved: (item: HistoryItem) => void }) {
  const { toast } = useToast();
  const [subject, setSubject] = useState<string>('English');
  const [marks, setMarks] = useState<string>('40');
  const [difficulty, setDifficulty] = useState<string>('Medium');
  const [chapters, setChapters] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState<GenerationMode | null>(null);
  const [paper, setPaper] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ providersUsed?: string[]; draftCount?: number; review?: string | null; mode?: GenerationMode } | null>(null);

  const allChapters = useMemo(() => CURRICULUM[subject] ?? [], [subject]);

  const toggleChapter = (c: string) =>
    setChapters((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);

  const run = async (mode: GenerationMode) => {
    if (!subject) return;
    setLoading(mode);
    const startedAt = Date.now();
    try {
      const opts: GenerateOptions = {
        subject, marks, difficulty,
        chapters: chapters.length ? chapters : allChapters,
        customInstructions: custom || undefined,
        title: title || undefined,
        mode,
      };
      const result = await generatePaper(opts);
      setPaper(result.paper);
      setMeta({ providersUsed: result.providersUsed, draftCount: result.draftCount, review: result.review, mode: result.mode });
      onSaved({
        id: crypto.randomUUID(),
        title: title || `${subject} · ${marks} marks${mode !== 'standard' ? ` · ${mode}` : ''}`,
        subject, marks, difficulty,
        createdAt: Date.now(),
        paper: result.paper,
      });
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      toast({
        title: mode === 'quick' ? `Quick paper ready in ${seconds}s` : mode === 'thinking' ? `Masterpiece ready in ${seconds}s` : `Paper generated in ${seconds}s`,
        description: result.providersUsed?.length
          ? `${result.draftCount ?? result.providersUsed.length} AI(s): ${result.providersUsed.join(', ')}`
          : 'Saved to History.',
      });
    } catch (err) {
      toast({ title: 'Generation failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={(v) => { setSubject(v); setChapters([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Total Marks</Label>
              <Select value={marks} onValueChange={setMarks}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MARKS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Paper Title (optional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unit Test 1" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Chapters ({chapters.length || 'all'})</Label>
              <button type="button" className="text-xs text-primary" onClick={() => setChapters([])}>
                Use all
              </button>
            </div>
            <ScrollArea className="h-44 rounded-md border border-border p-2">
              <div className="space-y-1">
                {allChapters.map((c) => (
                  <label key={c} className="flex items-start gap-2 p-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                    <Checkbox checked={chapters.includes(c)} onCheckedChange={() => toggleChapter(c)} />
                    <span className="leading-tight">{c}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-1.5">
            <Label>Custom instructions (optional)</Label>
            <Textarea value={custom} onChange={(e) => setCustom(e.target.value)}
              placeholder="e.g. Add more MCQs, focus on chapter 3, etc."
              rows={3} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button onClick={() => run('quick')} disabled={!!loading} variant="outline" size="lg" className="border-amber-500/50 hover:bg-amber-500/10">
              {loading === 'quick' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2 text-amber-500" />}
              Quick (&lt;10s)
            </Button>
            <Button onClick={() => run('standard')} disabled={!!loading} size="lg">
              {loading === 'standard' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Multi-AI Generate
            </Button>
            <Button onClick={() => run('thinking')} disabled={!!loading} variant="outline" size="lg" className="border-violet-500/50 hover:bg-violet-500/10">
              {loading === 'thinking' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2 text-violet-500" />}
              Thinking (Masterpiece)
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Quick = 1 fast AI · Multi-AI = 3-4 AIs merged · Thinking = all AIs + master synthesis + auto-review
          </p>
        </CardContent>
      </Card>

      {paper && (
        <PaperView
          paper={paper}
          meta={meta}
          onRegenerate={() => run(meta?.mode ?? 'standard')}
          regenLoading={!!loading}
        />
      )}
    </div>
  );
}

// =====================================================================
//  Paper Result View
// =====================================================================
function PaperView({ paper, onRegenerate, regenLoading, meta }: {
  paper: string; onRegenerate?: () => void; regenLoading?: boolean;
  meta?: { providersUsed?: string[]; draftCount?: number; review?: string | null; mode?: GenerationMode } | null;
}) {
  const { toast } = useToast();

  const copy = async () => {
    try { await navigator.clipboard.writeText(paper); toast({ title: 'Copied to clipboard' }); }
    catch { toast({ title: 'Copy failed', variant: 'destructive' }); }
  };
  const downloadTxt = () => {
    const blob = new Blob([paper], { type: 'text/plain' });
    triggerDownload(blob, `paper-${Date.now()}.txt`);
  };
  const downloadPdf = () => {
    // Use a print-window with sanitized content -> "Save as PDF" in print dialog
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Paper</title>
      <style>
        body { font-family: ui-monospace, monospace; white-space: pre-wrap; padding: 24px; line-height: 1.5; }
        @media print { @page { margin: 16mm; } }
      </style></head><body>${escapeHtml(paper)}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };
  const print = () => downloadPdf();

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Generated Paper</CardTitle>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1" />Copy</Button>
          <Button variant="outline" size="sm" onClick={downloadTxt}><Download className="h-3.5 w-3.5 mr-1" />TXT</Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={print}><Printer className="h-3.5 w-3.5 mr-1" />Print</Button>
          {onRegenerate && (
            <Button variant="outline" size="sm" onClick={onRegenerate} disabled={regenLoading}>
              {regenLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
              Regenerate
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {meta?.providersUsed && meta.providersUsed.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {meta.mode === 'thinking' ? '🧠 Masterpiece' : meta.mode === 'quick' ? '⚡ Quick' : '✨ Multi-AI'}
            </span>
            <span className="text-muted-foreground">
              {meta.draftCount ?? meta.providersUsed.length} AI(s): {meta.providersUsed.join(' · ')}
            </span>
          </div>
        )}
        <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/40 p-3 rounded-md max-h-[60vh] overflow-auto">{paper}</pre>
        {meta?.review && (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ClipboardCheck className="h-3 w-3" /> Auto-Review
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono bg-violet-500/5 border border-violet-500/20 p-2 rounded-md">{meta.review}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

// =====================================================================
//  History Tab
// =====================================================================
function HistoryTab({ history, setHistory }: { history: HistoryItem[]; setHistory: (h: HistoryItem[]) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState<HistoryItem | null>(null);

  if (open) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>← Back to History</Button>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{open.title}</span> ·{' '}
          {new Date(open.createdAt).toLocaleString()}
        </div>
        <PaperView paper={open.paper} />
      </div>
    );
  }

  if (!history.length) {
    return <p className="text-sm text-muted-foreground text-center py-12">No saved papers yet. Generate one to see it here.</p>;
  }
  return (
    <div className="space-y-2">
      {history.map((h) => (
        <Card key={h.id} className="hover:bg-accent/50 transition cursor-pointer">
          <CardContent className="p-3 flex items-center gap-3">
            <button className="flex-1 text-left" onClick={() => setOpen(h)}>
              <div className="font-medium text-sm">{h.title}</div>
              <div className="text-xs text-muted-foreground">
                {h.subject} · {h.marks} marks · {h.difficulty} · {new Date(h.createdAt).toLocaleDateString()}
              </div>
            </button>
            <Button variant="ghost" size="icon"
              onClick={async () => { await navigator.clipboard.writeText(h.paper); toast({ title: 'Copied' }); }}
              aria-label="Copy">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon"
              onClick={() => setHistory(history.filter((x) => x.id !== h.id))}
              aria-label="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =====================================================================
//  Check Tab
// =====================================================================
function CheckTab() {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const run = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const out = await checkPaper(input);
      setReport(out);
    } catch (err) {
      toast({ title: 'Check failed', description: err instanceof Error ? err.message : 'Unknown', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const onFile = async (f: File) => {
    const text = await f.text();
    setInput(text);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>Paste a paper to review</Label>
          <Textarea rows={8} value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Paste the question paper here…" />
          <div className="flex items-center gap-2">
            <Input type="file" accept=".txt,.md,text/plain"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button onClick={run} disabled={loading || !input.trim()}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}
              Review
            </Button>
          </div>
        </CardContent>
      </Card>
      {report && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">AI Review Report</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/40 p-3 rounded-md max-h-[60vh] overflow-auto">{report}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================================
//  Samples Tab (owner only)
// =====================================================================
function SamplesTab() {
  const { toast } = useToast();
  const [map, setMap] = useState<SamplePapersMap>(() => loadSamplePapers());
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<SampleImageRef[]>([]);

  const persist = (next: SamplePapersMap) => { setMap(next); saveSamplePapers(next); };

  const add = () => {
    if (!title.trim() || (!content.trim() && images.length === 0)) {
      toast({ title: 'Title plus content or at least one image required', variant: 'destructive' });
      return;
    }
    const next: SamplePapersMap = {
      ...map,
      [subject]: [...(map[subject] ?? []), { title: title.trim(), content: content.trim(), images: images.length ? images : undefined }],
    };
    persist(next);
    setTitle(''); setContent(''); setImages([]);
    toast({ title: 'Sample paper saved', description: `Will be used as reference for ${subject}.` });
  };

  const remove = (subj: string, idx: number) => {
    const list = (map[subj] ?? []).filter((_, i) => i !== idx);
    const next = { ...map, [subj]: list };
    persist(next);
  };

  const onTextFile = async (f: File) => {
    const text = await f.text();
    setContent(text);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const onImageFiles = async (files: FileList) => {
    const arr = Array.from(files).slice(0, 8);
    const out: SampleImageRef[] = [];
    for (const f of arr) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > 4 * 1024 * 1024) {
        toast({ title: `Image too large: ${f.name}`, description: 'Max 4MB each.', variant: 'destructive' });
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      out.push({ dataUrl, caption: f.name });
    }
    setImages((prev) => [...prev, ...out]);
  };

  const updateCaption = (i: number, caption: string) => {
    setImages((prev) => prev.map((im, idx) => idx === i ? { ...im, caption } : im));
  };
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, idx) => idx !== i));

  const list = map[subject] ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookMarked className="h-4 w-4" /> Add Sample Paper
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Owner-only. Saved samples (text + image references) are auto-attached when generating papers for that subject.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sample Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Board Paper March 2015" />
          </div>
          <div className="space-y-1.5">
            <Label>Paper Content (optional if attaching images)</Label>
            <Textarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste the full sample paper text here…" />
            <Input type="file" accept=".txt,.md,text/plain" onChange={(e) => e.target.files?.[0] && onTextFile(e.target.files[0])} />
          </div>

          <div className="space-y-1.5">
            <Label>Reference Images ({images.length})</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => e.target.files && onImageFiles(e.target.files)}
            />
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                {images.map((im, i) => (
                  <div key={i} className="border border-border rounded-md p-2 space-y-1.5">
                    <img src={im.dataUrl} alt={im.caption ?? `ref ${i + 1}`} className="w-full h-24 object-cover rounded" />
                    <Input
                      value={im.caption ?? ''}
                      onChange={(e) => updateCaption(i, e.target.value)}
                      placeholder="Caption (e.g. Diagram for Q4)"
                      className="h-7 text-xs"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeImage(i)} className="w-full h-7 text-xs">
                      <Trash2 className="h-3 w-3 mr-1 text-destructive" />Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={add} className="w-full"><Plus className="h-4 w-4 mr-1" />Save Sample</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saved samples for {subject} ({list.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground">No samples yet for this subject.</p>
          )}
          {list.map((s, i) => (
            <div key={i} className="flex items-start justify-between gap-2 p-2 rounded-md border border-border">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-medium text-sm truncate">{s.title}</div>
                {s.content && (
                  <div className="text-xs text-muted-foreground truncate">{s.content.slice(0, 80)}…</div>
                )}
                {s.images && s.images.length > 0 && (
                  <div className="flex gap-1 flex-wrap pt-1">
                    {s.images.slice(0, 4).map((im, k) => (
                      <img key={k} src={im.dataUrl} alt={im.caption ?? ''} className="h-10 w-10 object-cover rounded border border-border" />
                    ))}
                    {s.images.length > 4 && (
                      <span className="text-[10px] text-muted-foreground self-end">+{s.images.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(subject, i)} aria-label="Delete">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
