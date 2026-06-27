-- Ensure live_streams_public view is accessible
GRANT SELECT ON public.live_streams_public TO anon;
GRANT SELECT ON public.live_streams_public TO authenticated;

-- Ensure profiles table SELECT is granted
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- Ensure live_stream_viewers can be read/written
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_stream_viewers TO authenticated;
GRANT SELECT ON public.live_stream_viewers TO anon;

-- Ensure live_stream_comments can be read/written
GRANT SELECT, INSERT, DELETE ON public.live_stream_comments TO authenticated;
GRANT SELECT ON public.live_stream_comments TO anon;

-- Ensure live_stream_reactions can be read/written  
GRANT SELECT, INSERT, DELETE ON public.live_stream_reactions TO authenticated;
GRANT SELECT ON public.live_stream_reactions TO anon;

-- Ensure live_stream_gifts can be read/written
GRANT SELECT, INSERT ON public.live_stream_gifts TO authenticated;
GRANT SELECT ON public.live_stream_gifts TO anon;

-- Create or replace the SELECT policy to be more permissive
DROP POLICY IF EXISTS "Public can view live streams" ON public.live_streams;
DROP POLICY IF EXISTS "Anyone can view public streams" ON public.live_streams;
DROP POLICY IF EXISTS "Authenticated users can view public stream info" ON public.live_streams;

-- Keep only one clean SELECT policy
CREATE POLICY "All users can view streams"
  ON public.live_streams
  FOR SELECT
  TO anon, authenticated
  USING (status IN ('live', 'ended', 'scheduled') OR auth.uid() = user_id);