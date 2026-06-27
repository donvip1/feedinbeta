-- Create scheduled_messages table for storing messages to be sent at a specific time
CREATE TABLE public.scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scheduled_messages_target_check CHECK (
    (conversation_id IS NOT NULL AND group_id IS NULL) OR 
    (conversation_id IS NULL AND group_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Users can view their own scheduled messages
CREATE POLICY "Users can view their own scheduled messages"
ON public.scheduled_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own scheduled messages
CREATE POLICY "Users can create their own scheduled messages"
ON public.scheduled_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own scheduled messages
CREATE POLICY "Users can update their own scheduled messages"
ON public.scheduled_messages
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own scheduled messages
CREATE POLICY "Users can delete their own scheduled messages"
ON public.scheduled_messages
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for efficient querying of pending messages
CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages (scheduled_at) 
WHERE status = 'pending';

-- Create index for user lookups
CREATE INDEX idx_scheduled_messages_user ON public.scheduled_messages (user_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_messages_updated_at
BEFORE UPDATE ON public.scheduled_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();