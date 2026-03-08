import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, Play, ThumbsUp, ThumbsDown, Menu, Home, Flame, 
  Smartphone, Film, Music, Gamepad2, Newspaper, Trophy, Lightbulb, X, 
  Loader2, ArrowLeft, Bell, Cast, MoreVertical, Share, MessageSquare,
  ChevronUp, ChevronDown, User, Send, Mic, History, TrendingUp,
  Maximize, Minimize, Plus, Radio, Bookmark, Download, Flag, Scissors
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelId?: string;
  views: string;
  viewCount?: string;
  duration?: string;
  uploadedAt: string;
  description?: string;
  isShort?: boolean;
  isLive?: boolean;
  subscribers?: string;
}

interface Channel {
  id: string;
  title: string;
  thumbnail: string;
  subscribers: string;
  videoCount: string;
  description?: string;
  banner?: string;
}

interface Comment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  likes: string;
  time: string;
  replies?: Comment[];
}

const categories = [
  { id: 'all', label: 'All', icon: Home },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'minecraft', label: 'Minecraft', icon: Gamepad2 },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'trending', label: 'Trending', icon: Flame },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'sports', label: 'Sports', icon: Trophy },
  { id: 'learning', label: 'Learning', icon: Lightbulb },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'live', label: 'Live', icon: Radio },
];

const searchHistory = [
  'minecraft gameplay',
  'funny moments',
  'gaming facts',
  'best minecraft builds',
  'funny shorts compilation',
];

const mockComments: Comment[] = [
  { id: '1', author: 'Gaming Fan', avatar: '', text: 'This is amazing! Best video ever! 🔥', likes: '2.5K', time: '2 hours ago' },
  { id: '2', author: 'Minecraft Pro', avatar: '', text: 'Love your content, keep it up!', likes: '856', time: '5 hours ago' },
  { id: '3', author: 'Random User', avatar: '', text: 'Who else is watching in 2024? 😂', likes: '1.2K', time: '1 day ago' },
  { id: '4', author: 'Tech Guru', avatar: '', text: 'The editing on this video is incredible', likes: '432', time: '3 days ago' },
];

const YouTube = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'home' | 'shorts' | 'subscriptions' | 'you'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [shorts, setShorts] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  
  const [currentShortIndex, setCurrentShortIndex] = useState(0);
  const [showShortPlayer, setShowShortPlayer] = useState(false);
  const shortsContainerRef = useRef<HTMLDivElement>(null);
  
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelVideos, setChannelVideos] = useState<Video[]>([]);
  const [channelTab, setChannelTab] = useState<'home' | 'videos' | 'live' | 'playlists' | 'posts'>('videos');
  
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>(mockComments);
  
  const videoPlayerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTrendingVideos();
    fetchShorts();
  }, []);

  useEffect(() => {
    if (selectedCategory === 'minecraft') {
      searchVideos('minecraft gameplay');
    } else if (selectedCategory === 'gaming') {
      searchVideos('gaming');
    } else if (selectedCategory === 'live') {
      searchVideos('live stream gaming');
    } else if (selectedCategory !== 'all') {
      searchVideos(selectedCategory);
    } else {
      fetchTrendingVideos();
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loadingMore && !loading) {
        loadMoreVideos();
      }
    });
    
    if (lastVideoRef.current) {
      observerRef.current.observe(lastVideoRef.current);
    }
    
    return () => observerRef.current?.disconnect();
  }, [videos, loadingMore, loading]);

  const fetchTrendingVideos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'trending', maxResults: 50 }
      });
      if (error) throw error;
      if (data.success && data.data) {
        setVideos(data.data);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      toast({ title: 'Error', description: 'Failed to load videos.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchShorts = async (query: string = 'minecraft shorts funny facts') => {
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'search', query: query + ' shorts', maxResults: 50 }
      });
      if (error) throw error;
      if (data.success && data.data) {
        setShorts(data.data.map((v: Video) => ({ ...v, isShort: true })));
      }
    } catch (error) {
      console.error('Error fetching shorts:', error);
    }
  };

  const loadMoreVideos = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const query = searchResults.length > 0 ? searchQuery : 'trending gaming minecraft';
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'search', query, maxResults: 20 }
      });
      if (error) throw error;
      if (data.success && data.data) {
        if (searchResults.length > 0) {
          setSearchResults(prev => [...prev, ...data.data]);
        } else {
          setVideos(prev => [...prev, ...data.data]);
        }
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error loading more videos:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const searchVideos = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'search', query, maxResults: 50 }
      });
      if (error) throw error;
      if (data.success && data.data) {
        setSearchResults(data.data);
      }
    } catch (error) {
      console.error('Error searching videos:', error);
      toast({ title: 'Search Error', description: 'Failed to search videos.', variant: 'destructive' });
    } finally {
      setIsSearching(false);
      setShowSearch(false);
      setShowSearchHistory(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) await searchVideos(searchQuery);
  };

  const fetchChannel = async (channelId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'channel', query: channelId }
      });
      if (error) throw error;
      if (data.success && data.data && data.data[0]) {
        setSelectedChannel(data.data[0]);
        const videosData = await supabase.functions.invoke('youtube-api', {
          body: { action: 'search', query: data.data[0].title, maxResults: 20 }
        });
        if (videosData.data?.success) {
          setChannelVideos(videosData.data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching channel:', error);
    }
  };

  const playVideo = (video: Video) => {
    setSelectedVideo(video);
    setShowComments(false);
  };

  const playShort = (index: number) => {
    setCurrentShortIndex(index);
    setShowShortPlayer(true);
  };

  const handleShortScroll = useCallback((direction: 'up' | 'down') => {
    if (direction === 'down') {
      setCurrentShortIndex(prev => {
        const next = prev + 1;
        if (next >= shorts.length - 5) fetchShorts('gaming funny facts minecraft');
        return next < shorts.length ? next : prev;
      });
    } else {
      setCurrentShortIndex(prev => prev > 0 ? prev - 1 : 0);
    }
  }, [shorts.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoPlayerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const addComment = () => {
    if (!commentText.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      author: user?.email?.split('@')[0] || 'You',
      avatar: '',
      text: commentText,
      likes: '0',
      time: 'Just now'
    };
    setComments([newComment, ...comments]);
    setCommentText('');
  };

  const displayVideos = searchResults.length > 0 ? searchResults : videos;

  // ─── Search Screen ───
  if (showSearch) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-[#0f0f0f]">
        <div className="flex items-center gap-2 px-2 py-2.5 border-b border-border/30">
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(false)} className="text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Search YouTube"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearchHistory(true); }}
                className="w-full bg-muted/50 border-0 rounded-full pl-4 pr-4 h-10 text-sm focus-visible:ring-0"
                autoFocus
              />
            </div>
            <Button type="button" variant="ghost" size="icon" className="rounded-full flex-shrink-0">
              <Mic className="h-5 w-5" />
            </Button>
          </form>
        </div>
        
        {showSearchHistory && (
          <div className="flex-1">
            {searchHistory.map((item, index) => (
              <div 
                key={index}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 cursor-pointer active:bg-muted/80 transition-colors"
                onClick={() => { setSearchQuery(item); searchVideos(item); }}
              >
                <History className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 text-sm">{item}</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Channel Page ───
  if (selectedChannel) {
    return (
      <div className="flex flex-col h-screen bg-white dark:bg-[#0f0f0f]">
        <div className="flex items-center gap-1 px-1 py-2 border-b border-border/30">
          <Button variant="ghost" size="icon" onClick={() => setSelectedChannel(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon"><Cast className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="h-20 bg-gradient-to-r from-red-600/20 via-red-500/10 to-orange-500/10" />
          
          <div className="px-4 py-3">
            <div className="flex items-center gap-4">
              <Avatar className="h-18 w-18 ring-2 ring-border/20">
                <AvatarImage src={selectedChannel.thumbnail} />
                <AvatarFallback className="text-xl font-bold">{selectedChannel.title[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold flex items-center gap-1.5 truncate">
                  {selectedChannel.title}
                  <span className="text-muted-foreground text-xs">✓</span>
                </h1>
                <p className="text-xs text-muted-foreground">@{selectedChannel.title.toLowerCase().replace(/\s/g, '')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedChannel.subscribers} • {selectedChannel.videoCount} videos
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-3">
              <Button className="flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90 h-9 text-sm font-medium">
                Subscribe
              </Button>
              <Button variant="outline" className="rounded-full h-9 text-sm">
                <Bell className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex border-b border-border/30 overflow-x-auto">
            {['Home', 'Videos', 'Live', 'Playlists', 'Posts'].map((tab) => (
              <button
                key={tab}
                onClick={() => setChannelTab(tab.toLowerCase() as typeof channelTab)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  channelTab === tab.toLowerCase() 
                    ? 'border-foreground text-foreground' 
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2 p-3 overflow-x-auto">
            {['Latest', 'Popular', 'Oldest'].map((filter) => (
              <button key={filter} className="px-3 py-1.5 rounded-lg bg-muted/60 text-xs font-medium whitespace-nowrap hover:bg-muted transition-colors">
                {filter}
              </button>
            ))}
          </div>
          
          <div className="space-y-3 px-3 pb-20">
            {channelVideos.map((video) => (
              <div key={video.id} className="flex gap-3 cursor-pointer active:opacity-80" onClick={() => playVideo(video)}>
                <div className="relative w-[168px] aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  {video.duration && (
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-medium px-1 py-0.5 rounded">
                      {video.duration}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <h3 className="font-medium line-clamp-2 text-[13px] leading-[18px]">{video.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
                    {video.views} • {video.uploadedAt}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8 mt-0.5">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    );
  }

  // ─── Shorts Full Screen Player ───
  if (showShortPlayer && shorts[currentShortIndex]) {
    const currentShort = shorts[currentShortIndex];
    return (
      <div 
        className="fixed inset-0 bg-black z-50 flex flex-col"
        onTouchStart={(e) => {
          const startY = e.touches[0].clientY;
          const handleTouchEnd = (endE: TouchEvent) => {
            const endY = endE.changedTouches[0].clientY;
            const diff = startY - endY;
            if (Math.abs(diff) > 50) handleShortScroll(diff > 0 ? 'down' : 'up');
            document.removeEventListener('touchend', handleTouchEnd);
          };
          document.addEventListener('touchend', handleTouchEnd);
        }}
      >
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-gradient-to-b from-black/40 to-transparent">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setShowShortPlayer(false)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10"><Cast className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10"><Search className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10"><MoreVertical className="h-5 w-5" /></Button>
          </div>
        </div>
        
        <div className="flex-1 relative">
          <iframe
            src={`https://www.youtube.com/embed/${currentShort.id}?autoplay=1&loop=1&playlist=${currentShort.id}&controls=0`}
            title={currentShort.title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          
          <div className="absolute right-2 bottom-28 flex flex-col items-center gap-4">
            {[
              { icon: ThumbsUp, label: '42K' },
              { icon: ThumbsDown, label: 'Dislike' },
              { icon: MessageSquare, label: '498' },
              { icon: Share, label: 'Share' },
            ].map(({ icon: Icon, label }) => (
              <button key={label} className="flex flex-col items-center text-white drop-shadow-lg">
                <Icon className="h-7 w-7" />
                <span className="text-[10px] mt-1 font-medium">{label}</span>
              </button>
            ))}
            <div className="w-9 h-9 rounded-md overflow-hidden border-2 border-white mt-1">
              <img src={currentShort.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-14 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-9 w-9 border-2 border-white">
                <AvatarFallback className="text-xs">{currentShort.channel[0]}</AvatarFallback>
              </Avatar>
              <span className="text-white font-medium text-sm">@{currentShort.channel.replace(/\s/g, '')}</span>
              <button className="px-3 py-1 rounded-full bg-white text-black text-xs font-semibold ml-1">
                Subscribe
              </button>
            </div>
            <p className="text-white text-sm line-clamp-2 leading-tight">{currentShort.title}</p>
            <div className="flex items-center gap-2 mt-2">
              <Music className="h-3.5 w-3.5 text-white/80" />
              <span className="text-white/80 text-[11px]">Original sound</span>
            </div>
          </div>
        </div>
        
        <BottomNav activeTab="shorts" setActiveTab={(tab) => {
          if (tab !== 'shorts') { setShowShortPlayer(false); setActiveTab(tab); }
        }} dark />
      </div>
    );
  }

  // ─── Main Layout ───
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#0f0f0f]">
      {/* YouTube Header */}
      <header className="px-2 py-1.5 flex items-center gap-1 bg-white dark:bg-[#0f0f0f] sticky top-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-0.5">
          <div className="bg-[#FF0000] rounded-[4px] p-[3px] flex items-center justify-center">
            <Play className="h-3.5 w-3.5 text-white fill-white" />
          </div>
          <span className="text-[18px] font-bold tracking-tight ml-0.5">YouTube</span>
        </div>

        <div className="flex-1" />
        
        <Button variant="ghost" size="icon" className="h-10 w-10"><Cast className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon" className="h-10 w-10 relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 bg-[#FF0000] text-white text-[9px] font-bold rounded-full h-3.5 min-w-[14px] flex items-center justify-center px-0.5">9+</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setShowSearch(true)}>
          <Search className="h-5 w-5" />
        </Button>
      </header>

      {/* Category Chips */}
      <div className="px-2 py-1.5 overflow-x-auto flex-shrink-0 border-b border-border/20">
        <div className="flex gap-2 items-center">
          <button className="flex-shrink-0 p-2 rounded-lg hover:bg-muted/60 transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all flex-shrink-0 ${
                selectedCategory === cat.id 
                  ? 'bg-foreground text-background' 
                  : 'bg-muted/60 text-foreground hover:bg-muted'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'home' && (
          <div className="pb-20">
            {/* Shorts Row */}
            {shorts.length > 0 && (
              <div className="py-3">
                <div className="flex items-center gap-2 px-3 mb-2.5">
                  <div className="bg-[#FF0000] rounded-[3px] p-[2px]">
                    <Play className="h-3 w-3 text-white fill-white" />
                  </div>
                  <span className="font-bold text-sm">Shorts</span>
                </div>
                <div className="flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-hide">
                  {shorts.slice(0, 10).map((short, index) => (
                    <div 
                      key={short.id}
                      className="relative w-[120px] aspect-[9/16] rounded-xl overflow-hidden cursor-pointer flex-shrink-0 bg-muted active:scale-[0.98] transition-transform"
                      onClick={() => playShort(index)}
                    >
                      <img src={short.thumbnail} alt={short.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-1.5 left-1.5 right-1.5">
                        <p className="text-white text-[11px] font-medium line-clamp-2 leading-tight">{short.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Feed */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {displayVideos.map((video, index) => (
                  <div 
                    key={`${video.id}-${index}`}
                    ref={index === displayVideos.length - 1 ? lastVideoRef : null}
                    className="cursor-pointer active:opacity-90 transition-opacity"
                    onClick={() => playVideo(video)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video w-full bg-muted">
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${video.id}/640/360`;
                        }}
                      />
                      {video.duration && (
                        <span className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[11px] font-medium px-1 py-[1px] rounded-[3px]">
                          {video.duration}
                        </span>
                      )}
                      {video.isLive && (
                        <span className="absolute bottom-1.5 left-1.5 bg-[#FF0000] text-white text-[11px] font-semibold px-1.5 py-[1px] rounded-sm uppercase">
                          Live
                        </span>
                      )}
                    </div>
                    {/* Video Info */}
                    <div className="flex gap-3 px-3 py-2.5">
                      <Avatar 
                        className="h-9 w-9 flex-shrink-0 mt-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (video.channelId) fetchChannel(video.channelId);
                        }}
                      >
                        <AvatarFallback className="text-xs bg-muted">{video.channel[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-medium leading-[20px] line-clamp-2">{video.title}</h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight">
                          <span 
                            className="hover:text-foreground cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); if (video.channelId) fetchChannel(video.channelId); }}
                          >
                            {video.channel}
                          </span>
                          {' · '}{video.views}{' · '}{video.uploadedAt}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8 -mr-2" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {loadingMore && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'shorts' && (
          <div className="grid grid-cols-2 gap-1 p-1 pb-20">
            {shorts.map((short, index) => (
              <div 
                key={short.id}
                className="relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer bg-muted active:scale-[0.98] transition-transform"
                onClick={() => playShort(index)}
              >
                <img src={short.thumbnail} alt={short.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white text-[13px] font-medium line-clamp-2 leading-tight drop-shadow">{short.title}</p>
                  <p className="text-white/70 text-[11px] mt-0.5">{short.channel}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <Bell className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-bold mb-1.5">Don't miss new videos</h2>
            <p className="text-sm text-muted-foreground mb-5">Sign in to see updates from your favorite YouTube channels</p>
            <Button 
              className="rounded-full px-6 bg-[#065fd4] hover:bg-[#065fd4]/90 text-white font-medium"
              onClick={() => navigate('/auth')}
            >
              Sign in
            </Button>
          </div>
        )}

        {activeTab === 'you' && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <User className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-bold mb-1.5">Enjoy your favorite videos</h2>
            <p className="text-sm text-muted-foreground mb-5">Sign in to access videos that you've liked or saved</p>
            <Button 
              className="rounded-full px-6 bg-[#065fd4] hover:bg-[#065fd4]/90 text-white font-medium"
              onClick={() => navigate('/auth')}
            >
              Sign in
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl w-full h-[100dvh] sm:h-[90vh] p-0 flex flex-col gap-0 border-0 sm:border sm:rounded-xl rounded-none">
          {/* Player */}
          <div ref={videoPlayerRef} className={`relative bg-black ${isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video flex-shrink-0'}`}>
            {selectedVideo && (
              <>
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1`}
                  title={selectedVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <Button variant="ghost" size="icon" className="absolute top-2 left-2 text-white hover:bg-white/20 h-8 w-8" onClick={() => setSelectedVideo(null)}>
                  <ChevronDown className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-white hover:bg-white/20 h-8 w-8" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </>
            )}
          </div>
          
          {/* Video Details */}
          <ScrollArea className="flex-1 bg-white dark:bg-[#0f0f0f]">
            <div className="p-3">
              <h2 className="text-[15px] font-semibold leading-tight">{selectedVideo?.title}</h2>
              <p className="text-[12px] text-muted-foreground mt-1.5">
                {selectedVideo?.views} · {selectedVideo?.uploadedAt}
              </p>
              
              {/* Action Bar */}
              <div className="flex items-center justify-between mt-3 -mx-1">
                {[
                  { icon: ThumbsUp, label: 'Like' },
                  { icon: ThumbsDown, label: 'Dislike' },
                  { icon: Share, label: 'Share' },
                  { icon: Download, label: 'Download' },
                  { icon: Bookmark, label: 'Save' },
                  { icon: Flag, label: 'Report' },
                ].map(({ icon: Icon, label }) => (
                  <button key={label} className="flex flex-col items-center p-2 rounded-lg hover:bg-muted/60 transition-colors">
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] mt-1 text-muted-foreground">{label}</span>
                  </button>
                ))}
              </div>
              
              {/* Channel Info */}
              <div className="flex items-center gap-3 mt-3 py-3 border-t border-border/30">
                <Avatar 
                  className="h-10 w-10 cursor-pointer"
                  onClick={() => selectedVideo?.channelId && fetchChannel(selectedVideo.channelId)}
                >
                  <AvatarFallback className="text-sm bg-muted">{selectedVideo?.channel[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm cursor-pointer hover:underline truncate" onClick={() => selectedVideo?.channelId && fetchChannel(selectedVideo.channelId)}>
                    {selectedVideo?.channel}
                  </p>
                  <p className="text-[11px] text-muted-foreground">1.2M subscribers</p>
                </div>
                <button className="px-4 py-1.5 rounded-full bg-[#FF0000] text-white text-sm font-semibold hover:bg-[#cc0000] transition-colors">
                  Subscribe
                </button>
              </div>
              
              {/* Description */}
              {selectedVideo?.description && (
                <div className="mt-3 p-3 bg-muted/40 rounded-xl">
                  <p className="text-[13px] line-clamp-3 leading-relaxed">{selectedVideo.description}</p>
                  <button className="text-[13px] text-muted-foreground font-medium mt-1.5">Show more</button>
                </div>
              )}
              
              {/* Comments */}
              <div className="mt-4">
                <button 
                  className="flex items-center justify-between w-full py-2"
                  onClick={() => setShowComments(!showComments)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">Comments</span>
                    <span className="text-[12px] text-muted-foreground">{comments.length}</span>
                  </div>
                  {showComments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                {showComments && (
                  <div className="mt-2 space-y-4">
                    <div className="flex gap-2.5">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs">{user?.email?.[0].toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex gap-2">
                        <Textarea 
                          placeholder="Add a comment..." 
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          className="min-h-[36px] text-sm resize-none border-0 border-b border-border/50 rounded-none focus-visible:ring-0 px-0"
                        />
                        <Button size="icon" variant="ghost" onClick={addComment} disabled={!commentText.trim()} className="flex-shrink-0 h-8 w-8">
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-2.5">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="text-[10px]">{comment.author[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[12px]">{comment.author}</span>
                            <span className="text-[10px] text-muted-foreground">{comment.time}</span>
                          </div>
                          <p className="text-[13px] mt-0.5 leading-snug">{comment.text}</p>
                          <div className="flex items-center gap-4 mt-1.5">
                            <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                              <ThumbsUp className="h-3.5 w-3.5" />
                              {comment.likes}
                            </button>
                            <button className="text-[11px] text-muted-foreground hover:text-foreground">
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </button>
                            <button className="text-[11px] text-muted-foreground hover:text-foreground font-medium">Reply</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Bottom Navigation ───
const BottomNav = ({ 
  activeTab, 
  setActiveTab,
  dark = false
}: { 
  activeTab: string; 
  setActiveTab: (tab: 'home' | 'shorts' | 'subscriptions' | 'you') => void;
  dark?: boolean;
}) => (
  <nav className={`flex items-center justify-around py-1 border-t safe-area-bottom ${
    dark ? 'bg-black border-white/10' : 'bg-white dark:bg-[#0f0f0f] border-border/30'
  }`}>
    {[
      { id: 'home' as const, icon: Home, label: 'Home', filled: true },
      { id: 'shorts' as const, icon: Smartphone, label: 'Shorts' },
      { id: null, icon: Plus, label: '', isCreate: true },
      { id: 'subscriptions' as const, icon: Film, label: 'Subscriptions', hasDot: true },
      { id: 'you' as const, icon: User, label: 'You' },
    ].map((item, i) => {
      if (item.isCreate) {
        return (
          <button key={i} className="flex flex-col items-center py-1.5 px-3">
            <div className={`rounded-full p-1 ${dark ? 'bg-white/15' : 'bg-muted'}`}>
              <Plus className={`h-6 w-6 ${dark ? 'text-white' : 'text-foreground'}`} />
            </div>
          </button>
        );
      }
      
      const isActive = activeTab === item.id;
      const Icon = item.icon;
      
      return (
        <button 
          key={i}
          className={`flex flex-col items-center py-1.5 px-2 min-w-[48px] relative transition-colors ${
            isActive 
              ? (dark ? 'text-white' : 'text-foreground') 
              : (dark ? 'text-white/50' : 'text-muted-foreground')
          }`}
          onClick={() => item.id && setActiveTab(item.id)}
        >
          <Icon className={`h-5 w-5 ${isActive && item.filled ? 'fill-current' : ''}`} />
          {item.hasDot && (
            <span className="absolute top-0.5 right-1 bg-[#FF0000] rounded-full h-1.5 w-1.5" />
          )}
          <span className="text-[10px] mt-0.5 font-medium">{item.label}</span>
        </button>
      );
    })}
  </nav>
);

export default YouTube;
