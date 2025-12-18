
-- Create a secure function for post promotion
CREATE OR REPLACE FUNCTION public.promote_post(
  p_post_id UUID,
  p_plan_name TEXT,
  p_cost INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_balance INTEGER;
  v_user_id UUID;
  result JSON;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check user balance
  SELECT balance INTO user_balance
  FROM user_credits
  WHERE user_id = v_user_id;

  IF user_balance IS NULL OR user_balance < p_cost THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %, required: %', COALESCE(user_balance, 0), p_cost;
  END IF;

  -- Verify post exists
  IF NOT EXISTS (SELECT 1 FROM posts WHERE id = p_post_id) THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Deduct credits via transaction
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (v_user_id, 'spent', -p_cost, p_plan_name || ' - Post promotion', p_post_id);

  -- Return success
  SELECT json_build_object(
    'success', true,
    'message', 'Post promoted successfully',
    'plan', p_plan_name,
    'cost', p_cost,
    'new_balance', user_balance - p_cost
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.promote_post(UUID, TEXT, INTEGER) TO authenticated;

-- Also ensure send_gift function is properly configured
DROP FUNCTION IF EXISTS public.send_gift(UUID, UUID, UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.send_gift(
  p_sender_id UUID,
  p_recipient_id UUID,
  p_post_id UUID,
  p_gift_type TEXT,
  p_cost INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_balance INTEGER;
  result JSON;
BEGIN
  -- Verify the sender is the current authenticated user
  IF auth.uid() != p_sender_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only send gifts from your own account';
  END IF;

  -- Validate cost
  IF p_cost <= 0 THEN
    RAISE EXCEPTION 'Invalid gift cost';
  END IF;

  -- Check sender balance
  SELECT balance INTO sender_balance
  FROM user_credits
  WHERE user_id = p_sender_id;

  IF sender_balance IS NULL OR sender_balance < p_cost THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %', COALESCE(sender_balance, 0);
  END IF;

  -- Deduct from sender
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (p_sender_id, 'gift_sent', -p_cost, 'Sent ' || p_gift_type || ' gift', p_post_id);

  -- Add to recipient (80% of gift value - 20% platform fee)
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (p_recipient_id, 'gift_received', FLOOR(p_cost * 0.8), 'Received ' || p_gift_type || ' gift', p_post_id);

  -- Create notification for recipient
  INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
  VALUES (
    p_recipient_id,
    p_sender_id,
    'gift',
    'You received a gift!',
    'Someone sent you a ' || p_gift_type || ' gift worth ' || p_cost || ' credits',
    p_post_id,
    'post'
  );

  -- Return success
  SELECT json_build_object(
    'success', true,
    'message', 'Gift sent successfully',
    'gift_type', p_gift_type,
    'amount', p_cost
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.send_gift(UUID, UUID, UUID, TEXT, INTEGER) TO authenticated;
