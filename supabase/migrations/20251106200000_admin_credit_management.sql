-- 1. Create a helper function to identify admins based on their email.
-- This function checks the auth.users table for the email associated with the user_id.
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = user_id
      AND email IN ('viplearn4free@gmail.com', 'cryptosvip@gmail.com')
  );
END;
$$;

-- 2. Create the RPC function that admins will call to share credits.
CREATE OR REPLACE FUNCTION admin_share_credits(recipient_user_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  admin_user_id uuid := auth.uid();
BEGIN
  -- Security Check: Ensure the caller is an admin.
  IF NOT is_admin(admin_user_id) THEN
    RAISE EXCEPTION 'You do not have permission to perform this action.';
  END IF;

  -- Ensure amount is positive
  IF amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive.';
  END IF;

  -- Update the recipient''s credits balance in the profiles table.
  UPDATE public.profiles
  SET credits = credits + amount
  WHERE id = recipient_user_id;

  -- Create a notification for the recipient.
  INSERT INTO public.notifications (user_id, type, message, from_user_id)
  VALUES (recipient_user_id, 'info', 'You have received ' || amount || ' credits from an admin.', admin_user_id);

END;
$$;


-- 3. Update Row Level Security (RLS) to allow admins to manage profiles.
-- These policies grant admins the necessary permissions without affecting normal users.

-- First, ensure RLS is enabled on the profiles table.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add a policy to allow admins to view all user profiles.
-- This is useful for an admin dashboard where you might search for a user.
CREATE POLICY "Admins can view all user profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));

-- Add a policy to allow admins to update any user's profile.
-- This is required for the credit sharing feature to work.
CREATE POLICY "Admins can update any user profile"
ON public.profiles
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Note: We assume a policy like "Users can update their own profile" already exists.
-- RLS policies are permissive, so adding these admin policies will not conflict
-- with existing policies for regular users.
