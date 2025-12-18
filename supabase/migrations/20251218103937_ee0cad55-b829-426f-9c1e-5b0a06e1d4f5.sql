-- Drop existing function first to recreate with correct parameter name
DROP FUNCTION IF EXISTS get_my_stream_key(UUID);

-- Add function to safely get stream key (owner only)
CREATE OR REPLACE FUNCTION get_my_stream_key(stream_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stream_key TEXT;
  v_user_id UUID;
BEGIN
  -- Get the stream and verify ownership
  SELECT stream_key, user_id INTO v_stream_key, v_user_id
  FROM live_streams
  WHERE id = stream_id_param;
  
  -- Only return stream key if caller is the owner
  IF v_user_id = auth.uid() THEN
    RETURN v_stream_key;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Revoke direct access to get_my_stream_key from anon
REVOKE ALL ON FUNCTION get_my_stream_key(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION get_my_stream_key(UUID) TO authenticated;