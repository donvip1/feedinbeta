-- Optimized RPC function to get all conversations with details in single query
CREATE OR REPLACE FUNCTION get_conversations_with_details(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  updated_at TIMESTAMPTZ,
  other_user_id UUID,
  other_user_display_name TEXT,
  other_user_username TEXT,
  other_user_avatar_url TEXT,
  last_message_content TEXT,
  last_message_created_at TIMESTAMPTZ,
  last_message_sender_id UUID,
  unread_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_conversations AS (
    SELECT cp.conversation_id
    FROM conversation_participants cp
    WHERE cp.user_id = p_user_id
  ),
  other_participants AS (
    SELECT 
      cp.conversation_id,
      cp.user_id as other_user_id
    FROM conversation_participants cp
    INNER JOIN user_conversations uc ON uc.conversation_id = cp.conversation_id
    WHERE cp.user_id != p_user_id
  ),
  last_messages AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at,
      m.sender_id
    FROM messages m
    INNER JOIN user_conversations uc ON uc.conversation_id = m.conversation_id
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread_counts AS (
    SELECT 
      m.conversation_id,
      COUNT(*) as unread_count
    FROM messages m
    INNER JOIN user_conversations uc ON uc.conversation_id = m.conversation_id
    WHERE m.sender_id != p_user_id
      AND m.is_read = false
    GROUP BY m.conversation_id
  )
  SELECT 
    c.id as conversation_id,
    c.updated_at,
    op.other_user_id,
    p.display_name as other_user_display_name,
    p.username as other_user_username,
    p.avatar_url as other_user_avatar_url,
    lm.content as last_message_content,
    lm.created_at as last_message_created_at,
    lm.sender_id as last_message_sender_id,
    COALESCE(uc.unread_count, 0) as unread_count
  FROM conversations c
  INNER JOIN user_conversations uconv ON uconv.conversation_id = c.id
  LEFT JOIN other_participants op ON op.conversation_id = c.id
  LEFT JOIN profiles p ON p.id = op.other_user_id
  LEFT JOIN last_messages lm ON lm.conversation_id = c.id
  LEFT JOIN unread_counts uc ON uc.conversation_id = c.id
  ORDER BY c.updated_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_conversations_with_details(UUID) TO authenticated;