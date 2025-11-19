-- Security Migration: Fix RLS policies and storage configuration

-- 1. Make chat storage buckets private
UPDATE storage.buckets 
SET public = false 
WHERE name IN (
  'chat-media',
  'chat-images', 
  'chat-videos',
  'chat-audio',
  'chat-documents'
);

-- 2. Add strict RLS policies for friend requests
-- Prevent self-approval of friend requests
CREATE POLICY "Only receiver can accept friend requests"
ON friend_requests FOR UPDATE
USING (
  auth.uid() = receiver_id
  AND status = 'pending'
)
WITH CHECK (
  auth.uid() = receiver_id
  AND status IN ('accepted', 'rejected')
);

-- Prevent sender from self-approving
CREATE POLICY "Sender cannot self-approve"
ON friend_requests FOR UPDATE
USING (
  auth.uid() = sender_id
  AND status = 'pending'
)
WITH CHECK (
  auth.uid() = sender_id
  AND status = 'cancelled'
);

-- Only allow senders to insert their own requests
CREATE POLICY "Users can only send friend requests as themselves"
ON friend_requests FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
);

-- 3. Add storage RLS policies for private chat media
CREATE POLICY "Users access own chat media"
ON storage.objects FOR SELECT
USING (
  bucket_id IN ('chat-images', 'chat-videos', 'chat-audio', 'chat-documents', 'chat-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('chat-images', 'chat-videos', 'chat-audio', 'chat-documents', 'chat-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own chat media"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('chat-images', 'chat-videos', 'chat-audio', 'chat-documents', 'chat-media')
  AND (storage.foldername(name))[1] = auth.uid()::text
);
