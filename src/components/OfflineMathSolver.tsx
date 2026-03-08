import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calculator, GraduationCap, BookOpen, Download, Brain, 
  Loader2, WifiOff, Wifi, Trash2 
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const MAHARASHTRA_BOARD_CHAPTERS: Record<string, string[]> = {
  algebra: [
    "Sets", "Real Numbers", "Polynomials",
    "Linear Equations in Two Variables", "Ratio and Proportion", "Financial Planning"
  ],
  geometry: [
    "Lines and Angles", "Triangles", "Quadrilaterals",
    "Circle", "Co-ordinate Geometry", "Trigonometry", "Surface Area and Volume"
  ],
  statistics: ["Statistics", "Probability"]
};

type EngineStatus = 'idle' | 'downloading' | 'ready' | 'error';

const MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

export function OfflineMathSolver() {
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState<string | null>(null);
  const [subject, setSubject] = useState('auto');
  const [chapter, setChapter] = useState('auto');
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLabel, setDownloadLabel] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<any>(null);

  const getChapters = () => {
    if (subject === 'auto' || !subject) return [];
    return MAHARASHTRA_BOARD_CHAPTERS[subject] || [];
  };

  const initEngine = useCallback(async () => {
    if (engineStatus === 'downloading' || engineStatus === 'ready') return;

    try {
      setEngineStatus('downloading');
      setDownloadProgress(0);
      setDownloadLabel('Loading AI model...');

      const cdnUrl = 'https://esm.sh/@mlc-ai/web-llm@0.2.81';
      const webllm: any = await import(/* @vite-ignore */ cdnUrl);

      const engine = await webllm.CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (info: any) => {
          setDownloadLabel(info.text || 'Loading...');
          if (info.progress !== undefined) {
            setDownloadProgress(Math.round(info.progress * 100));
          }
        },
      });

      engineRef.current = engine;
      setEngineStatus('ready');
      toast({ title: '✅ AI Ready', description: 'Offline Math Solver is loaded!' });
    } catch (err: any) {
      console.error('WebLLM init error:', err);
      setEngineStatus('error');
      toast({
        title: err.message?.includes('WebGPU') ? 'WebGPU Not Supported' : 'Failed to load AI',
        description: err.message?.includes('WebGPU')
          ? "Your browser doesn't support WebGPU. Try Chrome 113+ on desktop."
          : (err.message || 'Unknown error'),
        variant: 'destructive',
      });
    }
  }, [engineStatus]);

  const handleSolve = async () => {
    if (!problem.trim() || isGenerating || engineStatus !== 'ready') return;

    setIsGenerating(true);
    setSolution(null);

    try {
      const engine = engineRef.current;
      const chapterContext = (subject !== 'auto' || chapter !== 'auto')
        ? `This is from Maharashtra Board Class 9th${subject !== 'auto' ? `, ${subject.charAt(0).toUpperCase() + subject.slice(1)}` : ''}${chapter !== 'auto' ? `, Chapter: ${chapter}` : ''}.`
        : '';

      const systemPrompt = `You are an expert math teacher. Solve math problems step by step. ${chapterContext}

Rules:
- Show each step clearly numbered (Step 1, Step 2, etc.)
- Write the final answer clearly
- Use plain text, no markdown symbols
- Be concise but thorough`;

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `Solve this math problem step by step:\n\n${problem.trim()}` }
      ];

      let result = '';

      const chunks = await engine.chat.completions.create({
        messages,
        stream: true,
        max_tokens: 512,
        temperature: 0.3,
      });

      for await (const chunk of chunks) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        result += delta;
        // Clean markdown artifacts in real-time
        const clean = result.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '');
        setSolution(clean);
      }

      if (!result.trim()) {
        setSolution('Could not generate a solution. Please try rephrasing the problem.');
      }
    } catch (err: any) {
      console.error('Solve error:', err);
      setSolution('⚠️ Error generating solution. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-2 text-sm">
        {engineStatus === 'ready' ? (
          <span className="flex items-center gap-1.5 text-green-600">
            <WifiOff className="h-3.5 w-3.5" />
            Offline — runs on your device
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Wifi className="h-3.5 w-3.5" />
            Requires one-time download (~200MB)
          </span>
        )}
      </div>

      {/* Download / Init */}
      {engineStatus === 'idle' && (
        <div className="flex flex-col items-center py-8 text-center">
          <Brain className="h-12 w-12 text-primary mb-3" />
          <h3 className="font-bold mb-1">Offline Math Solver</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            Solve math problems without internet. Uses SmolLM2 running locally via WebGPU.
          </p>
          <Button onClick={initEngine} className="gap-2">
            <Download className="h-4 w-4" />
            Download & Start
          </Button>
        </div>
      )}

      {engineStatus === 'downloading' && (
        <div className="flex flex-col items-center py-8 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium mb-1">Loading AI Model...</p>
          <p className="text-xs text-muted-foreground mb-3 max-w-xs">{downloadLabel}</p>
          <Progress value={downloadProgress} className="w-56 h-2" />
          <p className="text-xs text-muted-foreground mt-1">{downloadProgress}%</p>
        </div>
      )}

      {engineStatus === 'error' && (
        <div className="flex flex-col items-center py-8 text-center">
          <WifiOff className="h-10 w-10 text-destructive mb-3" />
          <p className="text-sm font-medium mb-1">Failed to Load</p>
          <p className="text-xs text-muted-foreground mb-4">
            Your browser may not support WebGPU. Try Chrome 113+.
          </p>
          <Button onClick={() => setEngineStatus('idle')} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      )}

      {/* Solver UI - only when ready */}
      {engineStatus === 'ready' && (
        <>
          {/* Subject & Chapter */}
          <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GraduationCap className="h-4 w-4 text-primary" />
              Maharashtra Board - Class 9th
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <Select value={subject} onValueChange={(v) => { setSubject(v); setChapter('auto'); }}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto Detect</SelectItem>
                    <SelectItem value="algebra">Algebra</SelectItem>
                    <SelectItem value="geometry">Geometry</SelectItem>
                    <SelectItem value="statistics">Statistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Chapter</Label>
                <Select value={chapter} onValueChange={setChapter} disabled={subject === 'auto'}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Chapter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto Detect</SelectItem>
                    {getChapters().map((ch) => (
                      <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Problem input */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type your math problem</Label>
            <Textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. Solve: 2x + 5 = 15"
              className="min-h-[80px] resize-none"
              disabled={isGenerating}
            />
          </div>

          {/* Solve button */}
          <Button
            onClick={handleSolve}
            disabled={!problem.trim() || isGenerating}
            className="w-full h-11 gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Solving...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4" />
                Solve Offline
              </>
            )}
          </Button>

          {/* Solution */}
          {solution && (
            <div className="p-4 rounded-xl bg-card border border-border space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <BookOpen className="h-4 w-4" />
                  Solution
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSolution(null)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ScrollArea className="max-h-[300px]">
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {solution}
                </div>
              </ScrollArea>
            </div>
          )}
        </>
      )}
    </div>
  );
}
