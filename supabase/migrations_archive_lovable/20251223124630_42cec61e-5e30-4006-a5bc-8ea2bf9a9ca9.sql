-- Create a better personalized feed function
CREATE OR REPLACE FUNCTION get_personalized_for_you_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    post_id UUID,
    relevance_score FLOAT,
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
BEGIN
    -- Get user's interests and location from profile
    SELECT 
        COALESCE(p.interests, ARRAY[]::TEXT[]),
        COALESCE(p.location, ''),
        COALESCE(p.country, '')
    INTO v_user_interests, v_user_location, v_user_country
    FROM profiles p
    WHERE p.id = p_user_id;

    RETURN QUERY
    WITH 
    -- Get IDs of posts the user has already viewed today
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
    -- Users the current user follows (we'll slightly boost their content in For You too)
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
    -- Calculate scores for each post
    scored_posts AS (
        SELECT 
            p.id,
            -- Base score
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
            -- Slight boost for followed users (they appear in For You too, but less prioritized than Following tab)
            CASE WHEN p.user_id IN (SELECT fid FROM following_ids) THEN 0.5 ELSE 0 END +
            -- Boost for same location/country
            CASE 
                WHEN v_user_location != '' AND prof.location = v_user_location THEN 1.0
                WHEN v_user_country != '' AND prof.country = v_user_country THEN 0.5
                ELSE 0 
            END +
            -- Trending boost
            COALESCE((SELECT trend_score * 0.01 FROM trending_posts tp WHERE tp.id = p.id), 0) +
            -- Recency boost (posts from last 6 hours get boost)
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
            -- Random factor to add variety (between 0 and 1)
            random() AS total_score,
            (pr.pid IS NOT NULL) AS is_promo,
            COALESCE(pr.blevel, 'none') AS b_level,
            (vt.vid IS NOT NULL) AS already_viewed
        FROM posts p
        JOIN profiles prof ON prof.id = p.user_id
        LEFT JOIN promoted pr ON p.id = pr.pid
        LEFT JOIN viewed_today vt ON p.id = vt.vid
        WHERE p.status = 'active'
        -- Exclude user's own posts
        AND p.user_id != p_user_id
    )
    SELECT 
        sp.id AS post_id,
        sp.total_score AS relevance_score,
        sp.is_promo AS is_promoted,
        sp.b_level AS boost_level
    FROM scored_posts sp
    ORDER BY
        -- Unviewed posts first
        sp.already_viewed ASC,
        -- Then by score
        sp.total_score DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Create a simple following feed function
CREATE OR REPLACE FUNCTION get_following_feed(
    p_user_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    post_id UUID,
    is_promoted BOOLEAN,
    boost_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH 
    following_ids AS (
        SELECT f.following_id AS fid
        FROM follows f
        WHERE f.follower_id = p_user_id
    ),
    promoted AS (
        SELECT pp.post_id AS pid, pp.boost_level AS blevel
        FROM post_promotions pp
        WHERE pp.is_active = true
        AND pp.expires_at > now()
    ),
    viewed_today AS (
        SELECT pvh.post_id AS vid
        FROM post_view_history pvh
        WHERE pvh.user_id = p_user_id
        AND pvh.view_date = CURRENT_DATE
    )
    SELECT 
        p.id AS post_id,
        (pr.pid IS NOT NULL) AS is_promoted,
        COALESCE(pr.blevel, 'none') AS boost_level
    FROM posts p
    LEFT JOIN promoted pr ON p.id = pr.pid
    LEFT JOIN viewed_today vt ON p.id = vt.vid
    WHERE p.status = 'active'
    AND p.user_id IN (SELECT fid FROM following_ids)
    ORDER BY
        -- Unviewed first
        (vt.vid IS NOT NULL) ASC,
        -- Promoted posts higher
        CASE 
            WHEN pr.blevel = 'premium' THEN 1
            WHEN pr.blevel = 'standard' THEN 2
            WHEN pr.blevel = 'basic' THEN 3
            ELSE 4
        END,
        -- Then by date
        p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;