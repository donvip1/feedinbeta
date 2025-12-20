
-- Drop dependent policy first
DROP POLICY IF EXISTS "Users can only message mutual friends" ON messages;

-- Drop and recreate the function with correct parameter names
DROP FUNCTION IF EXISTS public.are_mutual_friends(uuid, uuid) CASCADE;

-- Recreate helper function to check if users are mutual friends
CREATE OR REPLACE FUNCTION public.are_mutual_friends(user1_id uuid, user2_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status = 'accepted'
    AND (
      (sender_id = user1_id AND receiver_id = user2_id)
      OR (sender_id = user2_id AND receiver_id = user1_id)
    )
  );
$$;

-- Helper function to check if a profile is viewable
CREATE OR REPLACE FUNCTION public.can_view_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() = target_user_id THEN true
    WHEN public.are_mutual_friends(auth.uid(), target_user_id) THEN true
    ELSE COALESCE(
      (SELECT profile_visible FROM privacy_settings WHERE user_id = target_user_id),
      true
    )
  END;
$$;

-- Helper function to check if online status is viewable
CREATE OR REPLACE FUNCTION public.can_view_online_status(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() = target_user_id THEN true
    WHEN public.are_mutual_friends(auth.uid(), target_user_id) THEN true
    ELSE COALESCE(
      (SELECT show_online_status FROM privacy_settings WHERE user_id = target_user_id),
      true
    )
  END;
$$;

-- Helper function to check if activity status is viewable
CREATE OR REPLACE FUNCTION public.can_view_activity_status(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() = target_user_id THEN true
    WHEN public.are_mutual_friends(auth.uid(), target_user_id) THEN true
    ELSE COALESCE(
      (SELECT show_activity_status FROM privacy_settings WHERE user_id = target_user_id),
      true
    )
  END;
$$;

-- Helper function to check if friend requests are allowed
CREATE OR REPLACE FUNCTION public.can_send_friend_request(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() = target_user_id THEN false
    ELSE COALESCE(
      (SELECT allow_friend_requests FROM privacy_settings WHERE user_id = target_user_id),
      true
    )
  END;
$$;

-- Helper function to check if messages from strangers are allowed
CREATE OR REPLACE FUNCTION public.can_message_stranger(target_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() = target_user_id THEN true
    WHEN public.are_mutual_friends(auth.uid(), target_user_id) THEN true
    ELSE COALESCE(
      (SELECT allow_messages_from_strangers FROM privacy_settings WHERE user_id = target_user_id),
      false
    )
  END;
$$;

-- Update profiles RLS to respect privacy settings
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

CREATE POLICY "Users can view profiles respecting privacy"
ON profiles FOR SELECT TO authenticated
USING (public.can_view_profile(id));

-- Ensure users can always update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure users can insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- Update privacy_settings RLS
DROP POLICY IF EXISTS "Users can view their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can update their own privacy settings" ON privacy_settings;
DROP POLICY IF EXISTS "Users can insert their own privacy settings" ON privacy_settings;

CREATE POLICY "Users can view their own privacy settings"
ON privacy_settings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own privacy settings"
ON privacy_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own privacy settings"
ON privacy_settings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update friend_requests to respect privacy
DROP POLICY IF EXISTS "Users can send friend requests" ON friend_requests;
DROP POLICY IF EXISTS "Users can send friend requests respecting privacy" ON friend_requests;

CREATE POLICY "Users can send friend requests respecting privacy"
ON friend_requests FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id 
  AND public.can_send_friend_request(receiver_id)
);

-- Recreate the messages policy using can_message_stranger for better flexibility
CREATE POLICY "Users can message friends or allowed strangers"
ON messages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversation_id
    AND cp.user_id = auth.uid()
  )
);
