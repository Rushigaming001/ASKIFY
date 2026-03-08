import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Image as ImageIcon, LogIn, Upload, Wand2, AlertCircle, Sparkles, Infinity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useUserRestrictions } from '@/hooks/useUserRestrictions';

export function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('default');
  const [imageModel, setImageModel] = useState('flux');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [autoDownload, setAutoDownload] = useState(true);
  
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { restrictions } = useUserRestrictions();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      let blobUrl: string;
      if (imageUrl.startsWith('data:')) {
        // Handle base64 data URLs directly
        const [header, base64] = imageUrl.split(',');
        const mime = header.match(/data:(.*?);/)?.[1] || 'image/png';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        blobUrl = URL.createObjectURL(blob);
      } else {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
      }
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(imageUrl, '_blank');
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: 'Error', description: 'Please enter a prompt', variant: 'destructive' });
      return;
    }
    if (!isLoggedIn) {
      toast({ title: 'Login Required', description: 'Please log in to generate images', variant: 'destructive' });
      navigate('/auth');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('image-ai', {
        body: { action: 'generate', prompt, style, imageModel }
      });
      if (error) throw error;
      setGeneratedImage(data.imageUrl);
      if (autoDownload) {
        downloadImage(data.imageUrl, `askify-generated-${Date.now()}.png`);
        toast({ title: '✨ Image Generated', description: 'Your image has been generated and downloaded!' });
      } else {
        toast({ title: '✨ Image Generated', description: 'Your image is ready!' });
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to generate image';
      toast({ title: 'Error', description: msg.includes('Unauthorized') ? 'Please log in' : msg, variant: 'destructive' });
      if (msg.includes('Unauthorized')) navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be under 10MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setUploadedImage(reader.result as string); setEditedImage(null); };
    reader.readAsDataURL(file);
  };

  const handleEditImage = async () => {
    if (!uploadedImage || !editPrompt.trim()) {
      toast({ title: 'Error', description: 'Upload an image and enter instructions', variant: 'destructive' });
      return;
    }
    if (!isLoggedIn) { navigate('/auth'); return; }

    setEditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('image-ai', {
        body: { action: 'edit', prompt: editPrompt, imageUrl: uploadedImage, imageModel: 'flux' }
      });
      if (error) throw error;
      setEditedImage(data.imageUrl);
      if (autoDownload) {
        downloadImage(data.imageUrl, `askify-edited-${Date.now()}.png`);
        toast({ title: '✨ Image Edited', description: 'Your edited image is ready!' });
      } else {
        toast({ title: '✨ Image Edited', description: 'Edit complete!' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error?.message || 'Failed to edit image', variant: 'destructive' });
    } finally {
      setEditLoading(false);
    }
  };

  if (restrictions.image_generation_disabled) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>You have been restricted from using image generation.</AlertDescription>
      </Alert>
    );
  }

  if (isLoggedIn === false) {
    return (
      <Card className="w-full border-border/50 shadow-lg">
        <CardContent className="py-12 text-center space-y-4">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">Log in to generate unlimited images</p>
          <Button onClick={() => navigate('/auth')} className="gap-2">
            <LogIn className="h-4 w-4" /> Log In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-border/50 shadow-lg bg-card/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              AI Image Studio
            </CardTitle>
            <CardDescription className="mt-1">Generate unlimited high-quality images instantly</CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1 px-3 py-1">
            <Infinity className="h-3.5 w-3.5" />
            Unlimited
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-5 h-10">
            <TabsTrigger value="generate" className="gap-1.5 text-sm font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Generate
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-1.5 text-sm font-medium">
              <Wand2 className="h-3.5 w-3.5" /> Edit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4 mt-0">
            <div className="space-y-2">
              <Label htmlFor="prompt" className="text-sm font-medium">Describe your image</Label>
              <Input
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A serene mountain landscape at golden hour..."
                disabled={loading}
                className="h-11"
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Model</Label>
                <Select value={imageModel} onValueChange={setImageModel} disabled={loading}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="flux">⚡ Flux (Best)</SelectItem>
                    <SelectItem value="flux-realism">📸 Flux Realism</SelectItem>
                    <SelectItem value="flux-cablyai">🎨 Flux CablyAI</SelectItem>
                    <SelectItem value="flux-anime">🌸 Flux Anime</SelectItem>
                    <SelectItem value="flux-3d">🧊 Flux 3D</SelectItem>
                    <SelectItem value="turbo">🚀 Turbo (Fast)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Style</Label>
                <Select value={style} onValueChange={setStyle} disabled={loading}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="ghibli">Studio Ghibli</SelectItem>
                    <SelectItem value="realistic">Photorealistic</SelectItem>
                    <SelectItem value="artistic">Artistic</SelectItem>
                    <SelectItem value="abstract">Abstract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full h-11 font-semibold text-sm">
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating (~10s)...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Generate Image</>
              )}
            </Button>

            {generatedImage && (
              <div className="space-y-3 animate-in fade-in duration-500">
                <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-md">
                  <img src={generatedImage} alt="Generated" className="w-full h-auto" />
                </div>
                <Button onClick={() => downloadImage(generatedImage, 'askify-image.png')} variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" /> Download HD Image
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="edit" className="space-y-4 mt-0">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Upload Image</Label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
              >
                {uploadedImage ? (
                  <img src={uploadedImage} alt="Uploaded" className="max-h-48 mx-auto rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8 opacity-50" />
                    <span className="text-sm font-medium">Click to upload</span>
                    <span className="text-xs opacity-60">PNG, JPG up to 10MB</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Edit Instructions</Label>
              <Input
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Make it look like a painting, add sunset colors..."
                disabled={editLoading}
                className="h-11"
              />
            </div>

            <Button onClick={handleEditImage} disabled={editLoading || !uploadedImage || !editPrompt.trim()} className="w-full h-11 font-semibold text-sm">
              {editLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Editing...</>
              ) : (
                <><Wand2 className="mr-2 h-4 w-4" /> Edit with AI</>
              )}
            </Button>

            {editedImage && (
              <div className="space-y-3 animate-in fade-in duration-500">
                <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-md">
                  <img src={editedImage} alt="Edited" className="w-full h-auto" />
                </div>
                <Button onClick={() => downloadImage(editedImage, 'askify-edited.png')} variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" /> Download Edited Image
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
