-- Add foreign key constraint for message replies
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_reply_to_id_fkey 
    FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL;

-- Add foreign key constraint to link messages with profiles
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON public.messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);