-- Fix search_path security warnings for newly created functions

DROP FUNCTION IF EXISTS mark_attachment_downloaded(UUID);
CREATE OR REPLACE FUNCTION mark_attachment_downloaded(attachment_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.message_attachments
  SET downloaded_at = now()
  WHERE id = attachment_id
  AND downloaded_at IS NULL;
END;
$$;

DROP FUNCTION IF EXISTS get_expired_attachments();
CREATE OR REPLACE FUNCTION get_expired_attachments()
RETURNS TABLE (
  id UUID,
  file_path TEXT,
  message_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

DROP FUNCTION IF EXISTS get_unread_message_count(UUID, UUID);
CREATE OR REPLACE FUNCTION get_unread_message_count(conv_id UUID, uid UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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