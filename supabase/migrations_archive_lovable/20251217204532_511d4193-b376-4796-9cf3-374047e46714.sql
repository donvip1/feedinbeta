-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles;

-- Create a new policy that allows viewing any profile (public data like display_name, username, avatar is safe)
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
USING (true);