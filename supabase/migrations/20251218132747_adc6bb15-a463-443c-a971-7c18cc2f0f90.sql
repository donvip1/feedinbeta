-- Create a table to track user's viewed post history
CREATE TABLE IF NOT EXISTS public.post_view_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.post_view_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own history
CREATE POLICY "Users can view their own history"
ON public.post_view_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own views
CREATE POLICY "Users can insert their own views"
ON public.post_view_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own history
CREATE POLICY "Users can delete their own history"
ON public.post_view_history
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_post_view_history_user_viewed 
ON public.post_view_history(user_id, viewed_at DESC);

CREATE INDEX idx_post_view_history_post 
ON public.post_view_history(post_id);

-- Function to record a post view (upserts to update timestamp if already viewed)
CREATE OR REPLACE FUNCTION public.record_post_view(p_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO post_view_history (user_id, post_id, viewed_at)
  VALUES (auth.uid(), p_post_id, now())
  ON CONFLICT (user_id, post_id) 
  DO UPDATE SET viewed_at = now();
END;
$$;

-- Function to get user's viewed post IDs from today (to filter feed)
CREATE OR REPLACE FUNCTION public.get_today_viewed_posts()
RETURNS TABLE(post_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pvh.post_id
  FROM post_view_history pvh
  WHERE pvh.user_id = auth.uid()
    AND pvh.viewed_at >= CURRENT_DATE;
END;
$$;

-- Function to get view history for profile (last 48 hours)
CREATE OR REPLACE FUNCTION public.get_view_history(p_limit INT DEFAULT 50)
RETURNS TABLE(
  post_id UUID,
  content TEXT,
  media_url TEXT,
  author_name TEXT,
  author_username TEXT,
  author_avatar TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as post_id,
    p.content,
    p.media_url,
    prof.display_name as author_name,
    prof.username as author_username,
    prof.avatar_url as author_avatar,
    pvh.viewed_at
  FROM post_view_history pvh
  JOIN posts p ON p.id = pvh.post_id
  JOIN public_profiles prof ON prof.id = p.user_id
  WHERE pvh.user_id = auth.uid()
    AND pvh.viewed_at >= now() - INTERVAL '48 hours'
  ORDER BY pvh.viewed_at DESC
  LIMIT p_limit;
END;
$$;

-- Cleanup function to delete old history (older than 48 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_view_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM post_view_history
  WHERE viewed_at < now() - INTERVAL '48 hours';
END;
$$;