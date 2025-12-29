-- Drop and recreate the RLS policy for live_spaces to handle NULL is_private properly
DROP POLICY IF EXISTS "Public spaces are viewable by everyone" ON public.live_spaces;

-- Create a more robust policy that handles NULL is_private (treating NULL as public)
CREATE POLICY "Public spaces are viewable by everyone" 
ON public.live_spaces 
FOR SELECT 
USING ((COALESCE(is_private, false) = false) OR (user_id = auth.uid()));

-- Ensure is_private has a default value of false
ALTER TABLE public.live_spaces ALTER COLUMN is_private SET DEFAULT false;

-- Update any NULL is_private values to false
UPDATE public.live_spaces SET is_private = false WHERE is_private IS NULL;