-- =====================================================
-- CRITICAL SECURITY FIX: Address all 3 detected issues
-- =====================================================

-- 1. FIX: PUBLIC_USER_DATA - Restrict profiles table to authenticated users only
-- Drop ALL existing SELECT policies on profiles
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_users_view_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
DROP POLICY IF EXISTS "Public read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;

-- Revoke all access from anon role
REVOKE ALL ON public.profiles FROM anon;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create strict authenticated-only SELECT policy
CREATE POLICY "Only authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2. FIX: EXPOSED_SENSITIVE_DATA - Remove plaintext sensitive columns
-- First check if columns exist and drop them
DO $$
BEGIN
  -- Drop plaintext phone_number if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profile_sensitive_data' 
    AND column_name = 'phone_number'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE public.profile_sensitive_data DROP COLUMN phone_number;
  END IF;
  
  -- Drop plaintext stripe_customer_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profile_sensitive_data' 
    AND column_name = 'stripe_customer_id'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE public.profile_sensitive_data DROP COLUMN stripe_customer_id;
  END IF;
END $$;

-- Strengthen RLS on profile_sensitive_data
DROP POLICY IF EXISTS "Users can view own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users can update own sensitive data" ON public.profile_sensitive_data;
DROP POLICY IF EXISTS "Users can insert own sensitive data" ON public.profile_sensitive_data;

-- Revoke direct access - force use of secure functions
REVOKE ALL ON public.profile_sensitive_data FROM anon;
REVOKE SELECT, UPDATE ON public.profile_sensitive_data FROM authenticated;

-- Only allow authenticated users to insert their own record
CREATE POLICY "Users can insert own sensitive data"
ON public.profile_sensitive_data
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. FIX: MISSING_RLS_PROTECTION - Block direct user inserts to credit_transactions
-- Drop existing insert policies
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "authenticated_users_insert_transactions" ON public.credit_transactions;
DROP POLICY IF EXISTS "Allow users to insert own transactions" ON public.credit_transactions;

-- Ensure RLS is enabled
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy that BLOCKS all direct user inserts (WITH CHECK false)
CREATE POLICY "Block direct user inserts to credit_transactions"
ON public.credit_transactions
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Ensure users can still view their own transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view their own transactions"
ON public.credit_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Revoke anon access
REVOKE ALL ON public.credit_transactions FROM anon;