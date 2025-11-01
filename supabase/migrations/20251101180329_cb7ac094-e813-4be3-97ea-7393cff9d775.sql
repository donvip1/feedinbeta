-- Phase 4: Content Discovery & Engagement Features

-- Add hashtags extraction and tracking
CREATE TABLE IF NOT EXISTS public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  posts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hashtags_name ON public.hashtags(name);
CREATE INDEX IF NOT EXISTS idx_hashtags_posts_count ON public.hashtags(posts_count DESC);

-- Post hashtags junction table
CREATE TABLE IF NOT EXISTS public.post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id UUID REFERENCES public.hashtags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_hashtags_post_id ON public.post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_hashtags_hashtag_id ON public.post_hashtags(hashtag_id);

-- Trending posts tracking
CREATE TABLE IF NOT EXISTS public.trending_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE UNIQUE,
  engagement_score NUMERIC DEFAULT 0,
  trending_rank INTEGER,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trending_posts_rank ON public.trending_posts(trending_rank);
CREATE INDEX IF NOT EXISTS idx_trending_posts_score ON public.trending_posts(engagement_score DESC);

-- Post analytics for trending calculation
CREATE TABLE IF NOT EXISTS public.post_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE UNIQUE,
  hourly_views INTEGER DEFAULT 0,
  hourly_likes INTEGER DEFAULT 0,
  hourly_comments INTEGER DEFAULT 0,
  hourly_shares INTEGER DEFAULT 0,
  last_calculated TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view hashtags" ON public.hashtags FOR SELECT USING (true);
CREATE POLICY "Anyone can view post_hashtags" ON public.post_hashtags FOR SELECT USING (true);
CREATE POLICY "Anyone can view trending posts" ON public.trending_posts FOR SELECT USING (true);
CREATE POLICY "Anyone can view post analytics" ON public.post_analytics FOR SELECT USING (true);

-- Function to update hashtag count
CREATE OR REPLACE FUNCTION public.update_hashtag_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.hashtags SET posts_count = posts_count + 1 WHERE id = NEW.hashtag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.hashtags SET posts_count = posts_count - 1 WHERE id = OLD.hashtag_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for hashtag count
DROP TRIGGER IF EXISTS update_hashtag_count_trigger ON public.post_hashtags;
CREATE TRIGGER update_hashtag_count_trigger
AFTER INSERT OR DELETE ON public.post_hashtags
FOR EACH ROW EXECUTE FUNCTION public.update_hashtag_count();

-- Function to calculate trending posts
CREATE OR REPLACE FUNCTION public.calculate_trending_posts()
RETURNS void AS $$
BEGIN
  -- Calculate engagement scores for recent posts (last 24 hours)
  INSERT INTO public.trending_posts (post_id, engagement_score, trending_rank)
  SELECT 
    p.id,
    (
      (p.likes_count * 2) + 
      (p.comments_count * 3) + 
      (p.shares_count * 4) + 
      (p.views_count * 0.1) +
      (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) * -1 -- Recency factor
    ) as score,
    ROW_NUMBER() OVER (ORDER BY (
      (p.likes_count * 2) + 
      (p.comments_count * 3) + 
      (p.shares_count * 4) + 
      (p.views_count * 0.1) +
      (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) * -1
    ) DESC)
  FROM public.posts p
  WHERE p.created_at >= NOW() - INTERVAL '24 hours'
    AND p.status = 'active'
  ON CONFLICT (post_id) 
  DO UPDATE SET 
    engagement_score = EXCLUDED.engagement_score,
    trending_rank = EXCLUDED.trending_rank,
    calculated_at = NOW();
    
  -- Remove old trending posts (older than 48 hours)
  DELETE FROM public.trending_posts
  WHERE calculated_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;