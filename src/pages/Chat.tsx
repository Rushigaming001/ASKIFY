import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { Sidebar } from '@/components/Sidebar';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { callAI } from '@/services/chatService';
import { canAccessModel } from '@/services/modelPermissionService';
import { useToast } from '@/hooks/use-toast';
import { useDailyMessageLimit } from '@/hooks/useDailyMessageLimit';
import { useUserRestrictions } from '@/hooks/useUserRestrictions';
import { Loader2, Lock, AlertCircle, MessageCircle, Sparkles, Pencil, Gamepad2, Wind, BarChart3, Play, BookOpen, Menu, X, Calculator, Video, Film, Box, Clapperboard, MoreHorizontal } from 'lucide-react';
import { AskifyLogo } from '@/components/AskifyLogo';
import { MathSolver } from '@/components/MathSolver';
import { LiveVideoCall } from '@/components/LiveVideoCall';
import { VideoGenerator } from '@/components/VideoGenerator';
import MinecraftPluginMaker from '@/components/MinecraftPluginMaker';
import CapCutPro from '@/components/CapCutPro';
import { ExpensiveModelWarning, isExpensiveModel, getModelDisplayName } from '@/components/ExpensiveModelWarning';

const Chat = () => {
  const { user, session, isLoading: authLoading } = useAuth();
  const { currentChat, addMessage, updateChatSettings, createNewChat } = useChat();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('grok');
  const [modelAccess, setModelAccess] = useState<Record<string, boolean>>({});
  const [showFeaturesMenu, setShowFeaturesMenu] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { used, remaining, total, canSend, loading: limitLoading, refresh: refreshLimit } = useDailyMessageLimit();
  const { restrictions } = useUserRestrictions();

  useEffect(() => {
    if (authLoading) return;

    const userId = session?.user?.id;
    if (!userId) {
      navigate('/auth', { replace: true });
      return;
    }

    checkModelAccess(userId);
  }, [authLoading, session?.user?.id, navigate]);

  const checkModelAccess = async (userId: string) => {
    const modelMap: Record<string, string> = {
      'grok': 'groq/llama-3.3-70b',
      'cohere': 'cohere/command-r-plus',
      'deepseek': 'deepseek/deepseek-chat',
      'gemini': 'google/gemini-2.5-flash',
      'gemini-lite': 'google/gemini-2.5-flash-lite',
      'gemini-3': 'google/gemini-3-pro-preview',
      'gemini-3-flash': 'google/gemini-3-flash',
      'askify': 'google/gemini-2.5-pro',
      'nano-banana': 'google/gemini-2.5-flash-image-preview',
      'gemma-3-1b': 'google/gemma-3-1b',
      'gemma-3-4b': 'google/gemma-3-4b',
      'gemma-3-12b': 'google/gemma-3-12b',
      'gemma-3-27b': 'google/gemma-3-27b',
      'gpt': 'openai/gpt-5',
      'gpt-mini': 'openai/gpt-5-mini',
      'gpt-nano': 'openai/gpt-5-nano',
      'gpt-5.2': 'openai/gpt-5.2',
      'gpt-4o-audio': 'openai/gpt-4o-mini-audio',
      'claude-haiku': 'anthropic/claude-haiku-4.5',
      'claude-sonnet': 'anthropic/claude-sonnet-4.5',
      'claude-opus': 'anthropic/claude-opus-4.5',
      'qwen-coder': 'qwen/qwen-2.5-coder-32b',
      'mistral-small': 'mistral/mistral-small-3.2-24b',
      'deepseek-v3': 'deepseek/deepseek-v3.2',
      'grok-4-fast': 'xai/grok-4-fast',
      'perplexity-sonar': 'perplexity/sonar',
      'perplexity-reasoning': 'perplexity/sonar-reasoning',
      'kimi-k2': 'moonshot/kimi-k2-thinking',
      'nova-micro': 'amazon/nova-micro',
      'chicky-tutor': 'chicky-tutor',
      'midijourney': 'midijourney'
    };
    
    // All models always accessible (permission check handled server-side for locked ones)
    const access: Record<string, boolean> = {};
    for (const [key, modelId] of Object.entries(modelMap)) {
      access[key] = await canAccessModel(modelId, userId);
    }
    // Always allow these core models
    ['grok', 'cohere', 'deepseek', 'gemini', 'gemini-lite', 'gemini-3-flash', 'askify',
     'gemma-3-1b', 'gemma-3-4b', 'gemma-3-12b', 'gemma-3-27b', 'nano-banana',
     'gpt-5.2', 'gpt-4o-audio', 'claude-haiku', 'claude-sonnet', 'claude-opus',
     'qwen-coder', 'mistral-small', 'grok-4-fast', 'perplexity-sonar',
     'perplexity-reasoning', 'kimi-k2', 'nova-micro', 'chicky-tutor', 'midijourney',
     'deepseek-v3', 'gemini-3'].forEach(k => { if (!(k in access) || !access[k]) access[k] = true; });
    setModelAccess(access);
  };

  useEffect(() => {
    const scrollContainer = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [currentChat?.messages, isLoading, streamingText]);

  const handleSendMessage = async (content: string, images?: string[]) => {
    let chatToUse = currentChat;
    if (!chatToUse) {
      await createNewChat();
      await new Promise(resolve => setTimeout(resolve, 100));
      return handleSendMessage(content, images);
    }

    if (restrictions.ai_chat_disabled) {
      toast({
        title: '🚫 Access Restricted',
        description: 'You have been restricted from using AI chat.',
        variant: 'destructive',
        duration: 6000
      });
      return;
    }

    if (!canSend) {
      toast({
        title: '📅 Daily Limit Reached',
        description: `You've used all ${total} messages for today.`,
        variant: 'destructive',
        duration: 6000
      });
      return;
    }

    const firstImage = images?.[0];
    const existingMessages = currentChat.messages.map(m => ({ role: m.role, content: m.content }));
    
    await addMessage({ role: 'user', content, image: firstImage });
    setIsLoading(true);
    setStreamingText('');

    try {
      const messages = [
        ...existingMessages,
        { role: 'user', content }
      ];

      const response = await callAI(messages, selectedModel, currentChat.mode, firstImage);
      
      // Typing effect - simulate streaming by revealing text progressively
      const words = response.split(' ');
      let displayed = '';
      for (let i = 0; i < words.length; i++) {
        displayed += (i > 0 ? ' ' : '') + words[i];
        setStreamingText(displayed);
        // Speed: ~20ms per word for fast typing effect
        await new Promise(r => setTimeout(r, 18));
      }
      
      setStreamingText('');
      await addMessage({ role: 'assistant', content: response });
      
      setTimeout(() => refreshLimit(), 500);
    } catch (error: any) {
      console.error('Error calling AI:', error);
      setStreamingText('');
      
      const errorMessage = error?.message || 'Failed to get response from AI. Please try again.';
      toast({
        title: error?.message?.includes('credits') ? '💳 Out of Credits' : 'Error',
        description: errorMessage,
        variant: 'destructive',
        duration: error?.message?.includes('credits') ? 8000 : 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (mode: 'normal' | 'deepthink' | 'search' | 'reasoning') => {
    if (currentChat) {
      updateChatSettings(selectedModel, mode);
    }
  };

  const handleModelChange = (model: string) => {
    if (model === 'offline-ai') {
      navigate('/offline-ai');
      return;
    }
    if (!modelAccess[model]) {
      toast({
        title: 'Access Denied',
        description: 'You don\'t have access to this model. Please upgrade your account.',
        variant: 'destructive'
      });
      return;
    }
    
    setSelectedModel(model);
    if (currentChat) {
      updateChatSettings(model as any, currentChat.mode);
    }
  };

  const featureItems = [
    { icon: MessageCircle, label: 'Public Chat', path: '/public-chat', color: 'text-blue-500' },
    { icon: Sparkles, label: 'AI Features', path: '/ai-features', color: 'text-purple-500' },
    { icon: Pencil, label: 'Skribbl', path: '/skribbl', color: 'text-orange-500' },
    { icon: Gamepad2, label: 'FPS Shooter', path: '/game', color: 'text-red-500' },
    { icon: Wind, label: 'AQI Checker', path: '/aqi', color: 'text-green-500' },
    { icon: BarChart3, label: 'Data Analyzer', path: '/data-analyzer', color: 'text-cyan-500' },
    { icon: Play, label: 'YouTube', path: '/youtube', color: 'text-red-600' },
    { icon: BookOpen, label: 'Learn Languages', path: '/learn', color: 'text-emerald-500' },
  ];

  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!session?.user) return null;

  const showWelcome = !currentChat || currentChat.messages.length === 0;

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
      {isExpensiveModel(selectedModel) && (
        <ExpensiveModelWarning modelName={getModelDisplayName(selectedModel)} />
      )}
      
      <Sidebar 
        isOpen={true} 
        onToggle={() => {}} 
        alwaysOpen={true} 
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
      />
      
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} />
      )}
      
      <div className={`flex-1 flex flex-col min-w-0 h-full animate-fade-in transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72'} ${isExpensiveModel(selectedModel) ? 'pt-8' : ''}`}>
        <header className="flex-shrink-0 border-b border-border px-2 py-1.5 sm:px-3 sm:py-2 md:p-3 flex items-center justify-between gap-1 sm:gap-2 md:gap-4 bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95 relative z-50 animate-fade-in">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden h-7 w-7 sm:h-8 sm:w-8 hover:scale-110 transition-all duration-200"
            >
              <span className="text-lg sm:text-xl">☰</span>
            </Button>
            {!limitLoading && (
              <Badge 
                variant={remaining <= 5 ? "destructive" : remaining <= 10 ? "secondary" : "default"}
                className="ml-1 flex items-center gap-1 text-[10px] px-1.5"
              >
                {remaining}/{total}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="w-[70px] sm:w-[100px] md:w-[140px] h-7 sm:h-8 text-[10px] sm:text-xs md:text-sm hover:border-primary/50 transition-all duration-200 px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur-sm max-h-[400px]">
                {/* Offline AI - Top */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Offline</div>
                <SelectItem value="offline-ai">
                  <div className="flex items-center gap-2">
                    <span>🧠 Offline AI</span>
                  </div>
                </SelectItem>

                {/* Core Models */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">Core</div>
                <SelectItem value="grok" disabled={!modelAccess.grok}>
                  <div className="flex items-center gap-2">
                    {!modelAccess.grok && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span className="font-semibold">⚡ Core</span>
                  </div>
                </SelectItem>
                <SelectItem value="cohere" disabled={!modelAccess.cohere}>
                  <div className="flex items-center gap-2">
                    {!modelAccess.cohere && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span className="font-semibold">🔥 Pro</span>
                  </div>
                </SelectItem>
                <SelectItem value="deepseek" disabled={!modelAccess.deepseek}>
                  <div className="flex items-center gap-2">
                    {!modelAccess.deepseek && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>💡 Lite</span>
                  </div>
                </SelectItem>
                
                {/* Gemini Models */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">Gemini</div>
                <SelectItem value="gemini" disabled={!modelAccess.gemini}>
                  <div className="flex items-center gap-2">
                    <span>⚡ Gemini 2.5 Flash</span>
                  </div>
                </SelectItem>
                <SelectItem value="gemini-lite" disabled={!modelAccess['gemini-lite']}>
                  <div className="flex items-center gap-2">
                    <span>💨 Gemini 2.5 Flash Lite</span>
                  </div>
                </SelectItem>
                <SelectItem value="gemini-3-flash" disabled={!modelAccess['gemini-3-flash']}>
                  <div className="flex items-center gap-2">
                    <span>🚀 Gemini 3 Flash</span>
                  </div>
                </SelectItem>
                <SelectItem value="askify" disabled={!modelAccess.askify}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tracking-wide">✨ ASKIFY PRO</span>
                  </div>
                </SelectItem>

                {/* Gemma Models */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">Gemma</div>
                <SelectItem value="gemma-3-1b" disabled={!modelAccess['gemma-3-1b']}>
                  <div className="flex items-center gap-2">
                    <span>Gemma 3 1B</span>
                    <span className="text-xs text-muted-foreground">(Fastest)</span>
                  </div>
                </SelectItem>
                <SelectItem value="gemma-3-4b" disabled={!modelAccess['gemma-3-4b']}>
                  <div className="flex items-center gap-2">
                    <span>Gemma 3 4B</span>
                  </div>
                </SelectItem>
                <SelectItem value="gemma-3-12b" disabled={!modelAccess['gemma-3-12b']}>
                  <div className="flex items-center gap-2">
                    <span>Gemma 3 12B</span>
                  </div>
                </SelectItem>
                <SelectItem value="gemma-3-27b" disabled={!modelAccess['gemma-3-27b']}>
                  <div className="flex items-center gap-2">
                    <span>Gemma 3 27B</span>
                    <span className="text-xs text-muted-foreground">(Best)</span>
                  </div>
                </SelectItem>
                
                {/* GPT Models */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">ChatGPT</div>
                <SelectItem value="gpt" disabled={!modelAccess.gpt}>
                  <div className="flex items-center gap-2">
                    {!modelAccess.gpt && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>GPT-5</span>
                  </div>
                </SelectItem>
                <SelectItem value="gpt-mini" disabled={!modelAccess['gpt-mini']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['gpt-mini'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>GPT-5 Mini</span>
                  </div>
                </SelectItem>
                <SelectItem value="gpt-nano" disabled={!modelAccess['gpt-nano']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['gpt-nano'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>GPT-5 Nano</span>
                  </div>
                </SelectItem>
                <SelectItem value="gpt-5.2" disabled={!modelAccess['gpt-5.2']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['gpt-5.2'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>GPT-5.2</span>
                  </div>
                </SelectItem>
                <SelectItem value="gpt-4o-audio" disabled={!modelAccess['gpt-4o-audio']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['gpt-4o-audio'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>GPT-4o Audio</span>
                  </div>
                </SelectItem>

                {/* Claude Models */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">Claude</div>
                <SelectItem value="claude-haiku" disabled={!modelAccess['claude-haiku']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['claude-haiku'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Claude Haiku 4.5</span>
                  </div>
                </SelectItem>
                <SelectItem value="claude-sonnet" disabled={!modelAccess['claude-sonnet']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['claude-sonnet'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Claude Sonnet 4.5</span>
                  </div>
                </SelectItem>
                <SelectItem value="claude-opus" disabled={!modelAccess['claude-opus']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['claude-opus'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Claude Opus 4.5</span>
                  </div>
                </SelectItem>

                {/* Other Models */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">Other AI</div>
                <SelectItem value="deepseek-v3" disabled={!modelAccess['deepseek-v3']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['deepseek-v3'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>DeepSeek V3.2</span>
                  </div>
                </SelectItem>
                <SelectItem value="qwen-coder" disabled={!modelAccess['qwen-coder']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['qwen-coder'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Qwen Coder 32B</span>
                  </div>
                </SelectItem>
                <SelectItem value="mistral-small" disabled={!modelAccess['mistral-small']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['mistral-small'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Mistral Small</span>
                  </div>
                </SelectItem>
                <SelectItem value="grok-4-fast" disabled={!modelAccess['grok-4-fast']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['grok-4-fast'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>xAI Grok 4 Fast</span>
                  </div>
                </SelectItem>
                <SelectItem value="kimi-k2" disabled={!modelAccess['kimi-k2']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['kimi-k2'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Kimi K2 Thinking</span>
                  </div>
                </SelectItem>
                <SelectItem value="nova-micro" disabled={!modelAccess['nova-micro']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['nova-micro'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Amazon Nova Micro</span>
                  </div>
                </SelectItem>

                {/* Search Models */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">Search</div>
                <SelectItem value="perplexity-sonar" disabled={!modelAccess['perplexity-sonar']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['perplexity-sonar'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Perplexity Sonar</span>
                  </div>
                </SelectItem>
                <SelectItem value="perplexity-reasoning" disabled={!modelAccess['perplexity-reasoning']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['perplexity-reasoning'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>Perplexity Reasoning</span>
                  </div>
                </SelectItem>

                {/* Specialty Models */}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1">Specialty</div>
                <SelectItem value="chicky-tutor" disabled={!modelAccess['chicky-tutor']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['chicky-tutor'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>🐤 ChickyTutor</span>
                  </div>
                </SelectItem>
                <SelectItem value="midijourney" disabled={!modelAccess['midijourney']}>
                  <div className="flex items-center gap-2">
                    {!modelAccess['midijourney'] && <Lock className="h-3 w-3 text-muted-foreground" />}
                    <span>🎨 MIDIjourney</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Warning Banners */}
        {!limitLoading && remaining <= 5 && remaining > 0 && (
          <Alert variant="destructive" className="m-4 animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              ⚠️ Only {remaining} messages remaining today! Your limit resets at midnight.
            </AlertDescription>
          </Alert>
        )}
        {['gpt', 'askify'].includes(selectedModel) && (
          <Alert className="m-4 bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400 animate-fade-in">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              💰 You're using a premium model. Consider switching to Gemini Flash to save credits.
            </AlertDescription>
          </Alert>
        )}

        {showWelcome ? (
          <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="flex flex-col items-center justify-center max-w-2xl w-full">
              <p className="text-muted-foreground text-sm mb-2 text-center">
                What can I help you with today?
              </p>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-medium mb-4 sm:mb-6 text-foreground text-center animate-scale-in">
                Ready when you are.
              </h1>
              <ChatInput
                onSendMessage={handleSendMessage}
                onModeChange={handleModeChange}
                mode={currentChat?.mode || 'normal'}
                disabled={false}
                centered={true}
              />
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0 chat-scroll" ref={scrollRef}>
            <div className="animate-fade-in">
              {currentChat?.messages.map((message, index) => (
                <div 
                  key={message.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
                >
                  <ChatMessage message={message} />
                </div>
              ))}
              {/* Streaming text - typing effect */}
              {streamingText && (
                <div className="flex gap-4 p-6 bg-muted/30 animate-fade-in">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-gradient-to-br from-primary/20 to-accent">
                    <img src="/logo.png" alt="Askify" className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">Askify</div>
                    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                      {streamingText}
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
              {isLoading && !streamingText && (
                <div className="flex items-center justify-center p-8 animate-fade-in">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Bottom ChatInput - never disabled so user can type while AI responds */}
        {!showWelcome && (
          <div className="chat-input-appear w-full flex justify-center">
            <div className="w-full max-w-3xl px-4">
              <ChatInput
                onSendMessage={handleSendMessage}
                onModeChange={handleModeChange}
                mode={currentChat?.mode || 'normal'}
                disabled={false}
              />
            </div>
          </div>
        )}
      </div>

        {/* Floating Features Menu Button */}
        <div className="fixed bottom-20 sm:bottom-24 right-3 sm:right-4 z-50">
          <Button
            onClick={() => setShowFeaturesMenu(!showFeaturesMenu)}
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-110"
            size="icon"
          >
            {showFeaturesMenu ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
        </div>

      {/* Features Menu Popup */}
      {showFeaturesMenu && (
        <>
          <div 
            className="fixed inset-0 bg-background/50 backdrop-blur-sm z-40"
            onClick={() => setShowFeaturesMenu(false)}
          />
          <div className="fixed bottom-32 sm:bottom-40 right-3 sm:right-4 z-50 bg-background border border-border rounded-xl shadow-2xl p-2 sm:p-3 w-52 sm:w-60 animate-scale-in max-h-[60vh] overflow-y-auto">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              AI Tools
            </div>
            <div className="space-y-1 mb-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-sm" disabled={restrictions.math_solver_disabled}>
                    <Calculator className="h-4 w-4 text-blue-500" />
                    Math Solver
                  </Button>
                </DialogTrigger>
                {!restrictions.math_solver_disabled && (
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Math Solver</DialogTitle></DialogHeader>
                    <MathSolver />
                  </DialogContent>
                )}
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-sm" disabled={restrictions.live_video_call_disabled}>
                    <Video className="h-4 w-4 text-green-500" />
                    Live Video
                  </Button>
                </DialogTrigger>
                {!restrictions.live_video_call_disabled && (
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Live Video Call with AI</DialogTitle></DialogHeader>
                    <LiveVideoCall />
                  </DialogContent>
                )}
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-sm" disabled={restrictions.video_generation_disabled}>
                    <Film className="h-4 w-4 text-purple-500" />
                    Video Gen
                  </Button>
                </DialogTrigger>
                {!restrictions.video_generation_disabled && (
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>AI Video Generator</DialogTitle></DialogHeader>
                    <VideoGenerator />
                  </DialogContent>
                )}
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-sm" disabled={restrictions.minecraft_plugin_disabled}>
                    <Box className="h-4 w-4 text-orange-500" />
                    Minecraft
                  </Button>
                </DialogTrigger>
                {!restrictions.minecraft_plugin_disabled && (
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Minecraft Creator Studio</DialogTitle></DialogHeader>
                    <MinecraftPluginMaker />
                  </DialogContent>
                )}
              </Dialog>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
                    <Clapperboard className="h-4 w-4 text-pink-500" />
                    CapCut
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>CapCut Pro Video Editor</DialogTitle></DialogHeader>
                  <CapCutPro />
                </DialogContent>
              </Dialog>
            </div>
            
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 border-t pt-2">
              Features
            </div>
            <div className="space-y-1">
              {featureItems.map((item) => (
                <Button
                  key={item.path}
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm"
                  onClick={() => {
                    navigate(item.path);
                    setShowFeaturesMenu(false);
                  }}
                >
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;
