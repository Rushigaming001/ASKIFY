import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { 
  Play, Pause, SkipForward, SkipBack, Repeat, Repeat1, 
  Volume2, VolumeX, ListMusic, X, Music, Loader2, Search,
  Shuffle, Plus, GripVertical, ChevronUp, ChevronDown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Track {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  channelTitle: string;
  videoId: string;
}

interface MusicBotPanelProps {
  isVisible: boolean;
  onClose: () => void;
  channelId?: string;
}

export function MusicBotPanel({ isVisible, onClose, channelId }: MusicBotPanelProps) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [loopMode, setLoopMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffled, setIsShuffled] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const ytPlayerRef = useRef<any>(null);
  const { toast } = useToast();

  // Initialize YouTube player
  useEffect(() => {
    if (!isVisible) return;

    const loadYouTubeAPI = () => {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
    };

    loadYouTubeAPI();

    (window as any).onYouTubeIframeAPIReady = () => {
      if (currentTrack) {
        initPlayer(currentTrack.videoId);
      }
    };

    return () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  }, [isVisible]);

  // Load track when changed
  useEffect(() => {
    if (currentTrack && window.YT && window.YT.Player) {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.loadVideoById(currentTrack.videoId);
        setIsPlaying(true);
      } else {
        initPlayer(currentTrack.videoId);
      }
    }
  }, [currentTrack]);

  // Update time periodically
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && ytPlayerRef.current) {
      interval = setInterval(() => {
        if (ytPlayerRef.current?.getCurrentTime) {
          setCurrentTime(ytPlayerRef.current.getCurrentTime() || 0);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const initPlayer = (videoId: string) => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy();
    }

    ytPlayerRef.current = new window.YT.Player('music-bot-player', {
      height: '0',
      width: '0',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(volume);
          setDuration(event.target.getDuration());
          setIsPlaying(true);
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            handleTrackEnd();
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          }
        }
      }
    });
  };

  const handleTrackEnd = () => {
    if (loopMode === 'one') {
      ytPlayerRef.current?.seekTo(0);
      ytPlayerRef.current?.playVideo();
    } else if (queue.length > 0) {
      playNext();
    } else if (loopMode === 'all' && currentTrack) {
      ytPlayerRef.current?.seekTo(0);
      ytPlayerRef.current?.playVideo();
    } else {
      setIsPlaying(false);
    }
  };

  const searchMusic = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('youtube-api', {
        body: { action: 'search', query: `${searchQuery} music audio`, maxResults: 10 }
      });

      if (error || !data?.success) throw new Error('Search failed');

      const tracks: Track[] = data.data.map((video: any) => ({
        id: video.id,
        title: video.title,
        thumbnail: video.thumbnail,
        duration: video.duration || '0:00',
        channelTitle: video.channelTitle,
        videoId: video.id
      }));

      setSearchResults(tracks);
    } catch (err) {
      toast({ title: 'Search failed', description: 'Could not search for music', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const addToQueue = (track: Track) => {
    if (!currentTrack) {
      setCurrentTrack(track);
    } else {
      setQueue(prev => [...prev, track]);
      toast({ title: 'Added to queue', description: track.title });
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  const playNow = (track: Track) => {
    if (currentTrack) {
      setQueue(prev => [currentTrack, ...prev]);
    }
    setCurrentTrack(track);
    setSearchResults([]);
    setSearchQuery('');
  };

  const togglePlay = () => {
    if (ytPlayerRef.current) {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
      } else {
        ytPlayerRef.current.playVideo();
      }
    }
  };

  const playNext = () => {
    if (queue.length > 0) {
      const nextIndex = isShuffled ? Math.floor(Math.random() * queue.length) : 0;
      const nextTrack = queue[nextIndex];
      setQueue(prev => prev.filter((_, i) => i !== nextIndex));
      setCurrentTrack(nextTrack);
    }
  };

  const playPrevious = () => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(0);
    }
  };

  const handleSeek = (value: number[]) => {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(value[0]);
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (ytPlayerRef.current) {
      ytPlayerRef.current.setVolume(newVolume);
    }
    if (newVolume > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (ytPlayerRef.current) {
      if (isMuted) {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(volume);
      } else {
        ytPlayerRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  const toggleLoop = () => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(loopMode);
    setLoopMode(modes[(currentIndex + 1) % 3]);
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const moveInQueue = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= queue.length) return;
    
    setQueue(prev => {
      const newQueue = [...prev];
      [newQueue[index], newQueue[newIndex]] = [newQueue[newIndex], newQueue[index]];
      return newQueue;
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <Card className={`fixed bottom-4 right-4 bg-background/95 backdrop-blur border shadow-2xl z-50 animate-fade-in transition-all duration-300 ${isMinimized ? 'w-80' : 'w-96'}`}>
      {/* Hidden YouTube Player */}
      <div id="music-bot-player" className="hidden" />

      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Music className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="font-semibold text-sm">Music Bot</span>
            <span className="text-xs text-muted-foreground ml-2">
              {queue.length > 0 ? `${queue.length} in queue` : 'No queue'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchMusic()}
                placeholder="Search for music..."
                className="pl-9 h-9"
              />
            </div>
            <Button size="sm" onClick={searchMusic} disabled={isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <ScrollArea className="h-40 border rounded-lg">
              <div className="p-2 space-y-1">
                {searchResults.map((track) => (
                  <div 
                    key={track.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 group"
                  >
                    <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{track.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.channelTitle}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => playNow(track)}>
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => addToQueue(track)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Now Playing */}
          {currentTrack ? (
            <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
              <img src={currentTrack.thumbnail} alt="" className="w-14 h-14 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{currentTrack.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentTrack.channelTitle}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Music className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No track playing</p>
              <p className="text-xs">Search for music or use /play in chat</p>
            </div>
          )}

          {/* Progress */}
          <div className="space-y-1">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant={isShuffled ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsShuffled(!isShuffled)}
            >
              <Shuffle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={playPrevious}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={togglePlay}
              disabled={!currentTrack}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={playNext} disabled={queue.length === 0}>
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button
              variant={loopMode !== 'off' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={toggleLoop}
            >
              {loopMode === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="flex-1"
            />
          </div>

          {/* Queue */}
          {queue.length > 0 && showQueue && (
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <ListMusic className="h-4 w-4" />
                  Queue ({queue.length})
                </span>
              </div>
              <ScrollArea className="h-32">
                <div className="space-y-1">
                  {queue.map((track, index) => (
                    <div 
                      key={`${track.videoId}-${index}`}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 group"
                    >
                      <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                      <img src={track.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate">{track.title}</p>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveInQueue(index, 'up')} disabled={index === 0}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveInQueue(index, 'down')} disabled={index === queue.length - 1}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFromQueue(index)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      {/* Minimized View */}
      {isMinimized && currentTrack && (
        <div className="p-3 flex items-center gap-3">
          <img src={currentTrack.thumbnail} alt="" className="w-10 h-10 rounded" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{currentTrack.title}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={togglePlay}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={playNext} disabled={queue.length === 0}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}

// Add YouTube types
declare global {
  interface Window {
    YT: {
      Player: any;
      PlayerState: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}
