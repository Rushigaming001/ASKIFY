import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Calculator, BookOpen, GraduationCap, Camera, SwitchCamera, AlertCircle, Download, Copy, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUserRestrictions } from '@/hooks/useUserRestrictions';

const MAHARASHTRA_BOARD_CHAPTERS = {
  algebra: [
    "Sets",
    "Real Numbers", 
    "Polynomials",
    "Linear Equations in Two Variables",
    "Ratio and Proportion",
    "Financial Planning"
  ],
  geometry: [
    "Lines and Angles",
    "Triangles",
    "Quadrilaterals",
    "Circle",
    "Co-ordinate Geometry",
    "Trigonometry",
    "Surface Area and Volume"
  ],
  statistics: [
    "Statistics",
    "Probability"
  ]
};

export function MathSolver() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [solution, setSolution] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState<string>('');
  const [chapter, setChapter] = useState<string>('');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { restrictions } = useUserRestrictions();

  // Get available camera devices
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedCamera) {
          const backCam = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          setSelectedCamera(backCam?.deviceId || videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error getting cameras:', err);
      }
    };
    getCameras();
  }, []);

  // Start/stop camera stream when showCamera or selectedCamera changes
  useEffect(() => {
    if (showCamera && selectedCamera) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [showCamera, selectedCamera]);

  // Check if user is restricted from math solver
  if (restrictions.math_solver_disabled) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          You have been restricted from using the Math Solver. Contact an admin for assistance.
        </AlertDescription>
      </Alert>
    );
  }

  const startCamera = async () => {
    try {
      stopCamera();
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined, facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast({ title: 'Camera Error', description: 'Could not access camera. Please check permissions.', variant: 'destructive' });
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setSelectedImage(dataUrl);
      setSolution(null);
      setShowCamera(false);
      stopCamera();
      toast({ title: 'Photo captured!', description: 'Now tap Solve to get the answer.' });
    }
  };

  const switchCamera = () => {
    if (cameraDevices.length < 2) return;
    const idx = cameraDevices.findIndex(d => d.deviceId === selectedCamera);
    const nextIdx = (idx + 1) % cameraDevices.length;
    setSelectedCamera(cameraDevices[nextIdx].deviceId);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Please select an image file',
        variant: 'destructive'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
      setSolution(null);
    };
    reader.readAsDataURL(file);
  };

  const getChapters = () => {
    if (subject === 'algebra') return MAHARASHTRA_BOARD_CHAPTERS.algebra;
    if (subject === 'geometry') return MAHARASHTRA_BOARD_CHAPTERS.geometry;
    if (subject === 'statistics') return MAHARASHTRA_BOARD_CHAPTERS.statistics;
    return [];
  };

  const handleSolve = async () => {
    if (!selectedImage) {
      toast({
        title: 'Error',
        description: 'Please select an image first',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const chapterContext = (subject && subject !== 'auto') || (chapter && chapter !== 'auto') 
        ? `This is from Maharashtra Board Class 9th${subject && subject !== 'auto' ? `, ${subject.charAt(0).toUpperCase() + subject.slice(1)}` : ''}${chapter && chapter !== 'auto' ? `, Chapter: ${chapter}` : ''}.` 
        : '';
      
      const { data, error } = await supabase.functions.invoke('image-ai', {
        body: { 
          action: 'analyze', 
          imageUrl: selectedImage,
          prompt: `You are an expert Maharashtra State Board Math teacher. Solve this math problem step-by-step following the answer format used on maharashtra.shala.com, Balbharti textbooks, and BYJU'S.

${chapterContext}

IMPORTANT FORMATTING RULES:
- Do NOT use any asterisks (*), markdown, or special formatting symbols
- Use plain text only with clear headings
- Use bullet points with "•" character
- Use arrows "→" for step transitions
- Number steps as Step 1:, Step 2:, etc.

Answer in this exact plain-text format:

📝 Question:
[Identify and write the question from the image]

📋 Given:
• [List all given information]

🎯 To Find:
• [What needs to be found/proved]

📐 Formula / Theorem Used:
• [State formulas, theorems, or properties by name - as referenced in Balbharti textbook]

✍️ Solution:

Step 1:
[Clear explanation with calculation]

Step 2:
[Next step with calculation]

[Continue all necessary steps...]

✅ Answer:
[Final answer with proper units]

📌 Note:
[Important points, alternative methods, or Balbharti textbook reference]

Guidelines:
1. Use standard mathematical notation (no markdown)
2. Show every working step clearly as done in Shala.com solutions
3. Mention theorem/property names as per Balbharti textbook
4. For geometry: mention construction steps separately
5. For algebra: show step-by-step simplification
6. Reference the approach used in Maharashtra Board exam pattern
7. Keep it clean, readable, and exam-ready`
        }
      });

      if (error) throw error;

      // Clean the response: remove leftover markdown stars and artifacts
      let cleanSolution = data.analysis || '';
      cleanSolution = cleanSolution.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '');
      setSolution(cleanSolution);
      toast({
        title: 'Success!',
        description: 'Solved using Maharashtra Board (Shala + Balbharti) format!'
      });
    } catch (error) {
      console.error('Error solving math problem:', error);
      toast({
        title: 'Error',
        description: 'Failed to solve the math problem. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Subject & Chapter Selection */}
      <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GraduationCap className="h-4 w-4 text-primary" />
          Maharashtra Board - Class 9th
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Select value={subject} onValueChange={(val) => { setSubject(val); setChapter(''); }}>
              <SelectTrigger className="h-11 touch-target">
                <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto Detect (Any Subject)</SelectItem>
                <SelectItem value="algebra">Algebra</SelectItem>
                <SelectItem value="geometry">Geometry</SelectItem>
                <SelectItem value="statistics">Statistics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Chapter</Label>
            <Select value={chapter} onValueChange={setChapter} disabled={subject !== 'auto' && !subject}>
              <SelectTrigger className="h-11 touch-target">
                <SelectValue placeholder="Select Chapter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto Detect (Any Chapter)</SelectItem>
                {getChapters().map((ch) => (
                  <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Camera Section */}
      {showCamera && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-black">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-64 object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
            {cameraDevices.length > 1 && (
              <Button size="icon" variant="secondary" onClick={switchCamera} className="rounded-full h-12 w-12">
                <SwitchCamera className="h-5 w-5" />
              </Button>
            )}
            <Button size="lg" onClick={captureFromCamera} className="rounded-full h-14 w-14 bg-white hover:bg-white/90">
              <Camera className="h-6 w-6 text-black" />
            </Button>
            <Button size="icon" variant="destructive" onClick={() => { setShowCamera(false); stopCamera(); }} className="rounded-full h-12 w-12">
              ✕
            </Button>
          </div>
          {cameraDevices.length > 1 && (
            <div className="absolute top-2 right-2">
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-black/60 text-white border-white/30">
                  <SelectValue placeholder="Camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameraDevices.map((d, i) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Upload/Camera Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button 
          onClick={() => fileInputRef.current?.click()} 
          variant="outline" 
          className="h-14 text-sm gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all touch-target"
          disabled={loading || showCamera}
        >
          <Upload className="h-5 w-5" />
          Upload
        </Button>
        <Button 
          onClick={() => setShowCamera(true)} 
          variant="outline" 
          className="h-14 text-sm gap-2 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all touch-target"
          disabled={loading || showCamera}
        >
          <Camera className="h-5 w-5" />
          Camera
        </Button>
      </div>

      {selectedImage && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="relative rounded-xl overflow-hidden border border-border shadow-soft">
            <img 
              src={selectedImage} 
              alt="Math problem" 
              className="w-full h-auto max-h-72 object-contain bg-muted/30"
            />
          </div>

          <Button 
            onClick={handleSolve} 
            disabled={loading} 
            className="w-full h-12 text-base gap-2 gradient-primary hover:opacity-90 transition-opacity touch-target"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Solving...
              </>
            ) : (
              <>
                <Calculator className="h-5 w-5" />
                Solve (Shala + Balbharti + BYJU'S)
              </>
            )}
          </Button>
        </div>
      )}

      {solution && (
        <div className="animate-fade-in-up p-5 rounded-xl bg-card border border-border shadow-soft space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <BookOpen className="h-5 w-5" />
              Solution (Maharashtra Board Format)
            </div>
          </div>
          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {solution}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 w-full"
              onClick={() => {
                navigator.clipboard.writeText(solution);
                toast({ title: 'Copied!', description: 'Solution copied to clipboard' });
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 w-full"
              onClick={() => {
                const blob = new Blob([solution], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `math-solution-${Date.now()}.txt`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: 'Downloaded!', description: 'Solution saved as text file' });
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Text
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 w-full"
              onClick={() => {
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Math Solution</title><style>body{font-family:serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.8;white-space:pre-wrap;}</style></head><body>${solution.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`;
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `math-solution-${Date.now()}.html`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: 'Downloaded!', description: 'Open the HTML file and print as PDF' });
              }}
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}