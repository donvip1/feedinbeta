-- Add foreign key constraints to friend_requests to link with profiles
ALTER TABLE public.friend_requests
  DROP CONSTRAINT IF EXISTS friend_requests_sender_id_fkey,
  DROP CONSTRAINT IF EXISTS friend_requests_receiver_id_fkey;

ALTER TABLE public.friend_requests
  ADD CONSTRAINT friend_requests_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT friend_requests_receiver_id_fkey 
    FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add foreign key constraint to conversation_participants
ALTER TABLE public.conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_user_id_fkey;

ALTER TABLE public.conversation_participants
  ADD CONSTRAINT conversation_participants_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create indexes for better query performance if they don't exist
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_id ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_id ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON public.conversation_participants(user_id);