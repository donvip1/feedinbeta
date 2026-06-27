-- =============================================
-- ENHANCED FEED SYSTEM - Database Schema
-- =============================================

-- 1. User Feed Sessions Table
-- Tracks user's current position in the feed to ensure different starting point on return
CREATE TABLE IF NOT EXISTS public.user_feed_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  last_position INTEGER DEFAULT 0,
  feed_type TEXT DEFAULT 'forYou',
  posts_viewed_this_session INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint per user per feed type (only one active session per feed type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_feed_sessions_active 
  ON public.user_feed_sessions(user_id, feed_type);

CREATE INDEX IF NOT EXISTS idx_user_feed_sessions_user 
  ON public.user_feed_sessions(user_id);

-- 2. User Media Preferences Table
-- Tracks what type of content (video/photo/text) user engages with most
CREATE TABLE IF NOT EXISTS public.user_media_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_watch_seconds REAL DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  photo_view_count INTEGER DEFAULT 0,
  text_view_count INTEGER DEFAULT 0,
  video_completion_rate REAL DEFAULT 0,
  preferred_media_type TEXT DEFAULT 'all',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_media_preferences_user 
  ON public.user_media_preferences(user_id);

-- 3. Add columns to existing tables
ALTER TABLE public.user_engagement_signals 
  ADD COLUMN IF NOT EXISTS media_type TEXT;

ALTER TABLE public.post_view_history 
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS session_id UUID;

-- =============================================
-- CORE FUNCTIONS
-- =============================================

-- 4. Track Media Preference Function
-- Called when user views/engages with content to learn their preferences
CREATE OR REPLACE FUNCTION public.track_media_preference(
  p_user_id UUID,
  p_media_type TEXT,
  p_watch_duration REAL DEFAULT NULL,
  p_completed BOOLEAN DEFAULT FALSE
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_views INTEGER;
  v_video_ratio REAL;
  v_photo_ratio REAL;
  v_preferred TEXT;
BEGIN
  -- Upsert media preference record
  INSERT INTO user_media_preferences (user_id, updated_at)
  VALUES (p_user_id, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Update based on media type
  IF p_media_type = 'video' THEN
    UPDATE user_media_preferences
    SET 
      video_watch_seconds = video_watch_seconds + COALESCE(p_watch_duration, 5),
      video_count = video_count + 1,
      video_completion_rate = CASE 
        WHEN p_completed THEN (video_completion_rate * video_count + 1) / (video_count + 1)
        ELSE (video_completion_rate * video_count) / GREATEST(video_count + 1, 1)
      END,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_media_type IN ('image', 'photo') THEN
    UPDATE user_media_preferences
    SET 
      photo_view_count = photo_view_count + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE user_media_preferences
    SET 
      text_view_count = text_view_count + 1,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Calculate preferred media type
  SELECT video_count, photo_view_count, text_view_count
  INTO v_total_views, v_video_ratio, v_photo_ratio
  FROM user_media_preferences
  WHERE user_id = p_user_id;

  v_total_views := COALESCE(v_total_views, 0) + COALESCE(v_video_ratio::INTEGER, 0) + COALESCE(v_photo_ratio::INTEGER, 0);
  
  IF v_total_views > 10 THEN
    SELECT 
      CASE 
        WHEN video_count::REAL / GREATEST(v_total_views, 1) > 0.6 THEN 'video'
        WHEN photo_view_count::REAL / GREATEST(v_total_views, 1) > 0.6 THEN 'photo'
        ELSE 'all'
      END INTO v_preferred
    FROM user_media_preferences
    WHERE user_id = p_user_id;

    UPDATE user_media_preferences
    SET preferred_media_type = COALESCE(v_preferred, 'all')
    WHERE user_id = p_user_id;
  END IF;
END;
$$;

-- 5. Get Feed With Rotation
-- Main feed function with session awareness, new-first ordering, and viewed exclusion
CREATE OR REPLACE FUNCTION public.get_feed_with_rotation(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_feed_type TEXT DEFAULT 'forYou',
  p_media_filter TEXT DEFAULT 'all'
) RETURNS TABLE(
  id UUID,
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
  relevance_score REAL,
  is_new_post BOOLEAN,
  is_promoted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_offset INTEGER := 0;
  v_media_pref TEXT := 'all';
BEGIN
  -- Get user's session offset for rotation (different starting point on return)
  SELECT COALESCE(last_position, 0) INTO v_session_offset
  FROM user_feed_sessions
  WHERE user_feed_sessions.user_id = p_user_id AND feed_type = p_feed_type;

  -- Get user's media preference for boosting
  SELECT COALESCE(preferred_media_type, 'all') INTO v_media_pref
  FROM user_media_preferences
  WHERE user_media_preferences.user_id = p_user_id;

  RETURN QUERY
  WITH 
  -- Posts viewed today - exclude these
  viewed_today AS (
    SELECT post_id 
    FROM post_view_history 
    WHERE post_view_history.user_id = p_user_id 
      AND viewed_at >= CURRENT_DATE
  ),
  -- User's interests for scoring
  user_interest_tags AS (
    SELECT h.name, ui.interest_score
    FROM user_interests ui
    JOIN hashtags h ON h.id = ui.hashtag_id
    WHERE ui.user_id = p_user_id
  ),
  -- Blocked users to exclude
  blocked AS (
    SELECT blocked_id FROM blocked_users WHERE blocker_id = p_user_id
    UNION
    SELECT blocker_id FROM blocked_users WHERE blocked_id = p_user_id
  ),
  -- Following list for Following feed
  following_ids AS (
    SELECT following_id FROM follows WHERE follower_id = p_user_id
  ),
  -- All eligible posts with scoring
  scored_posts AS (
    SELECT 
      p.id,
      p.user_id,
      p.content,
      p.media_url,
      p.media_type,
      p.media_urls,
      p.media_types,
      p.created_at,
      p.likes_count,
      p.comments_count,
      p.views_count,
      p.refeeds_count,
      p.location,
      p.post_type,
      p.original_post_id,
      -- Calculate relevance score
      (
        -- Base engagement score
        COALESCE(p.likes_count, 0) * 0.3 +
        COALESCE(p.comments_count, 0) * 0.5 +
        COALESCE(p.views_count, 0) * 0.01 +
        -- Recency boost (posts from last 24h get bonus)
        CASE WHEN p.created_at > NOW() - INTERVAL '24 hours' THEN 50 ELSE 0 END +
        -- Interest matching boost
        COALESCE((
          SELECT SUM(uit.interest_score * 10)
          FROM user_interest_tags uit
          WHERE p.content ILIKE '%' || uit.name || '%'
        ), 0) +
        -- Media preference boost
        CASE 
          WHEN v_media_pref = 'video' AND p.media_type = 'video' THEN 20
          WHEN v_media_pref = 'photo' AND p.media_type IN ('image', 'photo') THEN 20
          ELSE 0
        END +
        -- Promoted content boost
        CASE WHEN p.is_promoted = true THEN 30 ELSE 0 END
      )::REAL AS relevance_score,
      -- Flag if this is a new post (within 24 hours)
      (p.created_at > NOW() - INTERVAL '24 hours') AS is_new_post,
      COALESCE(p.is_promoted, false) AS is_promoted
    FROM posts p
    WHERE p.status = 'active'
      AND p.user_id NOT IN (SELECT blocked_id FROM blocked)
      AND p.id NOT IN (SELECT post_id FROM viewed_today)
      -- Media filter
      AND (
        p_media_filter = 'all'
        OR (p_media_filter = 'video' AND p.media_type = 'video')
        OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text'))
      )
      -- Feed type filter
      AND (
        p_feed_type = 'forYou'
        OR (p_feed_type = 'following' AND p.user_id IN (SELECT following_id FROM following_ids))
        OR (p_feed_type = 'explore' AND p.user_id NOT IN (SELECT following_id FROM following_ids) AND p.user_id != p_user_id)
      )
  )
  -- Return new posts first (sorted by relevance), then old posts
  SELECT 
    sp.id,
    sp.user_id,
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
    sp.is_promoted
  FROM scored_posts sp
  ORDER BY 
    sp.is_new_post DESC,  -- New posts first
    sp.relevance_score DESC,
    sp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset + v_session_offset;
END;
$$;

-- 6. Get Randomized Feed Cycle
-- Called when user has seen most posts - returns shuffled posts for fresh experience
CREATE OR REPLACE FUNCTION public.get_randomized_feed_cycle(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_media_filter TEXT DEFAULT 'all'
) RETURNS TABLE(
  id UUID,
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
  is_promoted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH blocked AS (
    SELECT blocked_id FROM blocked_users WHERE blocker_id = p_user_id
    UNION
    SELECT blocker_id FROM blocked_users WHERE blocked_id = p_user_id
  )
  SELECT 
    p.id,
    p.user_id,
    p.content,
    p.media_url,
    p.media_type,
    p.media_urls,
    p.media_types,
    p.created_at,
    p.likes_count,
    p.comments_count,
    p.views_count,
    p.refeeds_count,
    p.location,
    p.post_type,
    p.original_post_id,
    COALESCE(p.is_promoted, false) AS is_promoted
  FROM posts p
  WHERE p.status = 'active'
    AND p.user_id NOT IN (SELECT blocked_id FROM blocked)
    AND (
      p_media_filter = 'all'
      OR (p_media_filter = 'video' AND p.media_type = 'video')
      OR (p_media_filter = 'photo' AND p.media_type IN ('image', 'photo', 'styled_text'))
    )
  -- Randomize order using user_id + date as seed for consistency within same day
  ORDER BY md5(p.id::text || p_user_id::text || CURRENT_DATE::text)
  LIMIT p_limit;
END;
$$;

-- 7. Get Targeted Ads V2
-- Enhanced ad targeting with daily impression limits and interest matching
CREATE OR REPLACE FUNCTION public.get_targeted_ads_v2(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 3,
  p_user_interests TEXT[] DEFAULT NULL
) RETURNS TABLE(
  ad_id UUID,
  title TEXT,
  description TEXT,
  media_url TEXT,
  media_type TEXT,
  click_url TEXT,
  advertiser_name TEXT,
  priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_location TEXT;
  v_user_gender TEXT;
  v_user_age INTEGER;
  v_media_pref TEXT := 'all';
BEGIN
  -- Get user profile data for targeting
  SELECT location, gender, 
    EXTRACT(YEAR FROM AGE(COALESCE(date_of_birth, '1990-01-01'::date)))::INTEGER
  INTO v_user_location, v_user_gender, v_user_age
  FROM profiles
  WHERE profiles.id = p_user_id;

  -- Get media preference
  SELECT COALESCE(preferred_media_type, 'all') INTO v_media_pref
  FROM user_media_preferences
  WHERE user_media_preferences.user_id = p_user_id;

  RETURN QUERY
  WITH 
  -- Ads already shown today - exclude these
  shown_today AS (
    SELECT ai.ad_id 
    FROM ad_impressions ai
    WHERE ai.user_id = p_user_id 
      AND ai.impression_date = CURRENT_DATE
  ),
  -- Score and filter ads
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
      -- Targeting score
      (
        -- Location match
        CASE WHEN fa.target_locations IS NULL OR v_user_location = ANY(fa.target_locations) THEN 20 ELSE 0 END +
        -- Gender match  
        CASE WHEN fa.target_genders IS NULL OR v_user_gender = ANY(fa.target_genders) THEN 10 ELSE 0 END +
        -- Age match
        CASE WHEN fa.target_age_min IS NULL OR v_user_age >= fa.target_age_min THEN 5 ELSE 0 END +
        CASE WHEN fa.target_age_max IS NULL OR v_user_age <= fa.target_age_max THEN 5 ELSE 0 END +
        -- Interest match
        CASE 
          WHEN fa.target_interests IS NOT NULL AND p_user_interests IS NOT NULL 
            AND fa.target_interests && p_user_interests THEN 30 
          ELSE 0 
        END +
        -- Media type preference match
        CASE 
          WHEN v_media_pref = 'video' AND fa.media_type = 'video' THEN 15
          WHEN v_media_pref = 'photo' AND fa.media_type = 'image' THEN 15
          ELSE 0
        END +
        -- Priority boost
        COALESCE(fa.priority, 1) * 5
      ) AS targeting_score
    FROM feed_ads fa
    WHERE fa.is_active = true
      AND fa.id NOT IN (SELECT shown_today.ad_id FROM shown_today)
      AND (fa.start_date IS NULL OR fa.start_date <= NOW())
      AND (fa.end_date IS NULL OR fa.end_date >= NOW())
      AND (fa.daily_budget IS NULL OR fa.spent_today < fa.daily_budget)
  )
  SELECT 
    sa.ad_id,
    sa.title,
    sa.description,
    sa.media_url,
    sa.media_type,
    sa.click_url,
    sa.advertiser_name,
    sa.priority
  FROM scored_ads sa
  ORDER BY sa.targeting_score DESC, RANDOM()
  LIMIT p_limit;
END;
$$;

-- 8. Update Session Position
-- Called to update where user left off in the feed
CREATE OR REPLACE FUNCTION public.update_feed_session(
  p_user_id UUID,
  p_feed_type TEXT,
  p_last_post_id UUID,
  p_position INTEGER
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_feed_sessions (user_id, feed_type, last_post_id, last_position, posts_viewed_this_session, updated_at)
  VALUES (p_user_id, p_feed_type, p_last_post_id, p_position, 1, NOW())
  ON CONFLICT (user_id, feed_type) 
  DO UPDATE SET
    last_post_id = p_last_post_id,
    last_position = p_position,
    posts_viewed_this_session = user_feed_sessions.posts_viewed_this_session + 1,
    updated_at = NOW();
END;
$$;

-- 9. Reset Session on Return (rotate starting position)
-- Called when user returns to app - shifts starting position
CREATE OR REPLACE FUNCTION public.rotate_feed_session(
  p_user_id UUID,
  p_feed_type TEXT DEFAULT 'forYou'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_offset INTEGER;
  v_viewed_count INTEGER;
BEGIN
  -- Get how many posts were viewed last session
  SELECT posts_viewed_this_session INTO v_viewed_count
  FROM user_feed_sessions
  WHERE user_id = p_user_id AND feed_type = p_feed_type;

  -- Calculate new offset (rotate by viewed count, min 5)
  v_new_offset := GREATEST(COALESCE(v_viewed_count, 0), 5);

  -- Update session with new starting position
  INSERT INTO user_feed_sessions (user_id, feed_type, last_position, posts_viewed_this_session, session_start, updated_at)
  VALUES (p_user_id, p_feed_type, v_new_offset, 0, NOW(), NOW())
  ON CONFLICT (user_id, feed_type) 
  DO UPDATE SET
    last_position = user_feed_sessions.last_position + v_new_offset,
    posts_viewed_this_session = 0,
    session_start = NOW(),
    updated_at = NOW();

  RETURN v_new_offset;
END;
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.user_feed_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_media_preferences ENABLE ROW LEVEL SECURITY;

-- User Feed Sessions - users can only access their own
CREATE POLICY "Users can view own feed sessions"
  ON public.user_feed_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feed sessions"
  ON public.user_feed_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feed sessions"
  ON public.user_feed_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feed sessions"
  ON public.user_feed_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- User Media Preferences - users can only access their own
CREATE POLICY "Users can view own media preferences"
  ON public.user_media_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own media preferences"
  ON public.user_media_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media preferences"
  ON public.user_media_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own media preferences"
  ON public.user_media_preferences FOR DELETE
  USING (auth.uid() = user_id);