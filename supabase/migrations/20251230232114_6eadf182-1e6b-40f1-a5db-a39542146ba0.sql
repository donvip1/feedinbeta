-- Fix call_signals RLS - allow users to see signals they SENT (for debugging) and RECEIVE
DROP POLICY IF EXISTS "Users can receive signals" ON public.call_signals;
DROP POLICY IF EXISTS "Users can send signals" ON public.call_signals;

-- Users can see signals sent TO them OR signals they SENT
CREATE POLICY "Users can view call signals" 
ON public.call_signals 
FOR SELECT 
USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- Users can insert signals where they are the sender
CREATE POLICY "Users can send call signals" 
ON public.call_signals 
FOR INSERT 
WITH CHECK (auth.uid() = from_user_id);

-- Delete old signals after call ends (both participants can delete)
CREATE POLICY "Users can delete call signals" 
ON public.call_signals 
FOR DELETE 
USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);