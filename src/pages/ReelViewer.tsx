import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { Heart, MessageCircle, Share2, ArrowLeft, Loader2, Eye, Volume2, VolumeX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Reel {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption?: string | null;
  created_at: string;
  view_count: number;
  profiles?: { name: string; avatar_url?: string | null } | null;
  liked?: boolean;
  likeCount?: number;
}

const ReelViewer = () => {
  useRequireAuth();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadReels = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('stories')
        .select('*, profiles!stories_user_id_fkey(name, avatar_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (data) {
        const reelsWithLikes = await Promise.all(
          data.map(async (reel) => {
            const { count: likeCount } = await supabase
              .from('reel_reactions')
              .select('*', { count: 'exact', head: true })
              .eq('story_id', reel.id);

            const { data: userLike } = await supabase
              .from('reel_reactions')
              .select('id')
              .eq('story_id', reel.id)
              .eq('user_id', user.id)
              .maybeSingle();

            return { ...reel, liked: !!userLike, likeCount: likeCount || 0 };
          })
        );
        setReels(reelsWithLikes);
      }
    } catch (err) {
      console.error('Error loading reels:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadReels(); }, [loadReels]);

  // Track view
  useEffect(() => {
    if (!user || reels.length === 0) return;
    const reel = reels[currentIndex];
    if (!reel) return;

    const trackView = async () => {
      const { data: existing } = await supabase
        .from('story_views')
        .select('id')
        .eq('story_id', reel.id)
        .eq('viewer_id', user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('story_views').insert({ story_id: reel.id, viewer_id: user.id });
        await supabase.from('stories').update({ view_count: reel.view_count + 1 }).eq('id', reel.id);
      }
    };
    trackView();
  }, [currentIndex, reels, user]);

  const handleLike = async (reelId: string) => {
    if (!user) return;
    const reel = reels.find(r => r.id === reelId);
    if (!reel) return;

    if (reel.liked) {
      await supabase.from('reel_reactions').delete().eq('story_id', reelId).eq('user_id', user.id);
      setReels(prev => prev.map(r => r.id === reelId ? { ...r, liked: false, likeCount: (r.likeCount || 1) - 1 } : r));
    } else {
      await supabase.from('reel_reactions').insert({ story_id: reelId, user_id: user.id, reaction_type: 'like' });
      setReels(prev => prev.map(r => r.id === reelId ? { ...r, liked: true, likeCount: (r.likeCount || 0) + 1 } : r));
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const idx = Math.round(scrollTop / height);
    setCurrentIndex(idx);
  };

  const handleShare = async (reel: Reel) => {
    try {
      await navigator.share?.({ title: reel.caption || 'Check out this reel!', url: window.location.href });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: 'Link copied!' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-muted-foreground text-lg">No reels yet</p>
        <p className="text-muted-foreground text-sm">Be the first to upload a reel!</p>
        <Button onClick={() => navigate('/reels')}>Upload Reel</Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-white font-bold text-lg">Reels</h1>
        <div className="w-10" />
      </div>

      {/* Reels Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {reels.map((reel, idx) => (
          <div
            key={reel.id}
            className="h-screen w-full snap-start relative flex items-center justify-center bg-black"
          >
            {/* Media */}
            {reel.media_type === 'video' ? (
              <video
                src={reel.media_url}
                className="h-full w-full object-contain"
                autoPlay={idx === currentIndex}
                loop
                muted={muted}
                playsInline
              />
            ) : (
              <img
                src={reel.media_url}
                alt={reel.caption || 'Reel'}
                className="h-full w-full object-contain"
              />
            )}

            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="h-10 w-10 border-2 border-white">
                  {reel.profiles?.avatar_url && <AvatarImage src={reel.profiles.avatar_url} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {reel.profiles?.name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white font-semibold text-sm">{reel.profiles?.name || 'Unknown'}</p>
                  <p className="text-white/60 text-xs">
                    {formatDistanceToNow(new Date(reel.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              {reel.caption && (
                <p className="text-white text-sm mb-2">{reel.caption}</p>
              )}
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <Eye className="h-3 w-3" />
                <span>{reel.view_count} views</span>
              </div>
            </div>

            {/* Right action buttons */}
            <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
              <button onClick={() => handleLike(reel.id)} className="flex flex-col items-center gap-1">
                <Heart className={`h-7 w-7 ${reel.liked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                <span className="text-white text-xs">{reel.likeCount || 0}</span>
              </button>
              <button className="flex flex-col items-center gap-1">
                <MessageCircle className="h-7 w-7 text-white" />
                <span className="text-white text-xs">Chat</span>
              </button>
              <button onClick={() => handleShare(reel)} className="flex flex-col items-center gap-1">
                <Share2 className="h-7 w-7 text-white" />
                <span className="text-white text-xs">Share</span>
              </button>
              {reel.media_type === 'video' && (
                <button onClick={() => setMuted(!muted)} className="flex flex-col items-center gap-1">
                  {muted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReelViewer;
