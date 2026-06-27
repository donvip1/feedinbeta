-- Fix security definer view by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.live_streams_public;

CREATE VIEW public.live_streams_public 
WITH (security_invoker = true) AS
SELECT 
    id,
    user_id,
    title,
    description,
    thumbnail_url,
    status,
    viewer_count,
    started_at,
    ended_at,
    scheduled_start,
    category,
    tags,
    is_premium,
    peak_viewers,
    duration,
    created_at,
    updated_at,
    cf_hls_url,
    cf_webrtc_url,
    sfu_track_name,
    cloudflare_session_id,
    CASE
        WHEN (auth.uid() = user_id) THEN stream_key
        ELSE NULL::text
    END AS stream_key
FROM live_streams;

-- Grant access to the view
GRANT SELECT ON public.live_streams_public TO anon, authenticated;