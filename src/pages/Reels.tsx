import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Heart, ThumbsDown, MessageCircle, Share2, Plus, Loader2, Volume2, VolumeX, Trash2, UserPlus, UserCheck, Play, Pause, Image, Video } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface Reel {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption?: string | null;
  created_at: string;
  view_count: number;
  profiles?: { name: string; avatar_url?: string | null } | null;
  likes: number;
  dislikes: number;
  userReaction?: 'like' | 'dislike' | null;
}

const Reels = () => {
  useRequireAuth();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const loadReels = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: stories, error } = await supabase
        .from('stories')
        .select('*, profiles!stories_user_id_fkey(name, avatar_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get reactions
      const storyIds = (stories || []).map(s => s.id);
      const { data: reactions } = await supabase
        .from('reel_reactions')
        .select('*')
        .in('story_id', storyIds.length > 0 ? storyIds : ['none']);

      // Get follows
      const { data: followData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      setFollowing(new Set(followData?.map(f => f.following_id) || []));

      const reelData: Reel[] = (stories || []).map(s => {
        const storyReactions = reactions?.filter(r => r.story_id === s.id) || [];
        const likes = storyReactions.filter(r => r.reaction_type === 'like').length;
        const dislikes = storyReactions.filter(r => r.reaction_type === 'dislike').length;
        const userReaction = storyReactions.find(r => r.user_id === user.id)?.reaction_type as 'like' | 'dislike' | null;

        return { ...s, likes, dislikes, userReaction };
      });

      setReels(reelData);
    } catch (err) {
      console.error('Error loading reels:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadReels(); }, [loadReels]);

  // Play/pause videos on scroll
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (idx === activeIndex) {
        video.currentTime = 0;
        video.muted = muted;
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [activeIndex, muted]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== activeIndex) setActiveIndex(newIndex);
  };

  const handleReaction = async (reelId: string, type: 'like' | 'dislike') => {
    if (!user) return;
    const reel = reels.find(r => r.id === reelId);
    if (!reel) return;

    try {
      if (reel.userReaction === type) {
        // Remove reaction
        await supabase.from('reel_reactions').delete().eq('story_id', reelId).eq('user_id', user.id);
      } else {
        // Upsert reaction
        await supabase.from('reel_reactions').upsert(
          { story_id: reelId, user_id: user.id, reaction_type: type },
          { onConflict: 'story_id,user_id' }
        );
      }
      loadReels();
    } catch (err) {
      console.error('Reaction error:', err);
    }
  };

  const handleFollow = async (targetId: string) => {
    if (!user) return;
    try {
      if (following.has(targetId)) {
        await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
        setFollowing(prev => { const n = new Set(prev); n.delete(targetId); return n; });
      } else {
        await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
        setFollowing(prev => new Set(prev).add(targetId));
      }
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  const handleDelete = async (reelId: string) => {
    if (!user) return;
    try {
      await supabase.from('stories').delete().eq('id', reelId).eq('user_id', user.id);
      toast({ title: 'Reel deleted' });
      loadReels();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 15MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('stories').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(fileName);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      await supabase.from('stories').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: mediaType,
      });

      toast({ title: 'Reel posted!' });
      loadReels();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-white font-bold text-lg">Reels</h1>
        </div>
        <label className="cursor-pointer">
          <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          <div className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-full px-3 py-2 text-white text-sm transition-colors">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Post
          </div>
        </label>
      </div>

      {/* Reels Feed */}
      {reels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-white/60 gap-4">
          <Video className="h-16 w-16" />
          <p className="text-lg">No reels yet</p>
          <label className="cursor-pointer">
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
            <div className="bg-primary text-primary-foreground rounded-full px-6 py-2 font-medium">
              Post the first reel
            </div>
          </label>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        >
          {reels.map((reel, idx) => (
            <div key={reel.id} className="h-screen w-full snap-start relative flex items-center justify-center">
              {/* Media */}
              {reel.media_type === 'video' ? (
                <video
                  ref={el => { if (el) videoRefs.current.set(idx, el); }}
                  src={reel.media_url}
                  className="w-full h-full object-cover"
                  loop
                  playsInline
                  muted={muted}
                  onClick={() => {
                    const v = videoRefs.current.get(idx);
                    if (v) { v.paused ? v.play() : v.pause(); setPaused(v.paused); }
                  }}
                />
              ) : (
                <img src={reel.media_url} alt="Reel" className="w-full h-full object-cover" />
              )}

              {/* Paused overlay */}
              {paused && idx === activeIndex && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Play className="h-16 w-16 text-white/60" />
                </div>
              )}

              {/* Right side actions */}
              <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
                {/* Like */}
                <button onClick={() => handleReaction(reel.id, 'like')} className="flex flex-col items-center">
                  <Heart className={`h-7 w-7 ${reel.userReaction === 'like' ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                  <span className="text-white text-xs mt-1">{reel.likes}</span>
                </button>

                {/* Dislike */}
                <button onClick={() => handleReaction(reel.id, 'dislike')} className="flex flex-col items-center">
                  <ThumbsDown className={`h-7 w-7 ${reel.userReaction === 'dislike' ? 'fill-blue-500 text-blue-500' : 'text-white'}`} />
                  <span className="text-white text-xs mt-1">{reel.dislikes}</span>
                </button>

                {/* Sound toggle */}
                <button onClick={() => setMuted(!muted)} className="flex flex-col items-center">
                  {muted ? <VolumeX className="h-7 w-7 text-white" /> : <Volume2 className="h-7 w-7 text-white" />}
                </button>

                {/* Delete (own reels) */}
                {reel.user_id === user?.id && (
                  <button onClick={() => handleDelete(reel.id)} className="flex flex-col items-center">
                    <Trash2 className="h-6 w-6 text-white/80" />
                  </button>
                )}
              </div>

              {/* Bottom info */}
              <div className="absolute bottom-6 left-3 right-16">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar className="h-9 w-9 border-2 border-white">
                    {reel.profiles?.avatar_url && <AvatarImage src={reel.profiles.avatar_url} />}
                    <AvatarFallback className="text-xs">{getInitials(reel.profiles?.name || 'U')}</AvatarFallback>
                  </Avatar>
                  <span className="text-white font-semibold text-sm">
                    {reel.user_id === user?.id ? 'You' : reel.profiles?.name || 'Unknown'}
                  </span>
                  {reel.user_id !== user?.id && (
                    <Button
                      size="sm"
                      variant={following.has(reel.user_id) ? 'secondary' : 'default'}
                      className="h-7 text-xs rounded-full px-3"
                      onClick={() => handleFollow(reel.user_id)}
                    >
                      {following.has(reel.user_id) ? (
                        <><UserCheck className="h-3 w-3 mr-1" />Following</>
                      ) : (
                        <><UserPlus className="h-3 w-3 mr-1" />Follow</>
                      )}
                    </Button>
                  )}
                </div>
                {reel.caption && (
                  <p className="text-white text-sm drop-shadow-lg line-clamp-2">{reel.caption}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reels;
