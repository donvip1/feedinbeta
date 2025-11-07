-- Add pinned messages support
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(conversation_id, is_pinned) WHERE is_pinned = true;