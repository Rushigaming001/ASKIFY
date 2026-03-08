
-- Allow all authenticated users to view all user roles (needed for role badges)
CREATE POLICY "All authenticated users can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Create reel_comments table
CREATE TABLE public.reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reel comments"
ON public.reel_comments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can add comments"
ON public.reel_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.reel_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);
