-- Set developer account (tester1) to have high balance
UPDATE user_credits 
SET balance = 999999999, 
    total_earned = 999999999
WHERE user_id = 'd1683250-0cd7-42c5-b1d0-83423367419c';

-- Update transfer_credits to allow super_admins to bypass balance checks (can mint credits)
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
  v_is_super_admin BOOLEAN := false;
BEGIN
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if sender is super_admin (can bypass balance checks)
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = v_sender_id AND role = 'super_admin'
  ) INTO v_is_super_admin;

  -- Rate limiting: 5 seconds between transfers (skip for super_admin)
  IF NOT v_is_super_admin THEN
    SELECT created_at INTO v_last_transfer
    FROM credit_transactions
    WHERE user_id = v_sender_id 
      AND type IN ('gift_sent', 'live_gift_sent', 'transfer_sent')
    ORDER BY created_at DESC 
    LIMIT 1;

    IF v_last_transfer > now() - interval '5 seconds' THEN
      RETURN json_build_object('success', false, 'error', 'Please wait 5 seconds between transfers');
    END IF;

    -- Transaction amount cap: max 10,000 per transfer (skip for super_admin)
    IF p_amount > 10000 THEN
      RETURN json_build_object('success', false, 'error', 'Maximum transfer amount is 10,000 credits');
    END IF;

    -- Daily transfer limit: 50,000 credits (skip for super_admin)
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_total
    FROM credit_transactions
    WHERE user_id = v_sender_id
      AND type IN ('gift_sent', 'live_gift_sent', 'transfer_sent')
      AND created_at > now() - interval '24 hours';

    IF v_daily_total + p_amount > 50000 THEN
      RETURN json_build_object('success', false, 'error', 'Daily transfer limit of 50,000 credits exceeded');
    END IF;
  END IF;

  IF p_amount < 1 THEN
    RETURN json_build_object('success', false, 'error', 'Transfer amount must be at least 1 credit');
  END IF;

  -- Get recipient by username
  SELECT id INTO v_recipient_id FROM profiles WHERE username = p_recipient_username;
  
  IF v_recipient_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Recipient not found');
  END IF;

  IF v_recipient_id = v_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  -- Check sender balance (skip for super_admin - they can mint)
  IF NOT v_is_super_admin THEN
    SELECT balance INTO v_sender_balance FROM user_credits WHERE user_id = v_sender_id;
    
    IF v_sender_balance IS NULL OR v_sender_balance < p_amount THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient credits');
    END IF;
    
    -- Deduct from sender
    UPDATE user_credits 
    SET balance = balance - p_amount,
        total_spent = total_spent + p_amount 
    WHERE user_id = v_sender_id;
  ELSE
    -- Super admin: still deduct but ensure record exists
    INSERT INTO user_credits (user_id, balance, total_spent)
    VALUES (v_sender_id, -p_amount, p_amount)
    ON CONFLICT (user_id) DO UPDATE 
    SET balance = user_credits.balance - p_amount,
        total_spent = user_credits.total_spent + p_amount;
  END IF;
  
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
  VALUES (v_recipient_id, p_amount, 'transfer_received', 'Transfer received from super_admin');

  RETURN json_build_object('success', true, 'minted', v_is_super_admin);
END;
$$;