-- Add secret message support to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_secret BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS view_once_timer INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS viewed_by UUID[] DEFAULT '{}';

-- Add stream admin features to live_streams table
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS is_chat_locked BOOLEAN DEFAULT false;
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS banned_users UUID[] DEFAULT '{}';

-- Create index for efficient secret message cleanup
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at) WHERE expires_at IS NOT NULL;