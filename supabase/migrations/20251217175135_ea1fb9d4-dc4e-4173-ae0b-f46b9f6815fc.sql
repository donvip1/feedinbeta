-- FIX 1: Ensure profiles table has strict owner-only access
-- Drop any remaining permissive policies
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

-- Ensure owner-only policy exists
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles;
CREATE POLICY "Users can only view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- FIX 2: Ensure user_credits table has strict owner-only access
-- First check if table exists and add RLS
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_credits') THEN
    -- Enable RLS if not already
    ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
    
    -- Drop any permissive policies
    DROP POLICY IF EXISTS "Anyone can view credits" ON public.user_credits;
    DROP POLICY IF EXISTS "Public credits access" ON public.user_credits;
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_credits;
    
    -- Ensure owner-only SELECT policy
    DROP POLICY IF EXISTS "Users can view their own credits" ON public.user_credits;
    EXECUTE 'CREATE POLICY "Users can view their own credits" ON public.user_credits FOR SELECT TO authenticated USING (auth.uid() = user_id)';
    
    -- Ensure owner-only UPDATE policy
    DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;
    EXECUTE 'CREATE POLICY "Users can update their own credits" ON public.user_credits FOR UPDATE TO authenticated USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Revoke any direct public access to sensitive tables
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_credits FROM anon;