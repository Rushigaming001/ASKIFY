
-- Reel reactions (like/dislike)
CREATE TABLE public.reel_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE public.reel_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reel reactions" ON public.reel_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can add reactions" ON public.reel_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their reactions" ON public.reel_reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can remove their reactions" ON public.reel_reactions FOR DELETE USING (auth.uid() = user_id);

-- Follow system
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Allow stories to be updated (for view_count increments and deletions)
CREATE POLICY "Users can update their own stories" ON public.stories FOR UPDATE USING (auth.uid() = user_id);

-- Add reel_reactions and follows to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reel_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
