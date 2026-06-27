-- Add story comments table
CREATE TABLE IF NOT EXISTS public.story_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on story comments
ALTER TABLE public.story_comments ENABLE ROW LEVEL SECURITY;

-- Policies for story comments
CREATE POLICY "Users can view story comments"
  ON public.story_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can create story comments"
  ON public.story_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own story comments"
  ON public.story_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Add post mentions table
CREATE TABLE IF NOT EXISTS public.post_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, mentioned_user_id)
);

-- Enable RLS on post mentions
ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;

-- Policies for post mentions
CREATE POLICY "Anyone can view post mentions"
  ON public.post_mentions FOR SELECT
  USING (true);

CREATE POLICY "Users can create post mentions"
  ON public.post_mentions FOR INSERT
  WITH CHECK (true);

-- Add additional media URLs to posts for multiple media support
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS media_types TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create index for story comments
CREATE INDEX IF NOT EXISTS idx_story_comments_story_id ON public.story_comments(story_id);
CREATE INDEX IF NOT EXISTS idx_story_comments_user_id ON public.story_comments(user_id);

-- Create index for post mentions
CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id ON public.post_mentions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_user_id ON public.post_mentions(mentioned_user_id);