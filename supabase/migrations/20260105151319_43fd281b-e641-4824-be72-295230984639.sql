-- Grant SELECT on the live_streams_public view to both anon and authenticated roles
GRANT SELECT ON public.live_streams_public TO anon;
GRANT SELECT ON public.live_streams_public TO authenticated;

-- Also ensure the underlying live_streams table has a SELECT policy for reading public streams
-- First check and add if not exists
DO $$
BEGIN
  -- Drop existing restrictive policy if any
  DROP POLICY IF EXISTS "Anyone can view live streams" ON public.live_streams;
  DROP POLICY IF EXISTS "Users can view live streams" ON public.live_streams;
  DROP POLICY IF EXISTS "Public can view live streams" ON public.live_streams;
  DROP POLICY IF EXISTS "Anyone can view active streams" ON public.live_streams;
  
  -- Create a permissive SELECT policy for all users (including anonymous)
  CREATE POLICY "Anyone can view live streams"
    ON public.live_streams
    FOR SELECT
    USING (status IN ('live', 'ended', 'scheduled'));
END $$;

-- Grant SELECT on live_streams to both roles
GRANT SELECT ON public.live_streams TO anon;
GRANT SELECT ON public.live_streams TO authenticated;

-- Also grant on profiles for joining
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;