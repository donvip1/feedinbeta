-- Add refeeds_count column if it doesn't exist
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS refeeds_count integer DEFAULT 0;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_posts_refeeds_count ON public.posts(refeeds_count DESC);

-- Add story_comments table if not exists
CREATE TABLE IF NOT EXISTS public.story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- Policies for story comments
CREATE POLICY "Anyone can view story comments" ON public.story_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can add comments" ON public.story_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.story_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_comments;