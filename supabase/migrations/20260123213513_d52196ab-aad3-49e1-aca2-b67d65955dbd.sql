-- First drop the existing functions
DROP FUNCTION IF EXISTS get_personalized_for_you_feed(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_following_feed(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS record_post_view(UUID);
DROP FUNCTION IF EXISTS get_today_viewed_posts();
DROP FUNCTION IF EXISTS check_all_posts_viewed();

-- Recreate get_personalized_for_you_feed with proper view exclusion and cycle reset
CREATE OR REPLACE FUNCTION get_personalized_for_you_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    post_id UUID,
    relevance_score REAL,
    is_promoted BOOLEAN,
    boost_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_interests TEXT[];
    v_user_location TEXT;
    v_user_country TEXT;
    v_total_posts INTEGER;
    v_viewed_posts INTEGER;
    v_coverage_ratio REAL;
BEGIN
    -- Get user's interests and location from profile
    SELECT 
        COALESCE(p.interests, ARRAY[]::TEXT[]),
        COALESCE(p.location, ''),
        COALESCE(p.country, '')
    INTO v_user_interests, v_user_location, v_user_country
    FROM profiles p
    WHERE p.id = p_user_id;

    -- Check view coverage to determine if we need a reset
    SELECT COUNT(*) INTO v_total_posts
    FROM posts 
    WHERE status = 'active' AND user_id != p_user_id;
    
    SELECT COUNT(*) INTO v_viewed_posts
    FROM post_view_history
    WHERE user_id = p_user_id AND view_date = CURRENT_DATE;
    
    v_coverage_ratio := CASE WHEN v_total_posts > 0 THEN v_viewed_posts::REAL / v_total_posts ELSE 0 END;
    
    -- If user has viewed more than 90% of posts, reset their view history for today
    IF v_coverage_ratio > 0.9 AND v_viewed_posts > 10 THEN
        DELETE FROM post_view_history 
        WHERE user_id = p_user_id AND view_date = CURRENT_DATE;
    END IF;

    RETURN QUERY
    WITH 
    -- Get IDs of posts the user has already viewed today (AFTER potential reset)
    viewed_today AS (
        SELECT pvh.post_id AS vid
        FROM post_view_history pvh
        WHERE pvh.user_id = p_user_id
        AND pvh.view_date = CURRENT_DATE
    ),
    -- Get promoted posts
    promoted AS (
        SELECT pp.post_id AS pid, pp.boost_level AS blevel
        FROM post_promotions pp
        WHERE pp.is_active = true
        AND pp.expires_at > now()
    ),
    -- Get hashtags from posts the user has liked (engagement signal)
    liked_hashtags AS (
        SELECT DISTINCT h.name
        FROM post_likes pl
        JOIN post_hashtags ph ON ph.post_id = pl.post_id
        JOIN hashtags h ON h.id = ph.hashtag_id
        WHERE pl.user_id = p_user_id
        ORDER BY h.name
        LIMIT 50
    ),
    -- Get users the current user has engaged with (liked their posts)
    engaged_users AS (
        SELECT DISTINCT p.user_id
        FROM post_likes pl
        JOIN posts p ON p.id = pl.post_id
        WHERE pl.user_id = p_user_id
        LIMIT 100
    ),
    -- Users the current user follows
    following_ids AS (
        SELECT f.following_id AS fid
        FROM follows f
        WHERE f.follower_id = p_user_id
    ),
    -- Trending posts (high engagement in last 24 hours)
    trending_posts AS (
        SELECT p.id, 
               (COALESCE(p.likes_count, 0) * 2 + COALESCE(p.comments_count, 0) * 3 + COALESCE(p.views_count, 0) * 0.1) AS trend_score
        FROM posts p
        WHERE p.created_at > now() - interval '24 hours'
        AND p.status = 'active'
    ),
    -- Calculate scores for each post - EXCLUDE VIEWED POSTS
    scored_posts AS (
        SELECT 
            p.id,
            1.0 +
            -- Boost for matching user interests (from hashtags in post)
            COALESCE((
                SELECT COUNT(*) * 2.0
                FROM post_hashtags ph
                JOIN hashtags h ON h.id = ph.hashtag_id
                WHERE ph.post_id = p.id
                AND h.name = ANY(v_user_interests)
            ), 0) +
            -- Boost for posts with hashtags user has engaged with before
            COALESCE((
                SELECT COUNT(*) * 1.5
                FROM post_hashtags ph
                JOIN hashtags h ON h.id = ph.hashtag_id
                WHERE ph.post_id = p.id
                AND h.name IN (SELECT name FROM liked_hashtags)
            ), 0) +
            -- Boost for posts from users the viewer has engaged with
            CASE WHEN p.user_id IN (SELECT user_id FROM engaged_users) THEN 1.5 ELSE 0 END +
            -- Slight boost for followed users
            CASE WHEN p.user_id IN (SELECT fid FROM following_ids) THEN 0.5 ELSE 0 END +
            -- Boost for same location/country
            CASE 
                WHEN v_user_location != '' AND prof.location = v_user_location THEN 1.0
                WHEN v_user_country != '' AND prof.country = v_user_country THEN 0.5
                ELSE 0 
            END +
            -- Trending boost
            COALESCE((SELECT trend_score * 0.01 FROM trending_posts tp WHERE tp.id = p.id), 0) +
            -- Recency boost
            CASE WHEN p.created_at > now() - interval '6 hours' THEN 2.0 
                 WHEN p.created_at > now() - interval '24 hours' THEN 1.0
                 ELSE 0 END +
            -- Promotion boost
            CASE 
                WHEN pr.blevel = 'premium' THEN 5.0
                WHEN pr.blevel = 'standard' THEN 3.0
                WHEN pr.blevel = 'basic' THEN 1.5
                ELSE 0 
            END +
            -- Random factor for variety (0 to 2)
            (random() * 2) AS total_score,
            (pr.pid IS NOT NULL) AS is_promo,
            COALESCE(pr.blevel, 'none') AS b_level
        FROM posts p
        JOIN profiles prof ON prof.id = p.user_id
        LEFT JOIN promoted pr ON p.id = pr.pid
        WHERE p.status = 'active'
        -- Exclude user's own posts
        AND p.user_id != p_user_id
        -- EXCLUDE ALREADY VIEWED POSTS - This is the key fix!
        AND p.id NOT IN (SELECT vid FROM viewed_today)
    )
    SELECT 
        sp.id AS post_id,
        sp.total_score AS relevance_score,
        sp.is_promo AS is_promoted,
        sp.b_level AS boost_level
    FROM scored_posts sp
    ORDER BY sp.total_score DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Recreate get_following_feed to exclude viewed posts
CREATE OR REPLACE FUNCTION get_following_feed(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    post_id UUID,
    is_promoted BOOLEAN,
    boost_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_following_posts INTEGER;
    v_viewed_following_posts INTEGER;
    v_coverage_ratio REAL;
BEGIN
    -- Check if user has viewed most posts from followed users
    SELECT COUNT(DISTINCT p.id) INTO v_total_following_posts
    FROM posts p
    JOIN follows f ON f.following_id = p.user_id
    WHERE f.follower_id = p_user_id AND p.status = 'active';
    
    SELECT COUNT(DISTINCT pvh.post_id) INTO v_viewed_following_posts
    FROM post_view_history pvh
    JOIN posts p ON p.id = pvh.post_id
    JOIN follows f ON f.following_id = p.user_id
    WHERE pvh.user_id = p_user_id 
    AND f.follower_id = p_user_id
    AND pvh.view_date = CURRENT_DATE;
    
    v_coverage_ratio := CASE WHEN v_total_following_posts > 0 
        THEN v_viewed_following_posts::REAL / v_total_following_posts ELSE 0 END;
    
    -- If user has viewed more than 90% of following posts, allow reset
    IF v_coverage_ratio > 0.9 AND v_viewed_following_posts > 5 THEN
        DELETE FROM post_view_history 
        WHERE user_id = p_user_id 
        AND view_date = CURRENT_DATE
        AND post_id IN (
            SELECT p.id FROM posts p
            JOIN follows f ON f.following_id = p.user_id
            WHERE f.follower_id = p_user_id
        );
    END IF;

    RETURN QUERY
    WITH 
    -- Get IDs of posts viewed today
    viewed_today AS (
        SELECT pvh.post_id AS vid
        FROM post_view_history pvh
        WHERE pvh.user_id = p_user_id
        AND pvh.view_date = CURRENT_DATE
    ),
    -- Get promoted posts
    promoted AS (
        SELECT pp.post_id AS pid, pp.boost_level AS blevel
        FROM post_promotions pp
        WHERE pp.is_active = true
        AND pp.expires_at > now()
    ),
    -- Get posts from followed users EXCLUDING viewed posts
    following_posts AS (
        SELECT 
            p.id,
            p.created_at,
            (pr.pid IS NOT NULL) AS is_promo,
            COALESCE(pr.blevel, 'none') AS b_level,
            -- Add randomization factor
            (random() * 0.5) AS random_factor
        FROM posts p
        JOIN follows f ON f.following_id = p.user_id
        LEFT JOIN promoted pr ON p.id = pr.pid
        WHERE f.follower_id = p_user_id
        AND p.status = 'active'
        -- EXCLUDE ALREADY VIEWED POSTS
        AND p.id NOT IN (SELECT vid FROM viewed_today)
    )
    SELECT 
        fp.id AS post_id,
        fp.is_promo AS is_promoted,
        fp.b_level AS boost_level
    FROM following_posts fp
    ORDER BY 
        -- Promoted posts first
        fp.is_promo DESC,
        -- Then by recency with slight randomization
        fp.created_at DESC,
        fp.random_factor DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Create a helper function to record post views efficiently
CREATE OR REPLACE FUNCTION record_post_view(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Insert or update view record (upsert)
    INSERT INTO post_view_history (user_id, post_id, view_date, view_count)
    VALUES (v_user_id, p_post_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, post_id, view_date) 
    DO UPDATE SET view_count = post_view_history.view_count + 1;
    
EXCEPTION WHEN OTHERS THEN
    -- Silently ignore errors (duplicate, etc)
    NULL;
END;
$$;

-- Create function to get today's viewed posts
CREATE OR REPLACE FUNCTION get_today_viewed_posts()
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
    AND pvh.view_date = CURRENT_DATE;
END;
$$;

-- Create function to check if user has viewed all available posts
CREATE OR REPLACE FUNCTION check_all_posts_viewed()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_posts INTEGER;
    v_viewed_posts INTEGER;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    SELECT COUNT(*) INTO v_total_posts
    FROM posts 
    WHERE status = 'active' AND user_id != v_user_id;
    
    SELECT COUNT(*) INTO v_viewed_posts
    FROM post_view_history
    WHERE user_id = v_user_id AND view_date = CURRENT_DATE;
    
    RETURN v_viewed_posts >= v_total_posts AND v_total_posts > 0;
END;
$$;

-- Add index for faster view history lookups
CREATE INDEX IF NOT EXISTS idx_post_view_history_user_date 
ON post_view_history(user_id, view_date);

CREATE INDEX IF NOT EXISTS idx_post_view_history_lookup
ON post_view_history(user_id, post_id, view_date);