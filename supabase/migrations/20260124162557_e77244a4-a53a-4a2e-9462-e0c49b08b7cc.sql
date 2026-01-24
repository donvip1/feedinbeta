
-- ============================================================================
-- FEEDIN COMPLETE FEED SYSTEM v2.0
-- Comprehensive feed rotation, personalization, and ad insertion engine
-- ============================================================================

-- ============================================================================
-- 1. CORE TABLES (ensure they exist with proper structure)
-- ============================================================================

-- user_seen_posts: Tracks which posts each user has viewed and when
-- This is the foundation of the non-repetition system
CREATE TABLE IF NOT EXISTS user_seen_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seen_date DATE NOT NULL DEFAULT CURRENT_DATE,
  media_type TEXT, -- Track what type of content user viewed
  watch_time_seconds INTEGER DEFAULT 0, -- For video engagement tracking
  UNIQUE(user_id, post_id, seen_date)
);

-- user_ad_impressions: Tracks which ads each user has seen
CREATE TABLE IF NOT EXISTS user_ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ad_id UUID NOT NULL REFERENCES feed_ads(id) ON DELETE CASCADE,
  impression_date DATE NOT NULL DEFAULT CURRENT_DATE,
  impressions_count INTEGER DEFAULT 1,
  clicked BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, ad_id, impression_date)
);

-- feed_cycle_status: Tracks user's position in the feed cycle
CREATE TABLE IF NOT EXISTS feed_cycle_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  last_session_id TEXT,
  last_post_position INTEGER DEFAULT 0,
  cycle_started_at TIMESTAMPTZ DEFAULT NOW(),
  cycle_reset_count INTEGER DEFAULT 0,
  last_reset_at TIMESTAMPTZ,
  total_posts_available INTEGER DEFAULT 0,
  posts_viewed_in_cycle INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_seen_posts_user_date ON user_seen_posts(user_id, seen_date);
CREATE INDEX IF NOT EXISTS idx_user_seen_posts_post ON user_seen_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_user_ad_impressions_user_date ON user_ad_impressions(user_id, impression_date);
CREATE INDEX IF NOT EXISTS idx_feed_cycle_status_user ON feed_cycle_status(user_id);

-- Enable RLS
ALTER TABLE user_seen_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_cycle_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage own seen posts" ON user_seen_posts;
CREATE POLICY "Users can manage own seen posts" ON user_seen_posts
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own ad impressions" ON user_ad_impressions;
CREATE POLICY "Users can manage own ad impressions" ON user_ad_impressions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own cycle status" ON feed_cycle_status;
CREATE POLICY "Users can manage own cycle status" ON feed_cycle_status
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. HELPER FUNCTION: filter_seen_posts
-- Excludes posts already seen today by the user
-- ============================================================================
CREATE OR REPLACE FUNCTION filter_seen_posts(
  p_user_id UUID,
  p_post_ids UUID[]
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unseen_ids UUID[];
BEGIN
  -- Return only post IDs that haven't been seen today
  SELECT ARRAY_AGG(pid)
  INTO v_unseen_ids
  FROM UNNEST(p_post_ids) AS pid
  WHERE pid NOT IN (
    SELECT post_id 
    FROM user_seen_posts 
    WHERE user_id = p_user_id 
      AND seen_date = CURRENT_DATE
  );
  
  RETURN COALESCE(v_unseen_ids, ARRAY[]::UUID[]);
END;
$$;

-- ============================================================================
-- 3. HELPER FUNCTION: prioritize_new_posts
-- Orders posts with new posts (last 24h) first, then older posts
-- ============================================================================
CREATE OR REPLACE FUNCTION prioritize_new_posts(
  p_post_ids UUID[]
)
RETURNS TABLE(
  post_id UUID,
  is_new BOOLEAN,
  age_hours INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS post_id,
    (p.created_at > NOW() - INTERVAL '24 hours') AS is_new,
    EXTRACT(EPOCH FROM (NOW() - p.created_at))::INTEGER / 3600 AS age_hours
  FROM posts p
  WHERE p.id = ANY(p_post_ids)
  ORDER BY 
    (p.created_at > NOW() - INTERVAL '24 hours') DESC,  -- New posts first
    p.created_at DESC;                                   -- Then by recency
END;
$$;

-- ============================================================================
-- 4. HELPER FUNCTION: randomize_feed_order
-- Shuffles posts in random order when restarting cycle
-- ============================================================================
CREATE OR REPLACE FUNCTION randomize_feed_order(
  p_post_ids UUID[]
)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return posts in random order using a random sort
  RETURN ARRAY(
    SELECT pid 
    FROM UNNEST(p_post_ids) AS pid
    ORDER BY RANDOM()
  );
END;
$$;

-- ============================================================================
-- 5. MAIN FUNCTION: get_feed
-- Fetches personalized feed posts with complete rotation logic
-- ============================================================================
CREATE OR REPLACE FUNCTION get_feed(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_media_filter TEXT DEFAULT 'all',  -- 'all', 'video', 'photo'
  p_include_trending BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(
  id UUID,
  post_user_id UUID,
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
  relevance_score REAL,
  is_new_post BOOLEAN,
  is_promoted BOOLEAN,
  is_trending BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_interests TEXT[];
  v_preferred_media TEXT;
  v_viewed_today UUID[];
  v_total_available INTEGER;
  v_viewed_count INTEGER;
  v_cycle_needs_reset BOOLEAN;
BEGIN
  -- ========================================
  -- Step 1: Get user preferences and interests
  -- ========================================
  
  -- Get user's top interests (hashtags they engage with)
  SELECT ARRAY_AGG(DISTINCT interest_value)
  INTO v_user_interests
  FROM user_interests
  WHERE user_id = p_user_id
    AND interest_type = 'hashtag'
  ORDER BY interest_score DESC
  LIMIT 20;
  
  -- Get user's preferred media type based on watch behavior
  SELECT 
    CASE 
      WHEN COALESCE(SUM(video_watch_time), 0) > COALESCE(SUM(image_view_count), 0) * 10 
      THEN 'video'
      ELSE 'photo'
    END
  INTO v_preferred_media
  FROM user_media_preferences
  WHERE user_id = p_user_id;
  
  -- ========================================
  -- Step 2: Get posts already seen today
  -- ========================================
  SELECT ARRAY_AGG(post_id)
  INTO v_viewed_today
  FROM user_seen_posts
  WHERE user_id = p_user_id
    AND seen_date = CURRENT_DATE;
  
  v_viewed_today := COALESCE(v_viewed_today, ARRAY[]::UUID[]);
  v_viewed_count := array_length(v_viewed_today, 1);
  
  -- ========================================
  -- Step 3: Check if cycle needs reset
  -- (User has seen >85% of available posts)
  -- ========================================
  SELECT COUNT(*) INTO v_total_available
  FROM posts 
  WHERE status = 'active'
    AND (p_media_filter = 'all' 
         OR (p_media_filter = 'video' AND posts.media_type = 'video')
         OR (p_media_filter = 'photo' AND posts.media_type IN ('image', 'photo', 'styled_text')));
  
  v_cycle_needs_reset := (
    v_total_available > 0 
    AND COALESCE(v_viewed_count, 0)::REAL / v_total_available::REAL > 0.85
  );
  
  -- ========================================
  -- Step 4: If cycle reset needed, clear today's view history
  -- and update cycle status
  -- ========================================
  IF v_cycle_needs_reset THEN
    -- Clear today's view history to restart cycle
    DELETE FROM user_seen_posts
    WHERE user_id = p_user_id
      AND seen_date = CURRENT_DATE;
    
    -- Update cycle status
    INSERT INTO feed_cycle_status (user_id, cycle_reset_count, last_reset_at, posts_viewed_in_cycle)
    VALUES (p_user_id, 1, NOW(), 0)
    ON CONFLICT (user_id) DO UPDATE SET
      cycle_reset_count = feed_cycle_status.cycle_reset_count + 1,
      last_reset_at = NOW(),
      posts_viewed_in_cycle = 0,
      updated_at = NOW();
    
    -- Clear the viewed array since we reset
    v_viewed_today := ARRAY[]::UUID[];
  END IF;
  
  -- ========================================
  -- Step 5: Build and return personalized feed
  -- ========================================
  RETURN QUERY
  WITH 
  -- Get blocked users
  blocked_users_cte AS (
    SELECT bu.blocked_id AS uid FROM blocked_users bu WHERE bu.blocker_id = p_user_id
    UNION
    SELECT bu2.blocker_id AS uid FROM blocked_users bu2 WHERE bu2.blocked_id = p_user_id
  ),
  
  -- Get following users for boost
  following_cte AS (
    SELECT f.following_id AS uid FROM follows f WHERE f.follower_id = p_user_id
  ),
  
  -- Get promoted posts
  promoted_cte AS (
    SELECT 
      pp.post_id,
      pp.is_active
    FROM post_promotions pp
    WHERE pp.is_active = TRUE
      AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
  ),
  
  -- Score all eligible posts
  scored_posts_cte AS (
    SELECT 
      p.id,
      p.user_id AS post_user_id,
      p.content,
      p.media_url,
      p.media_type,
      p.media_urls,
      p.media_types,
      p.created_at,
      COALESCE(p.likes_count, 0) AS likes_count,
      COALESCE(p.comments_count, 0) AS comments_count,
      COALESCE(p.views_count, 0) AS views_count,
      COALESCE(p.refeeds_count, 0) AS refeeds_count,
      p.location,
      p.post_type,
      p.original_post_id,
      
      -- Calculate relevance score
      (
        -- Engagement score (likes, comments, views)
        COALESCE(p.likes_count, 0) * 0.3 +
        COALESCE(p.comments_count, 0) * 0.5 +
        COALESCE(p.views_count, 0) * 0.01 +
        
        -- Recency boost (50 points for last 24h, 25 for last 48h)
        CASE 
          WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 50
          WHEN p.created_at > NOW() - INTERVAL '48 hours' THEN 25
          ELSE 0 
        END +
        
        -- Following boost
        CASE WHEN p.user_id IN (SELECT uid FROM following_cte) THEN 20 ELSE 0 END +
        
        -- Preferred media type boost
        CASE 
          WHEN v_preferred_media = 'video' AND p.media_type = 'video' THEN 15
          WHEN v_preferred_media = 'photo' AND p.media_type IN ('image', 'photo') THEN 15
          ELSE 0 
        END +
        
        -- Promoted boost
        CASE WHEN EXISTS (SELECT 1 FROM promoted_cte pr WHERE pr.post_id = p.id) THEN 100 ELSE 0 END +
        
        -- Random factor for variety (0-10)
        RANDOM() * 10
      )::REAL AS relevance_score,
      
      -- Flags
      (p.created_at > NOW() - INTERVAL '24 hours') AS is_new_post,
      EXISTS (SELECT 1 FROM promoted_cte pr WHERE pr.post_id = p.id) AS is_promoted,
      (COALESCE(p.views_count, 0) > 1000 OR COALESCE(p.likes_count, 0) > 100) AS is_trending
      
    FROM posts p
    WHERE p.status = 'active'
      -- Exclude blocked users
      AND p.user_id NOT IN (SELECT uid FROM blocked_users_cte)
      -- Exclude already seen posts
      AND p.id != ALL(v_viewed_today)
      -- Apply media filter
      AND (
        p_media_filter = 'all'
        OR (p_media_filter = 'video' AND p.media_type = 'video')
        OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text', 'text'))
      )
  )
  
  SELECT 
    sp.id,
    sp.post_user_id,
    sp.content,
    sp.media_url,
    sp.media_type,
    sp.media_urls,
    sp.media_types,
    sp.created_at,
    sp.likes_count,
    sp.comments_count,
    sp.views_count,
    sp.refeeds_count,
    sp.location,
    sp.post_type,
    sp.original_post_id,
    sp.relevance_score,
    sp.is_new_post,
    sp.is_promoted,
    sp.is_trending
  FROM scored_posts_cte sp
  ORDER BY 
    sp.is_new_post DESC,           -- New posts always first
    sp.is_promoted DESC,           -- Then promoted posts
    CASE WHEN v_cycle_needs_reset THEN RANDOM() ELSE sp.relevance_score END DESC,  -- Random if cycle reset, else by score
    sp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================================
-- 6. FUNCTION: record_post_view
-- Records when a user views a post (for non-repetition tracking)
-- ============================================================================
CREATE OR REPLACE FUNCTION record_post_view(
  p_user_id UUID,
  p_post_id UUID,
  p_media_type TEXT DEFAULT NULL,
  p_watch_time INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update the view record
  INSERT INTO user_seen_posts (user_id, post_id, seen_date, media_type, watch_time_seconds)
  VALUES (p_user_id, p_post_id, CURRENT_DATE, p_media_type, p_watch_time)
  ON CONFLICT (user_id, post_id, seen_date) DO UPDATE SET
    watch_time_seconds = user_seen_posts.watch_time_seconds + EXCLUDED.watch_time_seconds,
    seen_at = NOW();
  
  -- Update cycle status
  INSERT INTO feed_cycle_status (user_id, posts_viewed_in_cycle)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    posts_viewed_in_cycle = feed_cycle_status.posts_viewed_in_cycle + 1,
    updated_at = NOW();
  
  -- Track media preference
  IF p_media_type IS NOT NULL THEN
    INSERT INTO user_media_preferences (user_id, media_type, video_watch_time, image_view_count, last_updated)
    VALUES (
      p_user_id, 
      p_media_type,
      CASE WHEN p_media_type = 'video' THEN p_watch_time ELSE 0 END,
      CASE WHEN p_media_type IN ('image', 'photo') THEN 1 ELSE 0 END,
      NOW()
    )
    ON CONFLICT (user_id, media_type) DO UPDATE SET
      video_watch_time = user_media_preferences.video_watch_time + EXCLUDED.video_watch_time,
      image_view_count = user_media_preferences.image_view_count + EXCLUDED.image_view_count,
      last_updated = NOW();
  END IF;
END;
$$;

-- ============================================================================
-- 7. FUNCTION: insert_ads
-- Gets targeted ads based on user interests and inserts at intervals
-- ============================================================================
CREATE OR REPLACE FUNCTION insert_ads(
  p_user_id UUID,
  p_ad_count INTEGER DEFAULT 4,
  p_user_interests TEXT[] DEFAULT NULL
)
RETURNS TABLE(
  ad_id UUID,
  title TEXT,
  description TEXT,
  media_url TEXT,
  media_type TEXT,
  click_url TEXT,
  advertiser_name TEXT,
  priority INTEGER,
  is_ad BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Get ads already shown today
  shown_today AS (
    SELECT uai.ad_id AS aid
    FROM user_ad_impressions uai
    WHERE uai.user_id = p_user_id
      AND uai.impression_date = CURRENT_DATE
  ),
  
  -- Score ads by relevance to user interests
  scored_ads AS (
    SELECT 
      fa.id AS ad_id,
      fa.title,
      fa.description,
      fa.media_url,
      fa.media_type,
      fa.click_url,
      fa.advertiser_name,
      fa.priority,
      TRUE AS is_ad,
      -- Score based on targeting match
      (
        COALESCE(fa.priority, 1) * 10 +
        CASE 
          WHEN p_user_interests IS NOT NULL 
               AND fa.target_interests IS NOT NULL
               AND fa.target_interests && p_user_interests THEN 50
          ELSE 0
        END +
        RANDOM() * 5
      ) AS ad_score
    FROM feed_ads fa
    WHERE fa.is_active = TRUE
      AND (fa.expires_at IS NULL OR fa.expires_at > NOW())
      AND (fa.starts_at IS NULL OR fa.starts_at <= NOW())
      AND fa.id NOT IN (SELECT aid FROM shown_today)
      AND (
        fa.daily_budget IS NULL 
        OR fa.spent_today < fa.daily_budget
      )
  )
  
  SELECT 
    sa.ad_id,
    sa.title,
    sa.description,
    sa.media_url,
    sa.media_type,
    sa.click_url,
    sa.advertiser_name,
    sa.priority::INTEGER,
    sa.is_ad
  FROM scored_ads sa
  ORDER BY sa.ad_score DESC
  LIMIT p_ad_count;
END;
$$;

-- ============================================================================
-- 8. FUNCTION: record_ad_impression
-- Records when a user sees an ad
-- ============================================================================
CREATE OR REPLACE FUNCTION record_ad_impression(
  p_user_id UUID,
  p_ad_id UUID,
  p_clicked BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_ad_impressions (user_id, ad_id, impression_date, impressions_count, clicked)
  VALUES (p_user_id, p_ad_id, CURRENT_DATE, 1, p_clicked)
  ON CONFLICT (user_id, ad_id, impression_date) DO UPDATE SET
    impressions_count = user_ad_impressions.impressions_count + 1,
    clicked = user_ad_impressions.clicked OR EXCLUDED.clicked;
  
  -- Update ad spent counter
  UPDATE feed_ads
  SET spent_today = COALESCE(spent_today, 0) + 1
  WHERE id = p_ad_id;
END;
$$;

-- ============================================================================
-- 9. FUNCTION: get_feed_with_ads
-- Complete feed with ads inserted at intervals
-- ============================================================================
CREATE OR REPLACE FUNCTION get_feed_with_ads(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_media_filter TEXT DEFAULT 'all',
  p_ad_frequency INTEGER DEFAULT 5
)
RETURNS TABLE(
  item_id UUID,
  item_type TEXT,  -- 'post' or 'ad'
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  media_urls TEXT[],
  media_types TEXT[],
  created_at TIMESTAMPTZ,
  likes_count INTEGER,
  comments_count INTEGER,
  views_count INTEGER,
  click_url TEXT,
  advertiser_name TEXT,
  post_user_id UUID,
  relevance_score REAL,
  is_new_post BOOLEAN,
  is_promoted BOOLEAN,
  display_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_interests TEXT[];
  v_post_row RECORD;
  v_ad_row RECORD;
  v_order_counter INTEGER := 0;
  v_post_counter INTEGER := 0;
  v_ads_cursor CURSOR FOR 
    SELECT * FROM insert_ads(p_user_id, p_limit / p_ad_frequency + 1, v_user_interests);
  v_current_ad RECORD;
  v_ads_used INTEGER := 0;
BEGIN
  -- Get user interests
  SELECT ARRAY_AGG(interest_value)
  INTO v_user_interests
  FROM user_interests
  WHERE user_id = p_user_id
    AND interest_type = 'hashtag'
  LIMIT 20;
  
  -- Open ads cursor
  OPEN v_ads_cursor;
  FETCH v_ads_cursor INTO v_current_ad;
  
  -- Iterate through posts and insert ads
  FOR v_post_row IN 
    SELECT * FROM get_feed(p_user_id, p_limit, p_offset, p_media_filter, TRUE)
  LOOP
    v_post_counter := v_post_counter + 1;
    v_order_counter := v_order_counter + 1;
    
    -- Return the post
    item_id := v_post_row.id;
    item_type := 'post';
    content := v_post_row.content;
    media_url := v_post_row.media_url;
    media_type := v_post_row.media_type;
    media_urls := v_post_row.media_urls;
    media_types := v_post_row.media_types;
    created_at := v_post_row.created_at;
    likes_count := v_post_row.likes_count;
    comments_count := v_post_row.comments_count;
    views_count := v_post_row.views_count;
    click_url := NULL;
    advertiser_name := NULL;
    post_user_id := v_post_row.post_user_id;
    relevance_score := v_post_row.relevance_score;
    is_new_post := v_post_row.is_new_post;
    is_promoted := v_post_row.is_promoted;
    display_order := v_order_counter;
    RETURN NEXT;
    
    -- Insert ad every p_ad_frequency posts
    IF v_post_counter % p_ad_frequency = 0 AND v_current_ad IS NOT NULL THEN
      v_order_counter := v_order_counter + 1;
      
      item_id := v_current_ad.ad_id;
      item_type := 'ad';
      content := v_current_ad.title;
      media_url := v_current_ad.media_url;
      media_type := v_current_ad.media_type;
      media_urls := NULL;
      media_types := NULL;
      created_at := NOW();
      likes_count := 0;
      comments_count := 0;
      views_count := 0;
      click_url := v_current_ad.click_url;
      advertiser_name := v_current_ad.advertiser_name;
      post_user_id := NULL;
      relevance_score := 0;
      is_new_post := FALSE;
      is_promoted := FALSE;
      display_order := v_order_counter;
      RETURN NEXT;
      
      FETCH v_ads_cursor INTO v_current_ad;
    END IF;
  END LOOP;
  
  CLOSE v_ads_cursor;
END;
$$;

-- ============================================================================
-- 10. FUNCTION: get_feed_status
-- Returns user's current feed cycle status
-- ============================================================================
CREATE OR REPLACE FUNCTION get_feed_status(
  p_user_id UUID
)
RETURNS TABLE(
  total_posts_available INTEGER,
  posts_viewed_today INTEGER,
  cycle_reset_count INTEGER,
  last_reset_at TIMESTAMPTZ,
  viewing_progress_percent REAL,
  needs_cycle_reset BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_viewed INTEGER;
BEGIN
  -- Get total available posts
  SELECT COUNT(*) INTO v_total
  FROM posts WHERE status = 'active';
  
  -- Get posts viewed today
  SELECT COUNT(*) INTO v_viewed
  FROM user_seen_posts
  WHERE user_id = p_user_id
    AND seen_date = CURRENT_DATE;
  
  RETURN QUERY
  SELECT 
    v_total AS total_posts_available,
    v_viewed AS posts_viewed_today,
    COALESCE(fcs.cycle_reset_count, 0) AS cycle_reset_count,
    fcs.last_reset_at,
    CASE WHEN v_total > 0 THEN (v_viewed::REAL / v_total::REAL * 100) ELSE 0 END AS viewing_progress_percent,
    (v_total > 0 AND v_viewed::REAL / v_total::REAL > 0.85) AS needs_cycle_reset
  FROM feed_cycle_status fcs
  WHERE fcs.user_id = p_user_id
  UNION ALL
  SELECT 
    v_total,
    v_viewed,
    0,
    NULL,
    CASE WHEN v_total > 0 THEN (v_viewed::REAL / v_total::REAL * 100) ELSE 0 END,
    (v_total > 0 AND v_viewed::REAL / v_total::REAL > 0.85)
  WHERE NOT EXISTS (SELECT 1 FROM feed_cycle_status WHERE user_id = p_user_id)
  LIMIT 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION filter_seen_posts(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION prioritize_new_posts(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION randomize_feed_order(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_feed(UUID, INTEGER, INTEGER, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION record_post_view(UUID, UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_ads(UUID, INTEGER, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION record_ad_impression(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_feed_with_ads(UUID, INTEGER, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_feed_status(UUID) TO authenticated;
