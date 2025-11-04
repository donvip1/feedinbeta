-- Create function to check if two users are mutual friends
CREATE OR REPLACE FUNCTION public.are_mutual_friends(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if there's an accepted friend request in either direction
  RETURN EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status = 'accepted'
    AND (
      (sender_id = user_a AND receiver_id = user_b) OR
      (sender_id = user_b AND receiver_id = user_a)
    )
  );
END;
$$;

-- Update the create_conversation function to require mutual friendship
CREATE OR REPLACE FUNCTION public.create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conversation_id UUID;
  current_user_id UUID;
  existing_conversation_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Validate that we're not creating a conversation with ourselves
  IF current_user_id = other_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;
  
  -- Validate that the other user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- NEW: Check if users are mutual friends
  IF NOT are_mutual_friends(current_user_id, other_user_id) THEN
    RAISE EXCEPTION 'You must be friends with this user to start a conversation';
  END IF;
  
  -- Check if conversation already exists between these two users
  SELECT c.id INTO existing_conversation_id
  FROM conversations c
  WHERE EXISTS (
    SELECT 1 FROM conversation_participants cp1
    WHERE cp1.conversation_id = c.id AND cp1.user_id = current_user_id
  )
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp2
    WHERE cp2.conversation_id = c.id AND cp2.user_id = other_user_id
  )
  AND (
    SELECT COUNT(*) FROM conversation_participants cp
    WHERE cp.conversation_id = c.id
  ) = 2
  LIMIT 1;
  
  -- If conversation exists, return it
  IF existing_conversation_id IS NOT NULL THEN
    RETURN existing_conversation_id;
  END IF;
  
  -- Create the conversation
  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO new_conversation_id;
  
  -- Add both participants
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES 
    (new_conversation_id, current_user_id),
    (new_conversation_id, other_user_id);
  
  RETURN new_conversation_id;
END;
$$;

-- Add RLS policy to prevent messaging non-friends
CREATE POLICY "Users can only message mutual friends" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND
  is_conversation_participant(auth.uid(), messages.conversation_id) AND
  -- Ensure the conversation only has 2 participants who are mutual friends
  EXISTS (
    SELECT 1 FROM conversation_participants cp1
    JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.conversation_id = messages.conversation_id
    AND cp1.user_id = auth.uid()
    AND cp2.user_id != auth.uid()
    AND are_mutual_friends(cp1.user_id, cp2.user_id)
  )
);

-- Update conversations RLS to require friendship
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations" 
ON public.conversations 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id 
    AND cp.user_id = auth.uid()
  )
);