import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, Paperclip, Smile, Image, X, Loader2, Search, 
  File, FileText, FileVideo, FileAudio, FileArchive, Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface MentionProfile {
  id: string;
  name: string;
}

interface EnhancedChatInputProps {
  onSend: (content: string, fileUrl?: string, fileName?: string, fileType?: string) => void;
  onTyping?: () => void;
  placeholder?: string;
  disabled?: boolean;
  userId?: string;
  chatType?: 'public' | 'friends' | 'dm' | 'group';
  chatId?: string;
  maxFileSize?: number;
  mentionProfiles?: MentionProfile[];
}

const GIF_CATEGORIES = [
  'trending', 'reactions', 'happy', 'sad', 'love', 'laugh', 
  'excited', 'angry', 'dance', 'celebrate', 'thank you', 'hello'
];

const TENOR_API_KEY = 'AIzaSyDDAk-l5fBM4FhWnhLmLqF7mLwdMI2NnC8';
const MAX_MENTIONS_PER_MESSAGE = 5;

export function EnhancedChatInput({ 
  onSend, 
  onTyping,
  placeholder = "Type a message...", 
  disabled, 
  userId,
  chatType = 'public',
  chatId,
  maxFileSize = 200,
  mentionProfiles = []
}: EnhancedChatInputProps) {
  const [message, setMessage] = useState('');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<string[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  // Mention autocomplete state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Filtered mention suggestions
  const mentionSuggestions = (() => {
    const everyone = { id: 'everyone', name: 'everyone' };
    const filtered = mentionProfiles.filter(p =>
      p.name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      p.name.toLowerCase().replace(/\s+/g, '').includes(mentionSearch.toLowerCase())
    );
    const all = [everyone, ...filtered].filter(p =>
      p.name.toLowerCase().includes(mentionSearch.toLowerCase()) || mentionSearch === ''
    );
    return all.slice(0, 8);
  })();

  // Count existing mentions in message
  const currentMentionCount = (message.match(/@\w+/g) || []).length;

  const insertMention = (profile: MentionProfile | { id: string; name: string }) => {
    if (mentionStart === -1) return;
    
    // Check mention limit
    if (currentMentionCount >= MAX_MENTIONS_PER_MESSAGE) {
      toast({ title: 'Mention limit reached', description: `Maximum ${MAX_MENTIONS_PER_MESSAGE} mentions per message`, variant: 'destructive' });
      setShowMentions(false);
      return;
    }

    const cursorPos = inputRef.current?.selectionStart || message.length;
    const beforeMention = message.slice(0, mentionStart);
    const afterMention = message.slice(cursorPos);
    const mentionText = profile.id === 'everyone' 
      ? '@everyone ' 
      : `@${profile.name.replace(/\s+/g, '')} `;
    
    const newValue = beforeMention + mentionText + afterMention;
    setMessage(newValue);
    setShowMentions(false);
    setMentionStart(-1);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = beforeMention.length + mentionText.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.startsWith('video/')) return <FileVideo className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <FileAudio className="h-4 w-4" />;
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return <FileArchive className="h-4 w-4" />;
    if (type.includes('pdf') || type.includes('doc') || type.includes('text')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxBytes = maxFileSize * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({ title: 'File too large', description: `Maximum file size is ${maxFileSize}MB. Your file is ${formatFileSize(file.size)}`, variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const removeFile = () => {
    setFilePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (): Promise<{ url: string; name: string; type: string } | null> => {
    if (!selectedFile || !userId) return null;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const fileName = `${chatType}/${userId}/${timestamp}_${randomId}.${fileExt}`;
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 85));
      }, 100);
      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(fileName, selectedFile, { upsert: true, contentType: selectedFile.type });
      clearInterval(progressInterval);
      if (uploadError) throw uploadError;
      setUploadProgress(100);
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(fileName);
      await supabase.from('chat_files').insert({
        user_id: userId, file_name: selectedFile.name, file_type: selectedFile.type,
        file_size: selectedFile.size, file_url: publicUrl, chat_type: chatType, chat_id: chatId || null
      });
      return { url: publicUrl, name: selectedFile.name, type: selectedFile.type };
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Upload failed', description: error.message || 'Failed to upload file', variant: 'destructive' });
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSend = async () => {
    if ((!message.trim() && !selectedFile && !filePreview) || disabled || isUploading) return;
    let fileData: { url: string; name: string; type: string } | undefined;
    if (selectedFile) {
      const uploaded = await uploadFile();
      if (uploaded) fileData = uploaded;
    } else if (filePreview && filePreview.startsWith('http')) {
      fileData = { url: filePreview, name: 'gif', type: 'image/gif' };
    }
    onSend(message.trim(), fileData?.url, fileData?.name, fileData?.type);
    setMessage('');
    removeFile();
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const searchGifs = async (query: string) => {
    setLoadingGifs(true);
    try {
      const searchTerm = query || 'trending';
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(searchTerm)}&key=${TENOR_API_KEY}&limit=30&media_filter=gif,tinygif`
      );
      const data = await response.json();
      const gifUrls = data.results?.map((r: any) => 
        r.media_formats?.gif?.url || r.media_formats?.tinygif?.url
      ).filter(Boolean) || [];
      setGifs(gifUrls);
    } catch (error) {
      console.error('GIF search error:', error);
      setGifs([]);
    } finally {
      setLoadingGifs(false);
    }
  };

  const selectGif = (gifUrl: string) => {
    setFilePreview(gifUrl);
    setSelectedFile(null);
    setShowGifPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle mention navigation
    if (showMentions && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionSuggestions[selectedMentionIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setMessage(newValue);
    onTyping?.();

    // Check for @ mention trigger
    if (mentionProfiles.length > 0) {
      const textBeforeCursor = newValue.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');
      
      if (atIndex !== -1) {
        const textAfterAt = textBeforeCursor.slice(atIndex + 1);
        if (!textAfterAt.includes(' ')) {
          setMentionStart(atIndex);
          setMentionSearch(textAfterAt.toLowerCase());
          setShowMentions(true);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    setShowMentions(false);
    setMentionStart(-1);
  };

  // Close mentions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowMentions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="space-y-2">
      {isUploading && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-1" />
        </div>
      )}

      {(filePreview || selectedFile) && (
        <div className="relative inline-flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border">
          {filePreview ? (
            <img src={filePreview} alt="Preview" className="max-h-24 max-w-32 rounded object-contain" />
          ) : selectedFile && (
            <div className="flex items-center gap-2 px-2">
              {getFileIcon(selectedFile.type)}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
          )}
          <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full" onClick={removeFile}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="relative">
        {/* Mention Autocomplete Dropdown */}
        {showMentions && mentionSuggestions.length > 0 && (
          <div 
            ref={mentionRef}
            className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="p-1.5 border-b border-border/50">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-semibold px-2">
                Mention someone — {MAX_MENTIONS_PER_MESSAGE - currentMentionCount} left
              </p>
            </div>
            <ScrollArea className="max-h-48">
              <div className="p-1">
                {mentionSuggestions.map((profile, index) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      index === selectedMentionIndex 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => insertMention(profile)}
                    onMouseEnter={() => setSelectedMentionIndex(index)}
                  >
                    {profile.id === 'everyone' ? (
                      <>
                        <div className="h-7 w-7 rounded-full bg-warning/20 flex items-center justify-center">
                          <Users className="h-3.5 w-3.5 text-warning" />
                        </div>
                        <div>
                          <span className="font-semibold text-sm">@everyone</span>
                          <p className={`text-[10px] ${index === selectedMentionIndex ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            Notify all users
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-muted font-semibold">
                            {getInitials(profile.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">@{profile.name}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="*/*" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                <Paperclip className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1">
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => fileInputRef.current?.click()}>
                  <File className="h-4 w-4" />Upload File (200MB)
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => { setShowGifPicker(true); searchGifs('trending'); }}>
                  <Image className="h-4 w-4" />Send GIF
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Input
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isUploading}
            className="flex-1"
          />

          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" side="top">
              <EmojiPicker onEmojiClick={handleEmojiClick} />
            </PopoverContent>
          </Popover>

          <Button 
            onClick={handleSend}
            size="icon"
            disabled={(!message.trim() && !filePreview && !selectedFile) || disabled || isUploading}
            className="h-9 w-9 flex-shrink-0"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {showGifPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold">Search GIFs</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowGifPicker(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={gifSearch} onChange={(e) => setGifSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchGifs(gifSearch)} placeholder="Search for GIFs..." className="pl-9" />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {GIF_CATEGORIES.map(cat => (
                  <Button key={cat} variant="outline" size="sm" className="text-xs h-7" onClick={() => { setGifSearch(cat); searchGifs(cat); }}>{cat}</Button>
                ))}
              </div>
            </div>
            <ScrollArea className="flex-1 p-3">
              {loadingGifs ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : gifs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No GIFs found. Try searching!</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {gifs.map((gif, i) => (
                    <img key={i} src={gif} alt="GIF" className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity" onClick={() => selectGif(gif)} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
