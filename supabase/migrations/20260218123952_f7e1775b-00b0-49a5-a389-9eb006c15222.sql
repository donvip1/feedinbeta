-- Allow authenticated users to see other users' subscriptions (for badge display)
CREATE POLICY "Authenticated users can view active subscriptions for badges"
ON public.user_subscriptions
FOR SELECT
TO authenticated
USING (status = 'active');

-- Allow authenticated users to see other users' roles (for badge display)
CREATE POLICY "Authenticated users can view roles for badges"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);