-- Drop the old restrictive policies since new ones cover them
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_subscriptions;