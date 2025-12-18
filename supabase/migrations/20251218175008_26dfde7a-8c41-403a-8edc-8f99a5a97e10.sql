-- Add policy to allow users to mark messages as read in their conversations
-- Users should be able to update is_read and read_at for messages sent TO them

CREATE POLICY "Users can mark messages as read in their conversations"
ON public.messages
FOR UPDATE
USING (
  is_conversation_participant(auth.uid(), conversation_id) 
  AND sender_id != auth.uid()
)
WITH CHECK (
  is_conversation_participant(auth.uid(), conversation_id) 
  AND sender_id != auth.uid()
);

-- Also create a function to mark all messages as read for a conversation
CREATE OR REPLACE FUNCTION public.mark_conversation_read(conv_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE messages
  SET is_read = true, read_at = now()
  WHERE conversation_id = conv_id
    AND sender_id != auth.uid()
    AND is_read = false
    AND is_conversation_participant(auth.uid(), conv_id);
END;
$$;