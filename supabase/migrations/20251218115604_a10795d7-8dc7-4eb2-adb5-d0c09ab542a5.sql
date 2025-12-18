-- First drop the view that depends on the columns
DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Migrate sensitive data from profiles to profile_sensitive_data
INSERT INTO public.profile_sensitive_data (user_id, phone_number, stripe_customer_id, created_at, updated_at)
SELECT 
  p.id,
  p.phone_number,
  p.stripe_customer_id,
  COALESCE(p.created_at, now()),
  now()
FROM public.profiles p
WHERE (p.phone_number IS NOT NULL OR p.stripe_customer_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.profile_sensitive_data psd WHERE psd.user_id = p.id
  )
ON CONFLICT (user_id) DO UPDATE SET
  phone_number = COALESCE(EXCLUDED.phone_number, profile_sensitive_data.phone_number),
  stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, profile_sensitive_data.stripe_customer_id),
  updated_at = now();

-- Update existing records with newer data
UPDATE public.profile_sensitive_data psd
SET 
  phone_number = COALESCE(p.phone_number, psd.phone_number),
  stripe_customer_id = COALESCE(p.stripe_customer_id, psd.stripe_customer_id),
  updated_at = now()
FROM public.profiles p
WHERE psd.user_id = p.id
  AND (p.phone_number IS NOT NULL OR p.stripe_customer_id IS NOT NULL);

-- Now drop the sensitive columns from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_number;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;

-- Ensure RLS is enabled on profile_sensitive_data
ALTER TABLE public.profile_sensitive_data ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users can insert their own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users can update their own sensitive data" ON public.profile_sensitive_data;

-- Create strict RLS policies - ONLY the owner can access their sensitive data
CREATE POLICY "Users can view their own sensitive data"
ON public.profile_sensitive_data
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sensitive data"
ON public.profile_sensitive_data
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sensitive data"
ON public.profile_sensitive_data
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Revoke all access from anon role
REVOKE ALL ON public.profile_sensitive_data FROM anon;

-- Recreate the public_profiles view WITHOUT sensitive columns
CREATE VIEW public.public_profiles 
WITH (security_invoker = true)
AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  cover_url,
  banner_url,
  bio,
  about,
  status,
  status_visibility,
  about_visibility,
  is_premium,
  followers_count,
  following_count,
  total_views,
  interests,
  purpose,
  created_at
FROM public.profiles;

-- Grant access to authenticated users only
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;