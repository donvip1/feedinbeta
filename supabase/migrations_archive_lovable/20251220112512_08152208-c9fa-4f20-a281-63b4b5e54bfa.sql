-- Add unique constraint to prevent duplicate friend requests
-- First, remove any existing duplicate requests, keeping only the most recent one
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY 
      LEAST(sender_id, receiver_id), 
      GREATEST(sender_id, receiver_id) 
    ORDER BY created_at DESC
  ) as rn
  FROM friend_requests
)
DELETE FROM friend_requests WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Create unique index to prevent duplicate requests in either direction
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_unique_pair 
ON friend_requests (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id));