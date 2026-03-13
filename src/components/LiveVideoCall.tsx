import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Video, VideoOff, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserRestrictions } from '@/hooks/useUserRestrictions';

export function LiveVideoCall() {
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [quality, setQuality] = useState<'fast' | 'normal' | 'detailed'>('normal');
  const [isManualMode, setIsManualMode] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();
  const { restrictions } = useUserRestrictions();

  // Check if user is restricted from live video
  if (restrictions.live_video_call_disabled) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You have been restricted from using Live Video Call. Contact an admin for assistance.
        </AlertDescription>
      </Alert>
    );
  }

  const getIntervalTime = () => {
    switch (quality) {
      case 'fast': return 30000; // 30s - saves 90% credits
      case 'normal': return 15000; // 15s - saves 80% credits
      case 'detailed': return 5000; // 5s
      default: return 15000;
    }
  };

  const startVideo = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsActive(true);
      
      // Only start auto-capture if not in manual mode
      if (!isManualMode) {
        intervalRef.current = setInterval(() => {
          captureAndAnalyze();
        }, getIntervalTime());
      }

      toast({
        title: 'Camera Started',
        description: isManualMode ? 'Click "Capture Frame" to analyze' : `AI analyzing every ${getIntervalTime() / 1000}s`
      });
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Error',
        description: 'Failed to access camera. Please grant camera permissions.',
        variant: 'destructive'
      });
    }
  };

  const stopVideo = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsActive(false);
    setAnalysis('');
    
    toast({
      title: 'Camera Stopped',
      description: 'Live video call ended'
    });
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    setIsAnalyzing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to base64 image
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    try {
      const { data, error } = await supabase.functions.invoke('image-ai', {
        body: { 
          action: 'analyze', 
          imageUrl: imageData,
          prompt: 'You are a helpful AI assistant with vision capabilities. Describe what you see in this image in detail. If there are any objects, text, people, or actions, mention them. If the user is showing you something specific, provide relevant information about it. Keep your response conversational and helpful.'
        }
      });

      if (error) throw error;

      setAnalysis(prev => {
        const newAnalysis = `[${new Date().toLocaleTimeString()}] ${data.analysis}\n\n`;
        return newAnalysis + prev;
      });
    } catch (error) {
      console.error('Error analyzing frame:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stream]);

  return (
    <div className="space-y-4">
      {/* Credit Warning Banner */}
      {!isActive && (
        <div className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-3 text-amber-600 dark:text-amber-400 text-sm">
          💰 <strong>Credit Tip:</strong> Use Manual mode and Fast quality to minimize AI gateway usage. Auto mode at Detailed quality uses the most credits.
        </div>
      )}

      {/* Quality & Mode Controls */}
      {isActive && (
        <div className="flex gap-2 items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Mode:</label>
            <Button
              size="sm"
              variant={isManualMode ? "default" : "outline"}
              onClick={() => {
                setIsManualMode(true);
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                }
              }}
            >
              Manual
            </Button>
            <Button
              size="sm"
              variant={!isManualMode ? "default" : "outline"}
              onClick={() => {
                setIsManualMode(false);
                if (!intervalRef.current) {
                  intervalRef.current = setInterval(() => {
                    captureAndAnalyze();
                  }, getIntervalTime());
                }
              }}
            >
              Auto
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Quality:</label>
            <Button
              size="sm"
              variant={quality === 'fast' ? "default" : "outline"}
              onClick={() => setQuality('fast')}
            >
              Fast (30s)
            </Button>
            <Button
              size="sm"
              variant={quality === 'normal' ? "default" : "outline"}
              onClick={() => setQuality('normal')}
            >
              Normal (15s)
            </Button>
            <Button
              size="sm"
              variant={quality === 'detailed' ? "default" : "outline"}
              onClick={() => setQuality('detailed')}
            >
              Detailed (5s)
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="relative rounded-lg overflow-hidden border border-border bg-black aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {!isActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
              <div className="text-center p-4">
                <VideoOff className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Camera is off</p>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground px-3 py-1 rounded-full flex items-center gap-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing...
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={isActive ? stopVideo : startVideo}
            variant={isActive ? "destructive" : "default"}
            className="flex-1"
          >
            {isActive ? (
              <>
                <VideoOff className="mr-2 h-4 w-4" />
                Stop Video Call
              </>
            ) : (
              <>
                <Video className="mr-2 h-4 w-4" />
                Start Live Video Call
              </>
            )}
          </Button>
          {isActive && isManualMode && (
            <Button 
              onClick={captureAndAnalyze}
              disabled={isAnalyzing}
              variant="outline"
              className="flex-1"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Capture Frame'
              )}
            </Button>
          )}
        </div>
      </div>

      {analysis && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-primary">AI is seeing:</h4>
          <ScrollArea className="h-64 rounded-lg border border-border bg-muted/30 p-4">
            <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {analysis}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border">
        <p className="font-medium mb-1">💡 How it works:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Manual Mode:</strong> Click "Capture Frame" to analyze (saves most credits)</li>
          <li><strong>Auto Mode:</strong> AI analyzes continuously based on quality setting</li>
          <li><strong>Fast (30s):</strong> Great for slow-moving scenes, saves 90% credits</li>
          <li><strong>Normal (15s):</strong> Balanced mode, saves 80% credits</li>
          <li><strong>Detailed (5s):</strong> Best for fast action, uses more credits</li>
        </ul>
      </div>
    </div>
  );
}
