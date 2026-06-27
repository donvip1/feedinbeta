-- Create a secure function to handle gift transactions
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
SET search_path = 'public'
AS $$
DECLARE
  sender_balance INTEGER;
  result JSON;
BEGIN
  -- Verify the sender is the current authenticated user
  IF auth.uid() != p_sender_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only send gifts from your own account';
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

  -- Add to recipient
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (p_recipient_id, 'gift_received', p_cost, 'Received ' || p_gift_type || ' gift', p_post_id);

  -- Return success
  SELECT json_build_object(
    'success', true,
    'message', 'Gift sent successfully',
    'amount', p_cost
  ) INTO result;

  RETURN result;
END;
$$;

-- Create a function to transfer credits between users
CREATE OR REPLACE FUNCTION public.transfer_credits(
  p_recipient_username TEXT,
  p_amount INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  sender_id UUID;
  recipient_id UUID;
  sender_balance INTEGER;
  sender_username TEXT;
  result JSON;
BEGIN
  -- Get current user
  sender_id := auth.uid();
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check sender balance
  SELECT balance INTO sender_balance
  FROM user_credits
  WHERE user_id = sender_id;

  IF sender_balance IS NULL OR sender_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %', COALESCE(sender_balance, 0);
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Find recipient
  SELECT id INTO recipient_id
  FROM profiles
  WHERE username = p_recipient_username;

  IF recipient_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_recipient_username;
  END IF;

  IF recipient_id = sender_id THEN
    RAISE EXCEPTION 'Cannot transfer credits to yourself';
  END IF;

  -- Get sender username for description
  SELECT username INTO sender_username FROM profiles WHERE id = sender_id;

  -- Deduct from sender
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (sender_id, 'transfer_sent', -p_amount, 'Sent to @' || p_recipient_username, recipient_id);

  -- Add to recipient
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (recipient_id, 'transfer_received', p_amount, 'Received from @' || sender_username, sender_id);

  SELECT json_build_object(
    'success', true,
    'message', 'Transfer completed',
    'amount', p_amount,
    'recipient', p_recipient_username
  ) INTO result;

  RETURN result;
END;
$$;