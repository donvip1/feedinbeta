-- Add view_date column
ALTER TABLE public.post_view_history 
ADD COLUMN IF NOT EXISTS view_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create unique constraint for deduplication
ALTER TABLE public.post_view_history 
DROP CONSTRAINT IF EXISTS post_view_history_user_post_date_unique;

CREATE UNIQUE INDEX IF NOT EXISTS post_view_history_user_post_date_idx 
ON public.post_view_history(user_id, post_id, view_date);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_post_view_history_user_date ON public.post_view_history(user_id, view_date);
CREATE INDEX IF NOT EXISTS idx_post_view_history_post ON public.post_view_history(post_id);

-- Enable RLS
ALTER TABLE public.post_view_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own view history" ON public.post_view_history;
DROP POLICY IF EXISTS "Users can insert their own view history" ON public.post_view_history;
DROP POLICY IF EXISTS "Users can delete their own view history" ON public.post_view_history;

-- RLS Policies
CREATE POLICY "Users can view their own view history"
ON public.post_view_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own view history"
ON public.post_view_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own view history"
ON public.post_view_history FOR DELETE
USING (auth.uid() = user_id);

-- Function to get today's viewed post IDs for current user
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
    AND pvh.view_date = CURRENT_DATE;
END;
$$;

-- Function to record a post view (handles duplicates gracefully)
CREATE OR REPLACE FUNCTION public.record_post_view(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO post_view_history (user_id, post_id, view_date)
    VALUES (auth.uid(), p_post_id, CURRENT_DATE)
    ON CONFLICT (user_id, post_id, view_date) DO NOTHING;
EXCEPTION WHEN unique_violation THEN
    -- Ignore duplicate entries
    NULL;
END;
$$;

-- Function to check if user has viewed all available posts today
CREATE OR REPLACE FUNCTION public.check_all_posts_viewed()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_active_posts INTEGER;
    viewed_posts_count INTEGER;
BEGIN
    -- Count total active posts (not by current user)
    SELECT COUNT(*) INTO total_active_posts
    FROM posts
    WHERE status = 'active'
    AND user_id != auth.uid();
    
    -- Count posts viewed today by current user
    SELECT COUNT(*) INTO viewed_posts_count
    FROM post_view_history
    WHERE user_id = auth.uid()
    AND view_date = CURRENT_DATE;
    
    -- If viewed 80% or more of available posts, consider all viewed
    RETURN viewed_posts_count >= (total_active_posts * 0.8);
END;
$$;

-- Function to get smart feed posts with priority sorting
CREATE OR REPLACE FUNCTION public.get_smart_feed_posts(
    p_limit INTEGER DEFAULT 50,
    p_tab TEXT DEFAULT 'forYou'
)
RETURNS TABLE(
    post_id UUID,
    is_promoted BOOLEAN,
    boost_level TEXT,
    is_viewed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    RETURN QUERY
    WITH promoted AS (
        SELECT pp.post_id AS pid, pp.boost_level AS blevel
        FROM post_promotions pp
        WHERE pp.is_active = true
        AND pp.expires_at > now()
    ),
    viewed_today AS (
        SELECT pvh.post_id AS vid
        FROM post_view_history pvh
        WHERE pvh.user_id = v_user_id
        AND pvh.view_date = CURRENT_DATE
    ),
    following_ids AS (
        SELECT f.following_id AS fid
        FROM follows f
        WHERE f.follower_id = v_user_id
    )
    SELECT 
        p.id AS post_id,
        (pr.pid IS NOT NULL) AS is_promoted,
        COALESCE(pr.blevel, 'none') AS boost_level,
        (vt.vid IS NOT NULL) AS is_viewed
    FROM posts p
    LEFT JOIN promoted pr ON p.id = pr.pid
    LEFT JOIN viewed_today vt ON p.id = vt.vid
    WHERE p.status = 'active'
    AND (
        p_tab = 'forYou' 
        OR (p_tab = 'following' AND p.user_id IN (SELECT fid FROM following_ids))
    )
    ORDER BY
        -- 1. Unviewed promoted posts first (by boost level)
        CASE 
            WHEN vt.vid IS NULL AND pr.blevel = 'premium' THEN 1
            WHEN vt.vid IS NULL AND pr.blevel = 'standard' THEN 2
            WHEN vt.vid IS NULL AND pr.blevel = 'basic' THEN 3
            WHEN vt.vid IS NULL THEN 4
            -- 2. Viewed promoted posts next
            WHEN pr.blevel = 'premium' THEN 5
            WHEN pr.blevel = 'standard' THEN 6
            WHEN pr.blevel = 'basic' THEN 7
            ELSE 8
        END,
        -- 3. Add some randomness within each tier
        random(),
        -- 4. Then by date
        p.created_at DESC
    LIMIT p_limit;
END;
$$;