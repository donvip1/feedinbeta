-- Create a separate table for highly sensitive profile data
-- This isolates PII from the main profiles table for defense-in-depth

CREATE TABLE IF NOT EXISTS public.profile_sensitive_data (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text,
  stripe_customer_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable strict RLS - owner only, no exceptions
ALTER TABLE public.profile_sensitive_data ENABLE ROW LEVEL SECURITY;

-- Revoke all public access
REVOKE ALL ON public.profile_sensitive_data FROM anon;
REVOKE ALL ON public.profile_sensitive_data FROM authenticated;

-- Grant only to authenticated users (RLS will filter)
GRANT SELECT, UPDATE ON public.profile_sensitive_data TO authenticated;

-- Only owner can view their sensitive data
CREATE POLICY "Owner can view own sensitive data"
ON public.profile_sensitive_data
FOR SELECT
USING (auth.uid() = user_id);

-- Only owner can update their sensitive data
CREATE POLICY "Owner can update own sensitive data"
ON public.profile_sensitive_data
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- System can insert (via trigger on profile creation)
CREATE POLICY "System can insert sensitive data"
ON public.profile_sensitive_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Migrate existing sensitive data from profiles to the new table
INSERT INTO public.profile_sensitive_data (user_id, phone_number, stripe_customer_id)
SELECT id, phone_number, stripe_customer_id
FROM public.profiles
WHERE phone_number IS NOT NULL OR stripe_customer_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE SET
  phone_number = EXCLUDED.phone_number,
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  updated_at = now();

-- Create a secure function to get own sensitive data (security definer)
CREATE OR REPLACE FUNCTION public.get_my_sensitive_data()
RETURNS TABLE(phone_number text, stripe_customer_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone_number, stripe_customer_id
  FROM public.profile_sensitive_data
  WHERE user_id = auth.uid();
$$;

-- Create a secure function to update own phone number
CREATE OR REPLACE FUNCTION public.update_my_phone_number(new_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_sensitive_data (user_id, phone_number)
  VALUES (auth.uid(), new_phone)
  ON CONFLICT (user_id) DO UPDATE SET
    phone_number = new_phone,
    updated_at = now();
  RETURN true;
END;
$$;

-- Create trigger to auto-create sensitive data row when profile is created
CREATE OR REPLACE FUNCTION public.create_sensitive_data_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_sensitive_data (user_id, phone_number)
  VALUES (NEW.id, NEW.phone_number)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
DROP TRIGGER IF EXISTS on_profile_created_create_sensitive ON public.profiles;
CREATE TRIGGER on_profile_created_create_sensitive
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_sensitive_data_for_profile();

-- Drop the sensitive columns from profiles table (after migration)
-- Note: Keeping phone_number for backward compatibility during transition
-- In production, these would be dropped after verifying all code uses new table
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_number;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;

-- Update the public_profiles view to explicitly exclude any sensitive fields
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT 
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.is_premium,
  p.followers_count,
  p.following_count
FROM public.profiles p
WHERE 
  p.id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.follows f 
    WHERE (f.follower_id = auth.uid() AND f.following_id = p.id)
       OR (f.following_id = auth.uid() AND f.follower_id = p.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND ((fr.sender_id = auth.uid() AND fr.receiver_id = p.id)
        OR (fr.receiver_id = auth.uid() AND fr.sender_id = p.id))
  );

-- Revoke anon access to view
REVOKE ALL ON public.public_profiles FROM anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- Add comment documenting security model
COMMENT ON TABLE public.profile_sensitive_data IS 
'Isolated storage for sensitive PII (phone numbers, payment IDs). 
Strict owner-only RLS. Never exposed through public views or functions.
Access only via get_my_sensitive_data() or direct owner query.';