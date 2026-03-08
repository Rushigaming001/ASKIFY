import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, MicOff, Phone, PhoneOff, Music, User, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MusicPlayer } from '@/components/MusicPlayer';

type VoiceType = 'male' | 'female';

const VOICE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini Flash', description: 'Fast & balanced' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini Lite', description: 'Fastest response' },
  { id: 'gemma-3-4b', name: 'Gemma 3 4B', description: 'Lightweight & quick' },
  { id: 'gemma-3-12b', name: 'Gemma 3 12B', description: 'Better quality' },
  { id: 'gemma-3-27b', name: 'Gemma 3 27B', description: 'Best quality' },
  { id: 'grok', name: 'Core (Groq)', description: 'Ultra fast' },
];

// Noise filtering constants
const MIN_CONFIDENCE = 0.75; // Minimum confidence to accept speech
const MIN_WORD_COUNT = 2; // Minimum words to process (filters out random noise like "uh", "hmm")
const SILENCE_TIMEOUT_MS = 2000; // Wait 2s of silence before processing
const NOISE_WORDS = new Set(['', 'uh', 'um', 'hmm', 'hm', 'ah', 'oh', 'eh', 'mhm', 'the', 'a', 'i']);

export function VoiceChat() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [musicStream, setMusicStream] = useState<MediaStream | null>(null);
  const [voiceType, setVoiceType] = useState<VoiceType>('female');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const isConnectedRef = useRef(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const sentenceQueueRef = useRef<string[]>([]);
  const isSpeakingQueueRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        updateSelectedVoice(voices, voiceType);
      }
    };
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  useEffect(() => {
    if (availableVoices.length > 0) {
      updateSelectedVoice(availableVoices, voiceType);
    }
  }, [voiceType, availableVoices]);

  const updateSelectedVoice = (voices: SpeechSynthesisVoice[], type: VoiceType) => {
    const femaleVoices = ['Google UK English Female', 'Microsoft Zira', 'Samantha', 'Karen', 'Victoria', 'Moira', 'Tessa'];
    const maleVoices = ['Google UK English Male', 'Microsoft David', 'Daniel', 'Alex', 'Fred', 'Thomas'];
    const preferredNames = type === 'female' ? femaleVoices : maleVoices;
    
    for (const name of preferredNames) {
      const found = voices.find(v => v.name.includes(name));
      if (found) { setSelectedVoice(found); return; }
    }

    const genderHints = type === 'female' 
      ? ['female', 'woman', 'girl', 'zira', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona']
      : ['male', 'man', 'david', 'daniel', 'alex', 'fred', 'thomas', 'james'];
    
    const fallback = voices.find(v => genderHints.some(hint => v.name.toLowerCase().includes(hint)));
    setSelectedVoice(fallback || voices[0] || null);
  };

  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  // Sentence-by-sentence TTS queue for real-time feel
  const speakNextInQueue = useCallback(() => {
    if (isSpeakingQueueRef.current || sentenceQueueRef.current.length === 0) return;
    if (!synthesisRef.current) return;

    isSpeakingQueueRef.current = true;
    const text = sentenceQueueRef.current.shift()!;
    
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtteranceRef.current = utterance;
    
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.05; // Slightly faster for call-like feel
    utterance.pitch = voiceType === 'female' ? 1.1 : 0.9;
    utterance.volume = 1.0;
    
    utterance.onend = () => {
      isSpeakingQueueRef.current = false;
      currentUtteranceRef.current = null;
      
      if (sentenceQueueRef.current.length > 0) {
        // Speak next sentence immediately
        speakNextInQueue();
      } else {
        // All done speaking - resume listening
        setIsSpeaking(false);
        setAiResponse('');
        if (isConnectedRef.current && recognitionRef.current) {
          setIsListening(true);
          try { recognitionRef.current.start(); } catch {}
        }
      }
    };
    
    utterance.onerror = () => {
      isSpeakingQueueRef.current = false;
      currentUtteranceRef.current = null;
      setIsSpeaking(false);
      // Resume listening even on error
      if (isConnectedRef.current && recognitionRef.current) {
        setIsListening(true);
        try { recognitionRef.current.start(); } catch {}
      }
    };
    
    synthesisRef.current.speak(utterance);
  }, [selectedVoice, voiceType]);

  // Queue a sentence for speaking
  const queueSentence = useCallback((sentence: string) => {
    if (!sentence.trim()) return;
    sentenceQueueRef.current.push(sentence.trim());
    speakNextInQueue();
  }, [speakNextInQueue]);

  // Check if transcript is meaningful speech (not noise)
  const isMeaningfulSpeech = (transcript: string, confidence: number): boolean => {
    // Check confidence threshold
    if (confidence < MIN_CONFIDENCE) return false;
    
    const words = transcript.trim().toLowerCase().split(/\s+/);
    // Filter out noise words
    const meaningfulWords = words.filter(w => !NOISE_WORDS.has(w));
    
    // Need at least MIN_WORD_COUNT meaningful words
    if (meaningfulWords.length < MIN_WORD_COUNT) return false;
    
    // Check if it's just repeated noise
    const uniqueWords = new Set(meaningfulWords);
    if (uniqueWords.size === 1 && meaningfulWords.length > 2) return false;
    
    return true;
  };

  const processUserSpeech = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    
    console.log('Processing speech:', transcript);
    setIsListening(false);
    setIsProcessing(true);
    setLiveTranscript('');
    setAiResponse('');
    
    // Cancel any ongoing AI request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'Not Authenticated', description: 'Please log in', variant: 'destructive' });
        setIsProcessing(false);
        return;
      }
      
      // Use streaming for real-time feel
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/askify-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          messages: [{ role: 'user', content: transcript }],
          model: selectedModel,
          mode: 'normal',
          stream: true
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        // Fallback to non-streaming chat endpoint
        const fallbackResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ 
            messages: [{ role: 'user', content: transcript }],
            model: selectedModel,
            mode: 'normal'
          }),
          signal: abortControllerRef.current.signal
        });
        
        if (!fallbackResponse.ok) {
          throw new Error('Failed to get AI response');
        }
        
        const data = await fallbackResponse.json();
        const fullResponse = data.reply || '';
        setIsProcessing(false);
        
        if (fullResponse) {
          setAiResponse(fullResponse);
          // Split into sentences and queue for speaking
          const sentences = fullResponse.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [fullResponse];
          // Stop recognition before speaking
          try { recognitionRef.current?.stop(); } catch {}
          sentences.forEach((s: string) => queueSentence(s));
        } else {
          if (isConnectedRef.current && recognitionRef.current) {
            setIsListening(true);
            try { recognitionRef.current.start(); } catch {}
          }
        }
        return;
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');
      
      const decoder = new TextDecoder();
      let fullText = '';
      let sentenceBuffer = '';
      
      setIsProcessing(false);
      // Stop recognition before speaking
      try { recognitionRef.current?.stop(); } catch {}
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.startsWith('data: ') || line.trim() === '') continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              sentenceBuffer += content;
              setAiResponse(fullText);
              
              // Check for sentence boundaries and queue for immediate speaking
              const sentenceMatch = sentenceBuffer.match(/^(.*?[.!?])\s*(.*)/s);
              if (sentenceMatch) {
                queueSentence(sentenceMatch[1]);
                sentenceBuffer = sentenceMatch[2] || '';
              }
            }
          } catch {}
        }
      }
      
      // Speak remaining buffer
      if (sentenceBuffer.trim()) {
        queueSentence(sentenceBuffer);
      }
      
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error:', error);
      setIsProcessing(false);
      toast({ title: 'Error', description: 'Failed to get AI response', variant: 'destructive' });
      if (isConnectedRef.current && recognitionRef.current) {
        setIsListening(true);
        try { recognitionRef.current.start(); } catch {}
      }
    }
  }, [toast, selectedModel, queueSentence]);

  const startVoiceChat = async () => {
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast({ title: 'Not Supported', description: 'Speech recognition not supported', variant: 'destructive' });
        return;
      }

      // Request mic with noise suppression
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true, 
            noiseSuppression: true, 
            autoGainControl: true 
          } 
        });
        // We don't need the stream directly, just need to ensure permission
        stream.getTracks().forEach(t => t.stop());
      } catch {
        toast({ title: 'Microphone Access', description: 'Please allow microphone access', variant: 'destructive' });
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.maxAlternatives = 1;

      synthesisRef.current = window.speechSynthesis;
      sentenceQueueRef.current = [];
      isSpeakingQueueRef.current = false;

      recognitionRef.current.onstart = () => {
        setIsConnected(true);
        setIsListening(true);
        toast({ title: 'Voice Chat Started', description: `Using ${VOICE_MODELS.find(m => m.id === selectedModel)?.name}` });
      };

      let finalTranscript = '';
      let silenceTimeout: ReturnType<typeof setTimeout> | null = null;

      recognitionRef.current.onresult = (event: any) => {
        // Don't process if AI is speaking
        if (isSpeakingRef.current || isProcessingRef.current) return;
        
        if (silenceTimeout) clearTimeout(silenceTimeout);

        let interimTranscript = '';
        let maxConfidence = 0;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0;
          maxConfidence = Math.max(maxConfidence, confidence);
          
          if (result.isFinal) {
            // Only accept high-confidence final results
            if (confidence >= MIN_CONFIDENCE && isMeaningfulSpeech(transcript, confidence)) {
              finalTranscript += transcript;
            } else {
              console.log(`Filtered noise: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
            }
          } else {
            interimTranscript += transcript;
          }
        }

        // Show live transcript
        setLiveTranscript(finalTranscript + interimTranscript);

        if (finalTranscript.trim()) {
          // Process final transcript after short silence
          silenceTimeout = setTimeout(() => {
            if (finalTranscript.trim() && isConnectedRef.current && !isSpeakingRef.current) {
              const toProcess = finalTranscript.trim();
              finalTranscript = '';
              setLiveTranscript('');
              recognitionRef.current?.stop();
              processUserSpeech(toProcess);
            }
          }, 800); // Short pause after final result
        } else if (interimTranscript.trim()) {
          // For interim results, use longer silence timeout and check confidence
          silenceTimeout = setTimeout(() => {
            if (interimTranscript.trim() && isConnectedRef.current && !isSpeakingRef.current) {
              // Only process interim if it looks like real speech
              if (isMeaningfulSpeech(interimTranscript, maxConfidence > 0 ? maxConfidence : 0.8)) {
                const toProcess = interimTranscript.trim();
                finalTranscript = '';
                setLiveTranscript('');
                recognitionRef.current?.stop();
                processUserSpeech(toProcess);
              }
            }
          }, SILENCE_TIMEOUT_MS);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.error('Speech recognition error:', event.error);
        }
      };

      recognitionRef.current.onend = () => {
        if (isConnectedRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
          setTimeout(() => {
            if (isConnectedRef.current && recognitionRef.current && !isSpeakingRef.current) {
              try { recognitionRef.current.start(); setIsListening(true); } catch {}
            }
          }, 200);
        }
      };

      recognitionRef.current.start();
    } catch (error) {
      console.error('Error starting voice chat:', error);
      toast({ title: 'Error', description: 'Failed to start voice chat', variant: 'destructive' });
    }
  };

  const stopVoiceChat = () => {
    isConnectedRef.current = false;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    if (synthesisRef.current) { synthesisRef.current.cancel(); synthesisRef.current = null; }
    currentUtteranceRef.current = null;
    sentenceQueueRef.current = [];
    isSpeakingQueueRef.current = false;
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    setLiveTranscript('');
    setAiResponse('');
  };

  // Interrupt AI when user starts speaking
  const interruptAI = useCallback(() => {
    if (isSpeakingRef.current && synthesisRef.current) {
      synthesisRef.current.cancel();
      sentenceQueueRef.current = [];
      isSpeakingQueueRef.current = false;
      setIsSpeaking(false);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    }
  }, []);

  useEffect(() => { return () => { stopVoiceChat(); }; }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Voice Chat with AI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Model Selection */}
        <div className="flex items-center gap-3">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">AI Model:</span>
          <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isConnected}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <span>{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Voice Selection */}
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Voice:</span>
          <Select value={voiceType} onValueChange={(v) => setVoiceType(v as VoiceType)} disabled={isConnected}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all ${
            isConnected 
              ? isProcessing
                ? 'bg-yellow-500/20'
                : isSpeaking
                  ? 'bg-green-500/20'
                  : 'bg-primary/20 animate-pulse' 
              : 'bg-muted'
          }`}>
            <div className={`absolute inset-0 rounded-full ${
              isSpeaking 
                ? 'bg-green-500/30 animate-ping' 
                : isProcessing
                  ? 'bg-yellow-500/30 animate-pulse'
                  : ''
            }`}></div>
            <div 
              className={`relative z-10 p-6 rounded-full cursor-pointer ${
                isConnected 
                  ? isProcessing
                    ? 'bg-yellow-500'
                    : isSpeaking
                      ? 'bg-green-500'
                      : 'bg-primary'
                  : 'bg-muted-foreground'
              }`}
              onClick={isSpeaking ? interruptAI : undefined}
            >
              {isListening ? (
                <Mic className="h-12 w-12 text-white" />
              ) : (
                <MicOff className="h-12 w-12 text-white" />
              )}
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-lg font-medium">
              {isConnected 
                ? isProcessing
                  ? 'Thinking...'
                  : isSpeaking 
                    ? 'AI is speaking...' 
                    : 'Listening...'
                : 'Not connected'}
            </p>
            
            {/* Live transcript */}
            {liveTranscript && (
              <p className="text-sm text-primary font-medium px-4 py-2 bg-primary/10 rounded-lg max-w-xs">
                "{liveTranscript}"
              </p>
            )}
            
            {/* AI response preview */}
            {aiResponse && isSpeaking && (
              <p className="text-xs text-muted-foreground px-4 py-1 max-w-xs line-clamp-2">
                {aiResponse.slice(-100)}
              </p>
            )}
            
            <p className="text-sm text-muted-foreground">
              {isConnected 
                ? isSpeaking 
                  ? 'Tap mic to interrupt' 
                  : 'Speak naturally, background noise is filtered'
                : 'Click to start voice chat'}
            </p>
            {selectedVoice && (
              <p className="text-xs text-muted-foreground">Voice: {selectedVoice.name}</p>
            )}
            {isConnected && (
              <p className="text-xs text-primary">
                Model: {VOICE_MODELS.find(m => m.id === selectedModel)?.name}
              </p>
            )}
          </div>

          {!isConnected ? (
            <Button onClick={startVoiceChat} size="lg" className="w-full">
              <Phone className="mr-2 h-5 w-5" /> Start Voice Chat
            </Button>
          ) : (
            <Button onClick={stopVoiceChat} variant="destructive" size="lg" className="w-full">
              <PhoneOff className="mr-2 h-5 w-5" /> End Voice Chat
            </Button>
          )}
        </div>

        <div className="p-4 rounded-lg bg-muted/50 border border-border text-sm">
          <p className="font-medium mb-2">Features:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Real-time voice conversation</li>
            <li>• Background noise filtering</li>
            <li>• Sentence-by-sentence streaming</li>
            <li>• Tap mic to interrupt AI</li>
            <li>• Choose AI model & voice</li>
            <li>• Hands-free interaction</li>
          </ul>
        </div>

        <Button variant="outline" className="w-full" onClick={() => setShowMusicPlayer(!showMusicPlayer)}>
          <Music className="h-4 w-4 mr-2" />
          {showMusicPlayer ? 'Hide Music Player' : 'Show Music Player'}
        </Button>

        {showMusicPlayer && <MusicPlayer onAudioStream={setMusicStream} compact={false} />}
      </CardContent>
    </Card>
  );
}
