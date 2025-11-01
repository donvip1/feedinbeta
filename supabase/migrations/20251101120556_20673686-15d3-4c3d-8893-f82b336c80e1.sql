-- Add foreign key from messages.sender_id to profiles
ALTER TABLE public.messages
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Add foreign key from conversation_participants.user_id to profiles
ALTER TABLE public.conversation_participants
ADD CONSTRAINT conversation_participants_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;