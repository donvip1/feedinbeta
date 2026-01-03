-- Allow anonymous users to view live/scheduled/ended streams
CREATE POLICY "Anyone can view public streams" 
ON public.live_streams 
FOR SELECT 
TO anon
USING (status IN ('live', 'ended', 'scheduled'));