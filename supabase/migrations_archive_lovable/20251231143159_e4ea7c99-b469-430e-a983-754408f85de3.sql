-- Fix admin_transfer_to_user to actually add credits to user's balance
CREATE OR REPLACE FUNCTION admin_transfer_to_user(p_user_id UUID, p_amount INTEGER, p_reason TEXT DEFAULT 'Admin transfer')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  platform_balance BIGINT;
  result JSON;
BEGIN
  -- STRICT: Only admin/super_admin role can transfer
  IF NOT has_role(auth.uid(), 'admin'::app_role) AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only super admins can transfer credits';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Check platform wallet balance
  SELECT balance INTO platform_balance FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  IF platform_balance IS NULL OR platform_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  -- Deduct from platform wallet
  UPDATE platform_wallet
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- CRITICAL FIX: Actually add credits to user's balance
  INSERT INTO user_credits (user_id, balance, total_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE 
  SET balance = user_credits.balance + p_amount,
      total_earned = user_credits.total_earned + p_amount;

  -- Record transaction for recipient
  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'admin_transfer', p_amount, p_reason);

  -- Record platform transaction
  INSERT INTO platform_transactions (transaction_type, amount, to_user_id, performed_by, description)
  VALUES ('transfer', p_amount, p_user_id, auth.uid(), p_reason);

  SELECT json_build_object(
    'success', true,
    'transferred', p_amount,
    'to_user', p_user_id
  ) INTO result;

  RETURN result;
END;
$$;

-- Also update the transfer_credits function to also update total_earned for recipients
CREATE OR REPLACE FUNCTION transfer_credits(p_recipient_username TEXT, p_amount INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_recipient_id UUID;
  v_sender_balance INTEGER;
  v_last_transfer TIMESTAMPTZ;
  v_daily_total INTEGER;
BEGIN
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Rate limiting: 5 seconds between transfers
  SELECT created_at INTO v_last_transfer
  FROM credit_transactions
  WHERE user_id = v_sender_id 
    AND type IN ('gift_sent', 'live_gift_sent', 'transfer_sent')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_last_transfer > now() - interval '5 seconds' THEN
    RETURN json_build_object('success', false, 'error', 'Please wait 5 seconds between transfers');
  END IF;

  -- Transaction amount cap: max 10,000 per transfer
  IF p_amount > 10000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum transfer amount is 10,000 credits');
  END IF;

  IF p_amount < 1 THEN
    RETURN json_build_object('success', false, 'error', 'Transfer amount must be at least 1 credit');
  END IF;

  -- Daily transfer limit: 50,000 credits
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_total
  FROM credit_transactions
  WHERE user_id = v_sender_id
    AND type IN ('gift_sent', 'live_gift_sent', 'transfer_sent')
    AND created_at > now() - interval '24 hours';

  IF v_daily_total + p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Daily transfer limit of 50,000 credits exceeded');
  END IF;

  -- Get recipient by username
  SELECT id INTO v_recipient_id FROM profiles WHERE username = p_recipient_username;
  
  IF v_recipient_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Recipient not found');
  END IF;

  IF v_recipient_id = v_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  -- Check sender balance
  SELECT balance INTO v_sender_balance FROM user_credits WHERE user_id = v_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Deduct from sender
  UPDATE user_credits 
  SET balance = balance - p_amount,
      total_spent = total_spent + p_amount 
  WHERE user_id = v_sender_id;
  
  -- Add to recipient (with total_earned update)
  INSERT INTO user_credits (user_id, balance, total_earned) 
  VALUES (v_recipient_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE 
  SET balance = user_credits.balance + p_amount,
      total_earned = user_credits.total_earned + p_amount;

  -- Record transactions
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_sender_id, -p_amount, 'transfer_sent', 'Transfer to ' || p_recipient_username);

  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (v_recipient_id, p_amount, 'transfer_received', 'Transfer received');

  RETURN json_build_object('success', true);
END;
$$;