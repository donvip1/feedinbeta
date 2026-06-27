
-- Add reply_to_id column for threading in space messages
ALTER TABLE public.live_space_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.live_space_messages(id) ON DELETE SET NULL;

-- Index for efficient thread lookups
CREATE INDEX IF NOT EXISTS idx_live_space_messages_reply_to ON public.live_space_messages(reply_to_id);
