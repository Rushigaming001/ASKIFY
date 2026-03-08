import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Send, Download, Wifi, WifiOff, Trash2, Brain, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type EngineStatus = 'idle' | 'downloading' | 'ready' | 'error';

const MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

const OfflineAI = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLabel, setDownloadLabel] = useState('');
  const engineRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initEngine = useCallback(async () => {
    if (engineStatus === 'downloading' || engineStatus === 'ready') return;

    try {
      setEngineStatus('downloading');
      setDownloadProgress(0);
      setDownloadLabel('Loading AI model...');

      const webllm = await import('@mlc-ai/web-llm');

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
      toast({ title: '✅ AI Ready', description: 'Offline AI is loaded and ready to chat!' });
    } catch (err: any) {
      console.error('WebLLM init error:', err);
      setEngineStatus('error');

      if (err.message?.includes('WebGPU')) {
        toast({
          title: 'WebGPU Not Supported',
          description: 'Your browser or device doesn\'t support WebGPU. Try Chrome 113+ on desktop.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to load AI',
          description: err.message || 'Unknown error',
          variant: 'destructive',
        });
      }
    }
  }, [engineStatus]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating || engineStatus !== 'ready') return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsGenerating(true);

    try {
      const engine = engineRef.current;
      const chatMessages = [
        {
          role: 'system' as const,
          content: 'You are a helpful AI assistant running locally on the user\'s device. You work completely offline. Be concise and helpful.',
        },
        ...newMessages.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      let assistantContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      const chunks = await engine.chat.completions.create({
        messages: chatMessages,
        stream: true,
        max_tokens: 512,
        temperature: 0.7,
      });

      for await (const chunk of chunks) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        assistantContent += delta;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
          return updated;
        });
      }

      if (!assistantContent.trim()) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'I couldn\'t generate a response. Please try again.' };
          return updated;
        });
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: '⚠️ Error generating response. Please try again.' };
        return updated;
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-base font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Offline AI
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {engineStatus === 'ready' ? (
              <><WifiOff className="h-3 w-3" /> Runs locally — no internet needed</>
            ) : (
              <><Wifi className="h-3 w-3" /> Requires download on first use</>
            )}
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" onClick={() => setMessages([])}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </header>

      {/* Chat Area */}
      <ScrollArea className="flex-1 px-4 py-4">
        {engineStatus === 'idle' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Brain className="h-16 w-16 text-primary mb-4" />
            <h2 className="text-xl font-bold mb-2">Offline AI</h2>
            <p className="text-sm text-muted-foreground mb-1 max-w-sm">
              Run a real AI model directly in your browser. Works completely offline after the first download.
            </p>
            <p className="text-xs text-muted-foreground mb-6 max-w-sm">
              Model: SmolLM2 360M · ~200MB download · Requires WebGPU (Chrome 113+)
            </p>
            <Button onClick={initEngine} className="gap-2">
              <Download className="h-4 w-4" />
              Download & Start AI
            </Button>
          </div>
        )}

        {engineStatus === 'downloading' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h2 className="text-lg font-bold mb-2">Loading AI Model...</h2>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">{downloadLabel}</p>
            <Progress value={downloadProgress} className="w-64 h-2" />
            <p className="text-xs text-muted-foreground mt-2">{downloadProgress}%</p>
          </div>
        )}

        {engineStatus === 'error' && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <WifiOff className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-lg font-bold mb-2">Failed to Load</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Your browser may not support WebGPU. Try Chrome 113+ on a desktop device.
            </p>
            <Button onClick={() => { setEngineStatus('idle'); }} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {engineStatus === 'ready' && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Brain className="h-12 w-12 text-primary mb-4" />
            <h2 className="text-lg font-bold mb-1">AI is ready!</h2>
            <p className="text-sm text-muted-foreground">Ask anything — it runs 100% on your device.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </ScrollArea>

      {/* Input Area */}
      {engineStatus === 'ready' && (
        <div className="border-t border-border bg-background p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={isGenerating}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              size="icon"
              className="shrink-0"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineAI;
