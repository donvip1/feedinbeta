-- Comprehensive fix for user_credits table security
-- Remove any remaining UPDATE policies
DROP POLICY IF EXISTS "Users can update their own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
DROP POLICY IF EXISTS "Users can initialize their own credits" ON public.user_credits;

-- Revoke direct UPDATE/INSERT grants - only triggers with SECURITY DEFINER can modify
REVOKE UPDATE ON public.user_credits FROM authenticated;
REVOKE UPDATE ON public.user_credits FROM anon;
REVOKE INSERT ON public.user_credits FROM authenticated;
REVOKE INSERT ON public.user_credits FROM anon;

-- Keep only SELECT policy for users to view their own credits
-- The apply_credit_transaction and initialize_user_credits triggers handle all modifications