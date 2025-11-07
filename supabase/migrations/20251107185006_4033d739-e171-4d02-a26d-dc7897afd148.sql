-- Add deletion tracking to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS deleted_for_sender BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_for_receiver BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient deletion queries
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted_for_sender, deleted_for_receiver);

-- Function to check if message can be deleted for everyone
CREATE OR REPLACE FUNCTION can_delete_for_everyone(message_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  msg RECORD;
  hours_since_read INTERVAL;
BEGIN
  SELECT * INTO msg FROM messages WHERE id = message_id AND sender_id = user_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Can delete if not read yet
  IF NOT msg.is_read OR msg.read_at IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Can delete if read less than 48 hours ago
  hours_since_read := NOW() - msg.read_at;
  IF hours_since_read < INTERVAL '48 hours' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;