-- Create post_promotions table to track actively promoted posts
CREATE TABLE IF NOT EXISTS public.post_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  credits_spent INTEGER NOT NULL DEFAULT 0,
  boost_level TEXT NOT NULL DEFAULT 'basic',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.post_promotions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view active promotions" ON public.post_promotions
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Users can create promotions" ON public.post_promotions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own promotions" ON public.post_promotions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Create index for efficient querying of active promotions
CREATE INDEX idx_post_promotions_active ON public.post_promotions (is_active, expires_at) WHERE is_active = true;
CREATE INDEX idx_post_promotions_post_id ON public.post_promotions (post_id);

-- Update promote_post function to also create promotion record
CREATE OR REPLACE FUNCTION public.promote_post(
  p_post_id UUID,
  p_credits INTEGER,
  p_boost_type TEXT DEFAULT 'basic',
  p_original_author_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance INTEGER;
  v_post_user_id UUID;
  v_actual_original_author UUID;
  v_author_credit INTEGER;
  v_duration_hours INTEGER;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get user's current credit balance
  SELECT credits INTO v_current_balance FROM user_credits WHERE user_id = v_user_id;
  
  IF v_current_balance IS NULL OR v_current_balance < p_credits THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;
  
  -- Get post author
  SELECT user_id INTO v_post_user_id FROM posts WHERE id = p_post_id;
  
  IF v_post_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Post not found');
  END IF;
  
  -- Determine the original author for attribution
  v_actual_original_author := COALESCE(p_original_author_id, v_post_user_id);
  
  -- Calculate duration based on boost type
  v_duration_hours := CASE p_boost_type
    WHEN 'premium' THEN 72
    WHEN 'standard' THEN 48
    ELSE 24
  END;
  
  -- Deduct credits from promoter
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_user_id, -p_credits, 'promotion', 'Post promotion: ' || p_boost_type, p_post_id);
  
  -- If promoting someone else's content, give them 20%
  IF v_user_id != v_actual_original_author THEN
    v_author_credit := GREATEST(1, (p_credits * 20) / 100);
    
    INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
    VALUES (v_actual_original_author, v_author_credit, 'promotion_reward', 'Reward for promoted content', p_post_id);
    
    -- Notify original author
    INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
    VALUES (
      v_actual_original_author, 
      v_user_id, 
      'promotion_reward', 
      'Your content was promoted!', 
      'Someone promoted your content and you earned ' || v_author_credit || ' credits!',
      p_post_id,
      'post'
    );
  END IF;
  
  -- Create or update promotion record
  INSERT INTO post_promotions (post_id, user_id, credits_spent, boost_level, expires_at, is_active)
  VALUES (p_post_id, v_user_id, p_credits, p_boost_type, now() + (v_duration_hours || ' hours')::interval, true)
  ON CONFLICT (post_id, user_id) 
  DO UPDATE SET 
    credits_spent = post_promotions.credits_spent + p_credits,
    expires_at = GREATEST(post_promotions.expires_at, now()) + (v_duration_hours || ' hours')::interval,
    is_active = true;
  
  -- Update user analytics
  INSERT INTO user_analytics (user_id, total_promotions, last_active)
  VALUES (v_user_id, 1, now())
  ON CONFLICT (user_id) DO UPDATE SET 
    total_promotions = user_analytics.total_promotions + 1,
    last_active = now();
  
  RETURN json_build_object('success', true);
END;
$$;

-- Create function to get feed with promoted posts prioritized and viewed posts filtered
CREATE OR REPLACE FUNCTION public.get_prioritized_feed(
  p_user_id UUID,
  p_feed_type TEXT DEFAULT 'forYou',
  p_viewed_post_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  feed_id TEXT,
  user_id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  media_urls TEXT[],
  media_types TEXT[],
  post_type TEXT,
  likes_count INTEGER,
  comments_count INTEGER,
  shares_count INTEGER,
  views_count INTEGER,
  refeeds_count INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  privacy TEXT,
  location TEXT,
  allow_comments BOOLEAN,
  allow_refeed BOOLEAN,
  original_post_id UUID,
  is_promoted BOOLEAN,
  promotion_boost_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH active_promotions AS (
    SELECT pp.post_id, pp.boost_level
    FROM post_promotions pp
    WHERE pp.is_active = true AND pp.expires_at > now()
  ),
  following_ids AS (
    SELECT f.following_id 
    FROM follows f 
    WHERE f.follower_id = p_user_id
  ),
  unviewed_posts AS (
    SELECT p.*, 
           ap.post_id IS NOT NULL as is_promoted,
           ap.boost_level as promotion_boost_level,
           CASE 
             WHEN ap.boost_level = 'premium' THEN 3
             WHEN ap.boost_level = 'standard' THEN 2
             WHEN ap.boost_level = 'basic' THEN 1
             ELSE 0
           END as promotion_priority
    FROM posts p
    LEFT JOIN active_promotions ap ON p.id = ap.post_id
    WHERE p.status = 'active'
      AND (array_length(p_viewed_post_ids, 1) IS NULL OR p.id != ALL(p_viewed_post_ids))
      AND (
        p_feed_type != 'following' 
        OR p.user_id IN (SELECT following_id FROM following_ids)
      )
    ORDER BY 
      promotion_priority DESC,
      p.created_at DESC
    LIMIT p_limit
  ),
  all_posts AS (
    -- If we don't have enough unviewed posts, include viewed ones
    SELECT * FROM unviewed_posts
    UNION ALL
    SELECT p.*, 
           ap.post_id IS NOT NULL as is_promoted,
           ap.boost_level as promotion_boost_level,
           CASE 
             WHEN ap.boost_level = 'premium' THEN 3
             WHEN ap.boost_level = 'standard' THEN 2
             WHEN ap.boost_level = 'basic' THEN 1
             ELSE 0
           END as promotion_priority
    FROM posts p
    LEFT JOIN active_promotions ap ON p.id = ap.post_id
    WHERE p.status = 'active'
      AND p.id = ANY(p_viewed_post_ids)
      AND (
        p_feed_type != 'following' 
        OR p.user_id IN (SELECT following_id FROM following_ids)
      )
      AND (SELECT COUNT(*) FROM unviewed_posts) < p_limit
    ORDER BY 
      promotion_priority DESC,
      p.created_at DESC
    LIMIT p_limit - (SELECT COUNT(*) FROM unviewed_posts)
  )
  SELECT 
    ap.id,
    ap.feed_id,
    ap.user_id,
    ap.content,
    ap.media_url,
    ap.media_type,
    ap.media_urls,
    ap.media_types,
    ap.post_type,
    ap.likes_count,
    ap.comments_count,
    ap.shares_count,
    ap.views_count,
    ap.refeeds_count,
    ap.status,
    ap.created_at,
    ap.updated_at,
    ap.privacy,
    ap.location,
    ap.allow_comments,
    ap.allow_refeed,
    ap.original_post_id,
    ap.is_promoted,
    ap.promotion_boost_level
  FROM all_posts ap
  ORDER BY ap.promotion_priority DESC, ap.created_at DESC
  LIMIT p_limit;
END;
$$;