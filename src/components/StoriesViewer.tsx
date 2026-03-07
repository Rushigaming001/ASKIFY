import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { X, ChevronLeft, ChevronRight, Plus, Camera, Loader2, Eye, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption?: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
  user?: {
    name: string;
    avatar_url?: string | null;
  } | null;
  viewed?: boolean;
  profiles?: {
    name: string;
    avatar_url?: string | null;
  } | null;
}

interface UserWithStories {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  stories: Story[];
  hasUnviewed: boolean;
}

export function StoriesViewer() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [usersWithStories, setUsersWithStories] = useState<UserWithStories[]>([]);
  const [activeUserIndex, setActiveUserIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadStories = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get all unexpired stories with user info
      const { data: stories, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles!stories_user_id_fkey (name, avatar_url)
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user's viewed stories
      const { data: viewedStories } = await supabase
        .from('story_views')
        .select('story_id')
        .eq('viewer_id', user.id);

      const viewedIds = new Set(viewedStories?.map(v => v.story_id) || []);

      // Group by user
      const userMap = new Map<string, UserWithStories>();
      
      // Add current user first (for "Your Story")
      const myStories = (stories || []).filter(s => s.user_id === user.id);
      if (myStories.length > 0 || true) {
        userMap.set(user.id, {
          user_id: user.id,
          user_name: 'Your Story',
          avatar_url: undefined,
          stories: myStories.map(s => ({
            ...s,
            user: s.profiles,
            viewed: true
          })),
          hasUnviewed: false
        });
      }

      // Add other users' stories
      (stories || []).forEach(story => {
        if (story.user_id === user.id) return;
        
        const existing = userMap.get(story.user_id);
        const storyWithViewed = {
          ...story,
          user: story.profiles,
          viewed: viewedIds.has(story.id)
        };

        if (existing) {
          existing.stories.push(storyWithViewed);
          if (!storyWithViewed.viewed) existing.hasUnviewed = true;
        } else {
          userMap.set(story.user_id, {
            user_id: story.user_id,
            user_name: story.profiles?.name || 'Unknown',
            avatar_url: story.profiles?.avatar_url,
            stories: [storyWithViewed],
            hasUnviewed: !storyWithViewed.viewed
          });
        }
      });

      setUsersWithStories(Array.from(userMap.values()));
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // Story progress timer
  useEffect(() => {
    if (activeUserIndex === null) return;

    const activeUser = usersWithStories[activeUserIndex];
    if (!activeUser) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          // Move to next story
          if (activeStoryIndex < activeUser.stories.length - 1) {
            setActiveStoryIndex(i => i + 1);
            return 0;
          } else if (activeUserIndex < usersWithStories.length - 1) {
            setActiveUserIndex(i => (i !== null ? i + 1 : 0));
            setActiveStoryIndex(0);
            return 0;
          } else {
            closeStory();
            return 0;
          }
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeUserIndex, activeStoryIndex, usersWithStories]);

  const openStory = async (userIndex: number) => {
    setActiveUserIndex(userIndex);
    setActiveStoryIndex(0);
    setProgress(0);
    
    // Mark as viewed
    const story = usersWithStories[userIndex]?.stories[0];
    if (story && !story.viewed && user) {
      await supabase.from('story_views').insert({
        story_id: story.id,
        viewer_id: user.id
      });
    }
  };

  const closeStory = () => {
    setActiveUserIndex(null);
    setActiveStoryIndex(0);
    setProgress(0);
    loadStories(); // Refresh to update viewed status
  };

  const goToPrevStory = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(i => i - 1);
      setProgress(0);
    } else if (activeUserIndex !== null && activeUserIndex > 0) {
      const prevUser = usersWithStories[activeUserIndex - 1];
      setActiveUserIndex(i => (i !== null ? i - 1 : 0));
      setActiveStoryIndex(prevUser.stories.length - 1);
      setProgress(0);
    }
  };

  const goToNextStory = async () => {
    if (activeUserIndex === null) return;
    const activeUser = usersWithStories[activeUserIndex];
    
    if (activeStoryIndex < activeUser.stories.length - 1) {
      setActiveStoryIndex(i => i + 1);
      setProgress(0);
      
      // Mark as viewed
      const nextStory = activeUser.stories[activeStoryIndex + 1];
      if (nextStory && !nextStory.viewed && user) {
        await supabase.from('story_views').insert({
          story_id: nextStory.id,
          viewer_id: user.id
        });
      }
    } else if (activeUserIndex < usersWithStories.length - 1) {
      setActiveUserIndex(i => (i !== null ? i + 1 : 0));
      setActiveStoryIndex(0);
      setProgress(0);
    } else {
      closeStory();
    }
  };

  const handleAddStory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 15MB',
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName);

      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      await supabase.from('stories').insert({
        user_id: user.id,
        media_url: publicUrl,
        media_type: mediaType
      });

      toast({ title: 'Story posted!' });
      loadStories();
    } catch (error: any) {
      console.error('Error uploading story:', error);
      toast({
        title: 'Failed to post story',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const activeUser = activeUserIndex !== null ? usersWithStories[activeUserIndex] : null;
  const activeStory = activeUser?.stories[activeStoryIndex];

  return (
    <>
      {/* Stories Row */}
      <div className="flex items-center gap-3 p-3 overflow-x-auto scrollbar-hide">
        {/* Add Story Button */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <label className="relative cursor-pointer">
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleAddStory}
              disabled={uploading}
            />
            <div className="h-14 w-14 rounded-full bg-gradient-to-r from-primary to-primary/60 flex items-center justify-center border-2 border-background shadow-lg">
              {uploading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Plus className="h-6 w-6 text-white" />
              )}
            </div>
          </label>
          <span className="text-xs text-muted-foreground">Add Story</span>
        </div>

        {/* User Stories */}
        {loading ? (
          <div className="flex items-center gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col items-center gap-1 animate-pulse">
                <div className="h-14 w-14 rounded-full bg-muted" />
                <div className="h-2 w-10 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          usersWithStories.map((userWithStories, index) => (
            <button
              key={userWithStories.user_id}
              onClick={() => openStory(index)}
              className="flex flex-col items-center gap-1 flex-shrink-0"
            >
              <div className={`p-0.5 rounded-full ${
                userWithStories.hasUnviewed 
                  ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500' 
                  : 'bg-muted'
              }`}>
                <Avatar className="h-12 w-12 border-2 border-background">
                  {userWithStories.avatar_url ? (
                    <AvatarImage src={userWithStories.avatar_url} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {getInitials(userWithStories.user_name)}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                {userWithStories.user_id === user?.id ? 'You' : userWithStories.user_name.split(' ')[0]}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Story Viewer Modal */}
      {activeUser && activeStory && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          {/* Progress bars */}
          <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
            {activeUser.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white transition-all duration-100"
                  style={{ 
                    width: i < activeStoryIndex ? '100%' : i === activeStoryIndex ? `${progress}%` : '0%' 
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-white">
                {activeUser.avatar_url ? (
                  <AvatarImage src={activeUser.avatar_url} />
                ) : null}
                <AvatarFallback>{getInitials(activeUser.user_name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium text-sm">{activeUser.user_name}</p>
                <p className="text-white/60 text-xs">
                  {new Date(activeStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={closeStory}
              className="text-white hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* Story Content */}
          <div className="w-full h-full flex items-center justify-center">
            {activeStory.media_type === 'video' ? (
              <video 
                src={activeStory.media_url} 
                autoPlay 
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <img 
                src={activeStory.media_url} 
                alt="Story" 
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          {/* Caption */}
          {activeStory.caption && (
            <div className="absolute bottom-20 left-4 right-4 text-center">
              <p className="text-white text-lg drop-shadow-lg">{activeStory.caption}</p>
            </div>
          )}

          {/* View count & delete (own stories) */}
          {activeUser.user_id === user?.id && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 text-white/80">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span className="text-sm">{activeStory.view_count} views</span>
              </div>
              <button
                onClick={async () => {
                  await supabase.from('stories').delete().eq('id', activeStory.id);
                  toast({ title: 'Story deleted' });
                  closeStory();
                }}
                className="flex items-center gap-1 text-red-400 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-sm">Delete</span>
              </button>
            </div>
          )}

          {/* Navigation */}
          <button 
            onClick={goToPrevStory}
            className="absolute left-0 top-0 bottom-0 w-1/3"
          />
          <button 
            onClick={goToNextStory}
            className="absolute right-0 top-0 bottom-0 w-1/3"
          />
        </div>
      )}
    </>
  );
}