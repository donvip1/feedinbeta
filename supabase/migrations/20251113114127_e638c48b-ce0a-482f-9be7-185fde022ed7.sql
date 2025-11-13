-- Create RPC function to fetch message read receipts
CREATE OR REPLACE FUNCTION get_message_read_receipts(message_ids UUID[])
RETURNS TABLE (
  message_id UUID,
  user_id UUID,
  read_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mrr.message_id,
    mrr.user_id,
    mrr.read_at
  FROM message_read_receipts mrr
  WHERE mrr.message_id = ANY(message_ids);
END;
$$;