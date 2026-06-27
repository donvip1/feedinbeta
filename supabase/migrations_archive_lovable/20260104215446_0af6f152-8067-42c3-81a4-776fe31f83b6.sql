-- Fix security definer view by recreating with SECURITY INVOKER
DROP VIEW IF EXISTS public.live_streams_public;
CREATE VIEW public.live_streams_public 
WITH (security_invoker = true) AS
SELECT 
    id,
    user_id,
    title,
    description,
    status,
    category,
    viewer_count,
    peak_viewers,
    created_at,
    started_at,
    ended_at,
    scheduled_start,
    thumbnail_url,
    cf_hls_url,
    cf_webrtc_url,
    is_premium,
    tags,
    stream_ready,
    connection_state
FROM live_streams
WHERE status IN ('live', 'ended', 'scheduled');

-- Re-grant access
GRANT SELECT ON public.live_streams_public TO anon;
GRANT SELECT ON public.live_streams_public TO authenticated;