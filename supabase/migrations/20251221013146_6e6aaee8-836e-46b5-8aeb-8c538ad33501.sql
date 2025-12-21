-- Add trending_score to posts table for pre-computed trending
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS trending_score REAL DEFAULT 0;

-- Add trending columns to hashtags
ALTER TABLE public.hashtags ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false;
ALTER TABLE public.hashtags ADD COLUMN IF NOT EXISTS trending_score REAL DEFAULT 0;

-- Create user_interests table for "For You" personalization
CREATE TABLE IF NOT EXISTS public.user_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  interest_type TEXT NOT NULL,
  interest_value TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, interest_type, interest_value)
);

-- Enable RLS on user_interests
ALTER TABLE public.user_interests ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_interests
CREATE POLICY "Users can view their own interests" 
ON public.user_interests FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interests" 
ON public.user_interests FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interests" 
ON public.user_interests FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interests" 
ON public.user_interests FOR DELETE 
USING (auth.uid() = user_id);

-- Create user_engagement_signals table for tracking
CREATE TABLE IF NOT EXISTS public.user_engagement_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  engagement_type TEXT NOT NULL,
  watch_duration_seconds REAL,
  full_watch BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_engagement_signals
ALTER TABLE public.user_engagement_signals ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_engagement_signals
CREATE POLICY "Users can view their own engagement" 
ON public.user_engagement_signals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own engagement" 
ON public.user_engagement_signals FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trending_searches table
CREATE TABLE IF NOT EXISTS public.trending_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL UNIQUE,
  search_count INTEGER DEFAULT 1,
  last_searched_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on trending_searches (public read, authenticated write)
ALTER TABLE public.trending_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view trending searches" 
ON public.trending_searches FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can upsert trending searches" 
ON public.trending_searches FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update trending searches" 
ON public.trending_searches FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_posts_trending_score ON public.posts(trending_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_posts_created_engagement ON public.posts(created_at DESC, likes_count DESC NULLS LAST, views_count DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_hashtags_trending ON public.hashtags(is_trending, trending_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_user_engagement_user_action ON public.user_engagement_signals(user_id, engagement_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interests_user ON public.user_interests(user_id, interest_type);
CREATE INDEX IF NOT EXISTS idx_trending_searches_count ON public.trending_searches(search_count DESC);

-- Function to calculate trending scores for posts
CREATE OR REPLACE FUNCTION public.calculate_trending_scores()
RETURNS void AS $$
BEGIN
  UPDATE public.posts SET trending_score = (
    COALESCE(likes_count, 0) * 3 +
    COALESCE(comments_count, 0) * 5 +
    COALESCE(views_count, 0) * 0.1 +
    COALESCE(refeeds_count, 0) * 4
  ) * EXP(-0.05 * EXTRACT(EPOCH FROM (now() - created_at)) / 3600)
  WHERE created_at > now() - INTERVAL '7 days';

  UPDATE public.hashtags SET 
    is_trending = posts_count > 5 AND updated_at > now() - INTERVAL '24 hours',
    trending_score = COALESCE(posts_count, 0) * CASE 
      WHEN updated_at > now() - INTERVAL '1 hour' THEN 2
      WHEN updated_at > now() - INTERVAL '6 hours' THEN 1.5
      ELSE 1
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get personalized feed
CREATE OR REPLACE FUNCTION public.get_personalized_feed_v2(
  p_user_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  post_id UUID,
  relevance_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as post_id,
    (
      COALESCE(p.trending_score, 0) +
      COALESCE(p.likes_count, 0) * 0.3 +
      COALESCE(p.comments_count, 0) * 0.5 +
      COALESCE(p.views_count, 0) * 0.01 +
      COALESCE((
        SELECT SUM(ui.weight) 
        FROM public.user_interests ui 
        WHERE ui.user_id = p_user_id 
        AND ui.interest_type = 'creator' 
        AND ui.interest_value = p.user_id::text
      ), 0) * 10
    )::REAL as relevance_score
  FROM public.posts p
  WHERE p.user_id != p_user_id
  ORDER BY relevance_score DESC, p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for engagement signals
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_engagement_signals;