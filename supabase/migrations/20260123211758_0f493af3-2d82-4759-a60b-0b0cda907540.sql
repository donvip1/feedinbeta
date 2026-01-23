-- =============================================
-- PHASE 1: FEED ADS & TARGETING INFRASTRUCTURE
-- =============================================

-- 1. Create feed_ads table for platform advertisements
CREATE TABLE IF NOT EXISTS public.feed_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  click_url TEXT,
  
  -- Targeting criteria
  target_countries TEXT[] DEFAULT '{}',
  target_cities TEXT[] DEFAULT '{}',
  target_genders TEXT[] DEFAULT '{}',
  target_age_min INTEGER,
  target_age_max INTEGER,
  target_interests TEXT[] DEFAULT '{}',
  target_occupations TEXT[] DEFAULT '{}',
  
  -- Budget & Schedule
  daily_budget_credits INTEGER DEFAULT 0,
  total_budget_credits INTEGER DEFAULT 0,
  spent_credits INTEGER DEFAULT 0,
  cost_per_impression INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Metrics
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create ad_impressions tracking table
CREATE TABLE IF NOT EXISTS public.ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID REFERENCES feed_ads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  impression_date DATE DEFAULT CURRENT_DATE,
  impressions_count INTEGER DEFAULT 1,
  clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ad_id, user_id, impression_date)
);

-- 3. Enhance user_interests table with source tracking and decay
ALTER TABLE user_interests ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE user_interests ADD COLUMN IF NOT EXISTS decay_factor REAL DEFAULT 1.0;
ALTER TABLE user_interests ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ DEFAULT now();

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feed_ads_active ON feed_ads(is_active, approval_status) WHERE is_active = true AND approval_status = 'approved';
CREATE INDEX IF NOT EXISTS idx_feed_ads_targeting ON feed_ads USING GIN(target_countries, target_interests);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_user_date ON ad_impressions(user_id, impression_date);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_date ON ad_impressions(ad_id, impression_date);

-- 5. Enable RLS on new tables
ALTER TABLE feed_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed_ads
CREATE POLICY "Anyone can view active approved ads"
  ON feed_ads FOR SELECT
  USING (is_active = true AND approval_status = 'approved');

CREATE POLICY "Advertisers can manage their own ads"
  ON feed_ads FOR ALL
  USING (auth.uid() = advertiser_id);

-- RLS Policies for ad_impressions
CREATE POLICY "Users can view their own impressions"
  ON ad_impressions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert impressions"
  ON ad_impressions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PHASE 2: DATABASE FUNCTIONS
-- =============================================

-- 6. Get Explore/Discovery Feed (content outside user's bubble)
CREATE OR REPLACE FUNCTION get_explore_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  post_id UUID,
  user_id UUID,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  media_urls TEXT[],
  media_types TEXT[],
  created_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER,
  views_count INTEGER,
  refeeds_count INTEGER,
  location TEXT,
  post_type TEXT,
  original_post_id UUID,
  is_promoted BOOLEAN,
  discovery_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH followed_users AS (
    SELECT following_id FROM follows WHERE follower_id = p_user_id
  ),
  viewed_today AS (
    SELECT pvh.post_id FROM post_view_history pvh 
    WHERE pvh.user_id = p_user_id AND pvh.view_date = CURRENT_DATE
  ),
  trending_posts AS (
    SELECT 
      p.id,
      p.user_id,
      p.content,
      p.media_url,
      p.media_type,
      p.media_urls,
      p.media_types,
      p.created_at,
      COALESCE(p.likes_count, 0) as likes_count,
      COALESCE(p.comments_count, 0) as comments_count,
      COALESCE(p.views_count, 0) as views_count,
      COALESCE(p.refeeds_count, 0) as refeeds_count,
      p.location,
      p.post_type,
      p.original_post_id,
      EXISTS(SELECT 1 FROM post_promotions pp WHERE pp.post_id = p.id AND pp.status = 'active') as is_promoted,
      -- Discovery score: engagement ratio + recency + randomization
      (
        (COALESCE(p.likes_count, 0) + COALESCE(p.comments_count, 0) * 2 + COALESCE(p.refeeds_count, 0) * 3)::REAL / 
        GREATEST(COALESCE(p.views_count, 1), 1)::REAL * 100 +
        -- Recency bonus (posts from last 48 hours get boost)
        CASE WHEN p.created_at > NOW() - INTERVAL '48 hours' THEN 50 ELSE 0 END +
        -- Random factor for variety
        (random() * 30)
      ) as discovery_score
    FROM posts p
    WHERE 
      p.user_id != p_user_id
      AND p.user_id NOT IN (SELECT following_id FROM followed_users)
      AND p.id NOT IN (SELECT vt.post_id FROM viewed_today vt)
      AND p.created_at > NOW() - INTERVAL '30 days'
      AND NOT EXISTS (SELECT 1 FROM blocked_users bu WHERE 
        (bu.blocker_id = p_user_id AND bu.blocked_id = p.user_id) OR
        (bu.blocker_id = p.user_id AND bu.blocked_id = p_user_id)
      )
  )
  SELECT 
    tp.id,
    tp.user_id,
    tp.content,
    tp.media_url,
    tp.media_type,
    tp.media_urls,
    tp.media_types,
    tp.created_at,
    tp.likes_count,
    tp.comments_count,
    tp.views_count,
    tp.refeeds_count,
    tp.location,
    tp.post_type,
    tp.original_post_id,
    tp.is_promoted,
    tp.discovery_score
  FROM trending_posts tp
  ORDER BY tp.is_promoted DESC, tp.discovery_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 7. Get Targeted Ads for User
CREATE OR REPLACE FUNCTION get_targeted_ads(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE(
  ad_id UUID,
  title TEXT,
  description TEXT,
  media_url TEXT,
  media_type TEXT,
  click_url TEXT,
  relevance_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_country TEXT;
  v_user_city TEXT;
  v_user_gender TEXT;
  v_user_interests TEXT[];
  v_user_occupation TEXT;
BEGIN
  -- Get user profile data
  SELECT 
    country, city, gender, interests, occupation
  INTO 
    v_user_country, v_user_city, v_user_gender, v_user_interests, v_user_occupation
  FROM profiles
  WHERE id = p_user_id;

  RETURN QUERY
  WITH today_impressions AS (
    SELECT ai.ad_id, ai.impressions_count
    FROM ad_impressions ai
    WHERE ai.user_id = p_user_id AND ai.impression_date = CURRENT_DATE
  ),
  scored_ads AS (
    SELECT 
      fa.id,
      fa.title,
      fa.description,
      fa.media_url,
      fa.media_type,
      fa.click_url,
      (
        -- Country match: +30 points
        CASE WHEN v_user_country = ANY(fa.target_countries) OR array_length(fa.target_countries, 1) IS NULL THEN 30 ELSE 0 END +
        -- City match: +20 points
        CASE WHEN v_user_city = ANY(fa.target_cities) OR array_length(fa.target_cities, 1) IS NULL THEN 20 ELSE 0 END +
        -- Gender match: +15 points
        CASE WHEN v_user_gender = ANY(fa.target_genders) OR array_length(fa.target_genders, 1) IS NULL THEN 15 ELSE 0 END +
        -- Interest overlap: +5 points per matching interest (max 25)
        LEAST(
          (SELECT COUNT(*) FROM unnest(v_user_interests) ui WHERE ui = ANY(fa.target_interests))::INTEGER * 5,
          25
        ) +
        -- Occupation match: +10 points
        CASE WHEN v_user_occupation = ANY(fa.target_occupations) OR array_length(fa.target_occupations, 1) IS NULL THEN 10 ELSE 0 END +
        -- Random factor for variety
        (random() * 10)
      )::REAL as relevance_score
    FROM feed_ads fa
    WHERE 
      fa.is_active = true
      AND fa.approval_status = 'approved'
      AND (fa.started_at IS NULL OR fa.started_at <= NOW())
      AND (fa.expires_at IS NULL OR fa.expires_at > NOW())
      AND fa.spent_credits < fa.total_budget_credits
      -- Limit impressions per user per day (max 3 per ad)
      AND COALESCE((SELECT ti.impressions_count FROM today_impressions ti WHERE ti.ad_id = fa.id), 0) < 3
  )
  SELECT 
    sa.id,
    sa.title,
    sa.description,
    sa.media_url,
    sa.media_type,
    sa.click_url,
    sa.relevance_score
  FROM scored_ads sa
  ORDER BY sa.relevance_score DESC
  LIMIT p_limit;
END;
$$;

-- 8. Update User Interests from Engagement
CREATE OR REPLACE FUNCTION update_user_interests_from_engagement(
  p_user_id UUID,
  p_post_id UUID,
  p_engagement_type TEXT,
  p_watch_duration REAL DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weight REAL;
  v_hashtag TEXT;
  v_post_location TEXT;
BEGIN
  -- Determine weight based on engagement type
  v_weight := CASE p_engagement_type
    WHEN 'like' THEN 1.0
    WHEN 'comment' THEN 2.0
    WHEN 'share' THEN 3.0
    WHEN 'refeed' THEN 3.0
    WHEN 'save' THEN 2.5
    WHEN 'watch' THEN 
      CASE 
        WHEN p_watch_duration >= 0.8 THEN 2.0  -- Watched 80%+
        WHEN p_watch_duration >= 0.5 THEN 1.5  -- Watched 50%+
        ELSE 0.5
      END
    ELSE 0.5
  END;

  -- Get post location
  SELECT location INTO v_post_location FROM posts WHERE id = p_post_id;

  -- Update interests based on post hashtags
  FOR v_hashtag IN 
    SELECT h.name FROM hashtags h
    JOIN post_hashtags ph ON ph.hashtag_id = h.id
    WHERE ph.post_id = p_post_id
  LOOP
    INSERT INTO user_interests (user_id, interest_type, interest_value, weight, source, last_interaction)
    VALUES (p_user_id, 'hashtag', v_hashtag, v_weight, 'engagement', NOW())
    ON CONFLICT (user_id, interest_type, interest_value) 
    DO UPDATE SET 
      weight = LEAST(user_interests.weight + v_weight * 0.5, 10.0),
      last_interaction = NOW(),
      decay_factor = 1.0;
  END LOOP;

  -- Update location interest if post has location
  IF v_post_location IS NOT NULL THEN
    INSERT INTO user_interests (user_id, interest_type, interest_value, weight, source, last_interaction)
    VALUES (p_user_id, 'location', v_post_location, v_weight * 0.5, 'engagement', NOW())
    ON CONFLICT (user_id, interest_type, interest_value) 
    DO UPDATE SET 
      weight = LEAST(user_interests.weight + v_weight * 0.3, 10.0),
      last_interaction = NOW(),
      decay_factor = 1.0;
  END IF;
END;
$$;

-- 9. Check and Reset Viewed Posts Cycle
CREATE OR REPLACE FUNCTION reset_viewed_posts_cycle(p_user_id UUID)
RETURNS TABLE(was_reset BOOLEAN, total_posts BIGINT, viewed_posts BIGINT, coverage_percent REAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_posts BIGINT;
  v_viewed_posts BIGINT;
  v_coverage REAL;
BEGIN
  -- Count total available posts (last 30 days, not from blocked users)
  SELECT COUNT(*) INTO v_total_posts
  FROM posts p
  WHERE p.created_at > NOW() - INTERVAL '30 days'
    AND p.user_id != p_user_id
    AND NOT EXISTS (
      SELECT 1 FROM blocked_users bu 
      WHERE (bu.blocker_id = p_user_id AND bu.blocked_id = p.user_id)
    );

  -- Count viewed posts today
  SELECT COUNT(DISTINCT post_id) INTO v_viewed_posts
  FROM post_view_history
  WHERE user_id = p_user_id AND view_date = CURRENT_DATE;

  -- Calculate coverage
  v_coverage := CASE WHEN v_total_posts > 0 
    THEN (v_viewed_posts::REAL / v_total_posts::REAL) * 100 
    ELSE 0 
  END;

  -- Reset if coverage > 90%
  IF v_coverage >= 90 THEN
    DELETE FROM post_view_history 
    WHERE user_id = p_user_id AND view_date = CURRENT_DATE;
    
    RETURN QUERY SELECT true, v_total_posts, v_viewed_posts, v_coverage;
  ELSE
    RETURN QUERY SELECT false, v_total_posts, v_viewed_posts, v_coverage;
  END IF;
END;
$$;

-- 10. Apply interest decay (to be called periodically)
CREATE OR REPLACE FUNCTION apply_interest_decay()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Decay interests not interacted with in 7+ days
  UPDATE user_interests
  SET 
    decay_factor = GREATEST(decay_factor * 0.9, 0.1),
    weight = weight * 0.95
  WHERE last_interaction < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  -- Delete interests with very low weight
  DELETE FROM user_interests WHERE weight < 0.1;
  
  RETURN v_updated;
END;
$$;

-- 11. Trigger to update feed_ads metrics
CREATE OR REPLACE FUNCTION update_ad_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE feed_ads
  SET 
    impressions = impressions + 1,
    spent_credits = spent_credits + cost_per_impression,
    ctr = CASE WHEN impressions > 0 THEN clicks::REAL / impressions::REAL ELSE 0 END,
    updated_at = NOW()
  WHERE id = NEW.ad_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_ad_metrics ON ad_impressions;
CREATE TRIGGER trigger_update_ad_metrics
  AFTER INSERT ON ad_impressions
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_metrics();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_explore_feed TO authenticated;
GRANT EXECUTE ON FUNCTION get_targeted_ads TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_interests_from_engagement TO authenticated;
GRANT EXECUTE ON FUNCTION reset_viewed_posts_cycle TO authenticated;