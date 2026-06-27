-- Add DELETE policy for live_stream_viewers so viewers can leave streams
CREATE POLICY "Users can delete their viewer session" 
ON public.live_stream_viewers 
FOR DELETE 
USING (auth.uid() = user_id OR user_id IS NULL);

-- Ensure live_streams_public view is accessible
DROP VIEW IF EXISTS public.live_streams_public;
CREATE VIEW public.live_streams_public AS
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

-- Grant access to the view for all roles
GRANT SELECT ON public.live_streams_public TO anon;
GRANT SELECT ON public.live_streams_public TO authenticated;

-- Add policy for anon users to view reactions (currently restricted to live streams only which is fine)
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.live_stream_reactions;
CREATE POLICY "Anyone can view reactions" 
ON public.live_stream_reactions 
FOR SELECT 
USING (true);