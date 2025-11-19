-- Add metadata field to messages for storing reply context (story thumbnails, etc.)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'reply_metadata'
  ) THEN
    ALTER TABLE public.messages 
    ADD COLUMN reply_metadata JSONB;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_reply_metadata 
  ON public.messages USING GIN (reply_metadata);