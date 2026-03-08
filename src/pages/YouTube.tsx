import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { 
  Search, Play, Clock, ThumbsUp, ThumbsDown, Eye, Menu, Home, Flame, 
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
  
  // UI State
  const [activeTab, setActiveTab] = useState<'home' | 'shorts' | 'subscriptions' | 'you'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  
  // Video State
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [shorts, setShorts] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [page, setPage] = useState(1);
  
  // Shorts State
  const [currentShortIndex, setCurrentShortIndex] = useState(0);
  const [showShortPlayer, setShowShortPlayer] = useState(false);
  const shortsContainerRef = useRef<HTMLDivElement>(null);
  
  // Channel State
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [channelVideos, setChannelVideos] = useState<Video[]>([]);
  const [channelTab, setChannelTab] = useState<'home' | 'videos' | 'live' | 'playlists' | 'posts'>('videos');
  
  // Comments
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Comment[]>(mockComments);
  
  // Refs
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

  // Infinite scroll
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
      toast({
        title: 'Error',
        description: 'Failed to load videos. Please try again.',
        variant: 'destructive'
      });
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
      toast({
        title: 'Search Error',
        description: 'Failed to search videos.',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
      setShowSearch(false);
      setShowSearchHistory(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      await searchVideos(searchQuery);
    }
  };

  const fetchChannel = async (channelId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'channel', query: channelId }
      });

      if (error) throw error;
      if (data.success && data.data && data.data[0]) {
        setSelectedChannel(data.data[0]);
        // Fetch channel videos
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
        if (next >= shorts.length - 5) {
          fetchShorts('gaming funny facts minecraft');
        }
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

  // Search Screen
  if (showSearch) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(false)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <Input
              type="text"
              placeholder="Search YouTube"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchHistory(true);
              }}
              className="flex-1 bg-secondary/50 border-0 rounded-full"
              autoFocus
            />
            <Button type="button" variant="ghost" size="icon" className="rounded-full">
              <Mic className="h-5 w-5" />
            </Button>
          </form>
        </div>
        
        {showSearchHistory && (
          <div className="flex-1 bg-background">
            {searchHistory.map((item, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer"
                onClick={() => {
                  setSearchQuery(item);
                  searchVideos(item);
                }}
              >
                <History className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1">{item}</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Channel Page
  if (selectedChannel) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setSelectedChannel(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Cast className="h-5 w-5" />
          <div className="flex-1" />
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          {/* Channel Banner */}
          <div className="h-24 bg-gradient-to-r from-primary/30 to-secondary/30" />
          
          {/* Channel Info */}
          <div className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={selectedChannel.thumbnail} />
                <AvatarFallback>{selectedChannel.title[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  {selectedChannel.title}
                  <Badge variant="secondary" className="text-xs">✓</Badge>
                </h1>
                <p className="text-sm text-muted-foreground">@{selectedChannel.title.toLowerCase().replace(/\s/g, '')}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedChannel.subscribers} • {selectedChannel.videoCount} videos
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button className="flex-1 rounded-full bg-foreground text-background hover:bg-foreground/90">
                <Bell className="h-4 w-4 mr-2" />
                Subscribed
              </Button>
              <Button variant="secondary" className="rounded-full">
                Join
              </Button>
            </div>
          </div>
          
          {/* Channel Tabs */}
          <div className="flex border-b border-border overflow-x-auto">
            {['Home', 'Videos', 'Live', 'Playlists', 'Posts'].map((tab) => (
              <button
                key={tab}
                onClick={() => setChannelTab(tab.toLowerCase() as any)}
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
          
          {/* Filter Tabs */}
          <div className="flex gap-2 p-3 overflow-x-auto">
            {['Latest', 'Popular', 'Oldest'].map((filter) => (
              <Button key={filter} variant="secondary" size="sm" className="rounded-full">
                {filter}
              </Button>
            ))}
          </div>
          
          {/* Channel Videos */}
          <div className="space-y-4 p-4">
            {channelVideos.map((video) => (
              <div 
                key={video.id}
                className="flex gap-3 cursor-pointer"
                onClick={() => playVideo(video)}
              >
                <div className="relative w-40 aspect-video rounded-lg overflow-hidden flex-shrink-0">
                  <img 
                    src={video.thumbnail} 
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  {video.duration && (
                    <Badge className="absolute bottom-1 right-1 bg-black/80 text-white text-xs">
                      {video.duration}
                    </Badge>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium line-clamp-2 text-sm">{video.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {video.views} • {video.uploadedAt}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="flex-shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* Bottom Navigation */}
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    );
  }

  // Shorts Full Screen Player
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
            if (Math.abs(diff) > 50) {
              handleShortScroll(diff > 0 ? 'down' : 'up');
            }
            document.removeEventListener('touchend', handleTouchEnd);
          };
          document.addEventListener('touchend', handleTouchEnd);
        }}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3">
          <Button variant="ghost" size="icon" className="text-white" onClick={() => setShowShortPlayer(false)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="text-white">
              <Cast className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Video */}
        <div className="flex-1 relative">
          <iframe
            src={`https://www.youtube.com/embed/${currentShort.id}?autoplay=1&loop=1&playlist=${currentShort.id}&controls=0`}
            title={currentShort.title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          
          {/* Right Side Actions */}
          <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
            <button className="flex flex-col items-center text-white">
              <ThumbsUp className="h-7 w-7" />
              <span className="text-xs mt-1">42K</span>
            </button>
            <button className="flex flex-col items-center text-white">
              <ThumbsDown className="h-7 w-7" />
              <span className="text-xs mt-1">Dislike</span>
            </button>
            <button className="flex flex-col items-center text-white">
              <MessageSquare className="h-7 w-7" />
              <span className="text-xs mt-1">498</span>
            </button>
            <button className="flex flex-col items-center text-white">
              <Share className="h-7 w-7" />
              <span className="text-xs mt-1">Share</span>
            </button>
            <button className="flex flex-col items-center text-white">
              <Plus className="h-7 w-7 border-2 rounded" />
              <span className="text-xs mt-1">617K</span>
            </button>
            <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white mt-2">
              <img src={currentShort.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          
          {/* Bottom Info */}
          <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-10 w-10 border-2 border-white">
                <AvatarFallback>{currentShort.channel[0]}</AvatarFallback>
              </Avatar>
              <span className="text-white font-medium">@{currentShort.channel.replace(/\s/g, '')}</span>
              <Button variant="secondary" size="sm" className="rounded-full ml-2 h-7">
                Subscribe
              </Button>
            </div>
            <p className="text-white text-sm line-clamp-2">{currentShort.title}</p>
            <div className="flex items-center gap-2 mt-2">
              <Music className="h-4 w-4 text-white" />
              <span className="text-white text-xs">Original sound</span>
            </div>
          </div>
          
          {/* Scroll Indicators */}
          <div className="absolute left-1/2 -translate-x-1/2 top-4">
            <ChevronUp className="h-8 w-8 text-white/50 animate-bounce" onClick={() => handleShortScroll('up')} />
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-28">
            <ChevronDown className="h-8 w-8 text-white/50 animate-bounce" onClick={() => handleShortScroll('down')} />
          </div>
        </div>
        
        {/* Bottom Navigation */}
        <BottomNav activeTab="shorts" setActiveTab={(tab) => {
          if (tab !== 'shorts') {
            setShowShortPlayer(false);
            setActiveTab(tab);
          }
        }} dark />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-3 py-2 flex items-center gap-2 bg-background sticky top-0 z-40">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-1">
          <div className="bg-red-600 p-1 rounded-lg">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
          <span className="text-lg font-bold">YouTube</span>
        </div>

        <div className="flex-1" />
        
        <Button variant="ghost" size="icon">
          <Cast className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">9+</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
          <Search className="h-5 w-5" />
        </Button>
      </header>

      {/* Category Tabs */}
      <div className="border-b border-border px-2 py-2 overflow-x-auto flex-shrink-0">
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="flex-shrink-0 rounded-full">
            <Menu className="h-5 w-5" />
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'secondary'}
              size="sm"
              className={`whitespace-nowrap rounded-full ${selectedCategory === cat.id ? 'bg-foreground text-background' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'home' && (
          <div className="pb-20">
            {/* Shorts Section */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-red-600 p-1 rounded">
                  <Play className="h-4 w-4 text-white fill-white" />
                </div>
                <span className="font-bold">Shorts</span>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {shorts.slice(0, 10).map((short, index) => (
                  <div 
                    key={short.id}
                    className="relative w-32 aspect-[9/16] rounded-xl overflow-hidden cursor-pointer flex-shrink-0"
                    onClick={() => playShort(index)}
                  >
                    <img 
                      src={short.thumbnail}
                      alt={short.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-xs font-medium line-clamp-2">{short.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Videos Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4 px-4 max-w-2xl mx-auto">
                {displayVideos.map((video, index) => (
                  <div 
                    key={`${video.id}-${index}`}
                    ref={index === displayVideos.length - 1 ? lastVideoRef : null}
                    className="cursor-pointer"
                    onClick={() => playVideo(video)}
                  >
                    <div className="relative aspect-video rounded-xl overflow-hidden">
                      <img 
                        src={video.thumbnail} 
                        alt={video.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${video.id}/640/360`;
                        }}
                      />
                      {video.duration && (
                        <Badge className="absolute bottom-2 right-2 bg-black/80 text-white">
                          {video.duration}
                        </Badge>
                      )}
                      {video.isLive && (
                        <Badge className="absolute bottom-2 left-2 bg-red-600 text-white">
                          LIVE
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3 mt-3">
                      <Avatar 
                        className="h-10 w-10 cursor-pointer flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (video.channelId) fetchChannel(video.channelId);
                        }}
                      >
                        <AvatarFallback>{video.channel[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium line-clamp-2 text-sm">{video.title}</h3>
                        <p 
                          className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (video.channelId) fetchChannel(video.channelId);
                          }}
                        >
                          {video.channel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {video.views} • {video.uploadedAt}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                {loadingMore && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'shorts' && (
          <div className="grid grid-cols-2 gap-2 p-2 pb-20">
            {shorts.map((short, index) => (
              <div 
                key={short.id}
                className="relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer"
                onClick={() => playShort(index)}
              >
                <img 
                  src={short.thumbnail}
                  alt={short.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white text-sm font-medium line-clamp-2">{short.title}</p>
                  <p className="text-white/70 text-xs mt-1">{short.channel}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Bell className="h-20 w-20 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Don't miss new videos</h2>
            <p className="text-muted-foreground mb-4">Sign in to see updates from your favorite YouTube channels</p>
            <Button 
              variant="outline" 
              className="text-blue-500 border-blue-500"
              onClick={() => navigate('/auth')}
            >
              Sign in
            </Button>
          </div>
        )}

        {activeTab === 'you' && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <User className="h-20 w-20 text-muted-foreground mb-4" />
            <h2 className="text-xl font-bold mb-2">Enjoy your favorite videos</h2>
            <p className="text-muted-foreground mb-4">Sign in to access videos that you've liked or saved</p>
            <Button 
              variant="outline" 
              className="text-blue-500 border-blue-500"
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
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 flex flex-col">
          <div ref={videoPlayerRef} className={`relative bg-black ${isFullscreen ? 'fixed inset-0 z-50' : 'aspect-video'}`}>
            {selectedVideo && (
              <>
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1`}
                  title={selectedVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 left-2 text-white hover:bg-white/20"
                  onClick={() => setSelectedVideo(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 text-white hover:bg-white/20"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </Button>
              </>
            )}
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-4">
              <h2 className="text-lg font-bold">{selectedVideo?.title}</h2>
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <span>{selectedVideo?.views}</span>
                <span>•</span>
                <span>{selectedVideo?.uploadedAt}</span>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-4 mt-4 overflow-x-auto pb-2">
                <button className="flex flex-col items-center">
                  <ThumbsUp className="h-6 w-6" />
                  <span className="text-xs mt-1">Like</span>
                </button>
                <button className="flex flex-col items-center">
                  <ThumbsDown className="h-6 w-6" />
                  <span className="text-xs mt-1">Dislike</span>
                </button>
                <button className="flex flex-col items-center">
                  <Share className="h-6 w-6" />
                  <span className="text-xs mt-1">Share</span>
                </button>
                <button className="flex flex-col items-center">
                  <Download className="h-6 w-6" />
                  <span className="text-xs mt-1">Download</span>
                </button>
                <button className="flex flex-col items-center">
                  <Bookmark className="h-6 w-6" />
                  <span className="text-xs mt-1">Save</span>
                </button>
                <button className="flex flex-col items-center">
                  <Scissors className="h-6 w-6" />
                  <span className="text-xs mt-1">Clip</span>
                </button>
                <button className="flex flex-col items-center">
                  <Flag className="h-6 w-6" />
                  <span className="text-xs mt-1">Report</span>
                </button>
              </div>
              
              {/* Channel Info */}
              <div className="flex items-center gap-3 mt-4 py-3 border-t border-b border-border">
                <Avatar 
                  className="h-12 w-12 cursor-pointer"
                  onClick={() => selectedVideo?.channelId && fetchChannel(selectedVideo.channelId)}
                >
                  <AvatarFallback>{selectedVideo?.channel[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p 
                    className="font-medium cursor-pointer hover:underline"
                    onClick={() => selectedVideo?.channelId && fetchChannel(selectedVideo.channelId)}
                  >
                    {selectedVideo?.channel}
                  </p>
                  <p className="text-xs text-muted-foreground">1.2M subscribers</p>
                </div>
                <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90">
                  Subscribe
                </Button>
              </div>
              
              {/* Description */}
              {selectedVideo?.description && (
                <div className="mt-4 p-3 bg-secondary/50 rounded-lg">
                  <p className="text-sm line-clamp-3">{selectedVideo.description}</p>
                  <button className="text-sm text-primary mt-2">Show more</button>
                </div>
              )}
              
              {/* Comments Section */}
              <div className="mt-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setShowComments(!showComments)}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-medium">Comments</span>
                    <span className="text-muted-foreground">{comments.length}</span>
                  </div>
                  {showComments ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
                
                {showComments && (
                  <div className="mt-4 space-y-4">
                    {/* Add Comment */}
                    <div className="flex gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{user?.email?.[0].toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex gap-2">
                        <Textarea 
                          placeholder="Add a comment..." 
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          className="min-h-[40px] resize-none"
                        />
                        <Button size="icon" onClick={addComment} disabled={!commentText.trim()}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Comments List */}
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>{comment.author[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{comment.author}</span>
                            <span className="text-xs text-muted-foreground">{comment.time}</span>
                          </div>
                          <p className="text-sm mt-1">{comment.text}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <button className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ThumbsUp className="h-4 w-4" />
                              {comment.likes}
                            </button>
                            <button className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ThumbsDown className="h-4 w-4" />
                            </button>
                            <button className="text-xs text-muted-foreground">Reply</button>
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

// Bottom Navigation Component
const BottomNav = ({ 
  activeTab, 
  setActiveTab,
  dark = false
}: { 
  activeTab: string; 
  setActiveTab: (tab: 'home' | 'shorts' | 'subscriptions' | 'you') => void;
  dark?: boolean;
}) => (
  <nav className={`flex items-center justify-around py-2 border-t ${dark ? 'bg-black border-white/10' : 'bg-background border-border'}`}>
    <button 
      className={`flex flex-col items-center p-2 ${activeTab === 'home' ? (dark ? 'text-white' : 'text-foreground') : (dark ? 'text-white/60' : 'text-muted-foreground')}`}
      onClick={() => setActiveTab('home')}
    >
      <Home className={`h-6 w-6 ${activeTab === 'home' ? 'fill-current' : ''}`} />
      <span className="text-xs mt-1">Home</span>
    </button>
    <button 
      className={`flex flex-col items-center p-2 ${activeTab === 'shorts' ? (dark ? 'text-white' : 'text-foreground') : (dark ? 'text-white/60' : 'text-muted-foreground')}`}
      onClick={() => setActiveTab('shorts')}
    >
      <Smartphone className="h-6 w-6" />
      <span className="text-xs mt-1">Shorts</span>
    </button>
    <button className={`flex flex-col items-center p-2 ${dark ? 'text-white/60' : 'text-muted-foreground'}`}>
      <div className={`p-2 rounded-full ${dark ? 'bg-white/20' : 'bg-secondary'}`}>
        <Plus className="h-6 w-6" />
      </div>
    </button>
    <button 
      className={`flex flex-col items-center p-2 relative ${activeTab === 'subscriptions' ? (dark ? 'text-white' : 'text-foreground') : (dark ? 'text-white/60' : 'text-muted-foreground')}`}
      onClick={() => setActiveTab('subscriptions')}
    >
      <Film className="h-6 w-6" />
      <span className="absolute -top-1 right-0 bg-red-600 rounded-full h-2 w-2" />
      <span className="text-xs mt-1">Subscriptions</span>
    </button>
    <button 
      className={`flex flex-col items-center p-2 ${activeTab === 'you' ? (dark ? 'text-white' : 'text-foreground') : (dark ? 'text-white/60' : 'text-muted-foreground')}`}
      onClick={() => setActiveTab('you')}
    >
      <User className="h-6 w-6" />
      <span className="text-xs mt-1">You</span>
    </button>
  </nav>
);

export default YouTube;
