-- Create unified message search function for both DMs and groups
CREATE OR REPLACE FUNCTION public.search_messages(
  p_user_id UUID,
  p_conversation_id UUID DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_query TEXT DEFAULT NULL,
  p_sender_id UUID DEFAULT NULL,
  p_media_type TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  sender_id UUID,
  sender_name TEXT,
  sender_avatar TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ,
  context_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  -- DM messages
  SELECT 
    m.id,
    m.content,
    m.sender_id,
    p.display_name::TEXT,
    p.avatar_url::TEXT,
    m.media_url::TEXT,
    m.media_type::TEXT,
    m.created_at,
    'dm'::TEXT as context_type
  FROM messages m
  JOIN profiles p ON p.id = m.sender_id
  JOIN conversation_participants cp1 ON cp1.conversation_id = m.conversation_id AND cp1.user_id = p_user_id
  WHERE 
    p_conversation_id IS NOT NULL
    AND m.conversation_id = p_conversation_id
    AND m.deleted_at IS NULL
    AND (p_query IS NULL OR m.content ILIKE '%' || p_query || '%')
    AND (p_sender_id IS NULL OR m.sender_id = p_sender_id)
    AND (p_start_date IS NULL OR m.created_at >= p_start_date)
    AND (p_end_date IS NULL OR m.created_at <= p_end_date)
    AND (
      p_media_type IS NULL 
      OR (p_media_type = 'all_media' AND m.media_url IS NOT NULL)
      OR m.media_type ILIKE p_media_type || '%'
    )
  
  UNION ALL
  
  -- Group messages
  SELECT 
    gm.id,
    gm.content,
    gm.sender_id,
    p.display_name::TEXT,
    p.avatar_url::TEXT,
    gm.media_url::TEXT,
    gm.media_type::TEXT,
    gm.created_at,
    'group'::TEXT as context_type
  FROM group_messages gm
  JOIN profiles p ON p.id = gm.sender_id
  JOIN group_members gme ON gme.group_id = gm.group_id AND gme.user_id = p_user_id
  WHERE 
    p_group_id IS NOT NULL
    AND gm.group_id = p_group_id
    AND gm.deleted_at IS NULL
    AND (p_query IS NULL OR gm.content ILIKE '%' || p_query || '%')
    AND (p_sender_id IS NULL OR gm.sender_id = p_sender_id)
    AND (p_start_date IS NULL OR gm.created_at >= p_start_date)
    AND (p_end_date IS NULL OR gm.created_at <= p_end_date)
    AND (
      p_media_type IS NULL 
      OR (p_media_type = 'all_media' AND gm.media_url IS NOT NULL)
      OR gm.media_type ILIKE p_media_type || '%'
    )
  
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;