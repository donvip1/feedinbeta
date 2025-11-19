-- Add attachment metadata tracking for auto-deletion
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  downloaded_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_attachments
CREATE POLICY "Users can view attachments in their conversations"
  ON public.message_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE m.id = message_attachments.message_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create attachments for their messages"
  ON public.message_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = message_attachments.message_id
      AND m.sender_id = auth.uid()
    )
  );

CREATE POLICY "Users can update download status"
  ON public.message_attachments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
      WHERE m.id = message_attachments.message_id
      AND cp.user_id = auth.uid()
    )
  );

-- Function to mark attachment as downloaded
CREATE OR REPLACE FUNCTION mark_attachment_downloaded(attachment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.message_attachments
  SET downloaded_at = now()
  WHERE id = attachment_id
  AND downloaded_at IS NULL;
END;
$$;

-- Function to get expired attachments (24 hours after download)
CREATE OR REPLACE FUNCTION get_expired_attachments()
RETURNS TABLE (
  id UUID,
  file_path TEXT,
  message_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ma.id,
    ma.file_path,
    ma.message_id
  FROM public.message_attachments ma
  WHERE ma.downloaded_at IS NOT NULL
  AND ma.deleted_at IS NULL
  AND ma.downloaded_at < now() - interval '24 hours';
END;
$$;

-- Update messages table to add read_at timestamp if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'read_by_receiver_at'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN read_by_receiver_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_message_attachments_downloaded 
  ON public.message_attachments(downloaded_at, deleted_at) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_read_status
  ON public.messages(conversation_id, is_read, read_by_receiver_at);

-- Add unread message count function per conversation
CREATE OR REPLACE FUNCTION get_unread_message_count(conv_id UUID, uid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO unread_count
  FROM public.messages m
  WHERE m.conversation_id = conv_id
  AND m.sender_id != uid
  AND (m.is_read = false OR m.is_read IS NULL);
  
  RETURN COALESCE(unread_count, 0);
END;
$$;