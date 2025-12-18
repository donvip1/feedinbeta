
-- Drop existing functions first to allow recreation
DROP FUNCTION IF EXISTS public.send_live_gift(UUID, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.send_gift(UUID, TEXT, INTEGER, TEXT, UUID);

-- Update send_gift function to also record profit
CREATE OR REPLACE FUNCTION public.send_gift(
  p_receiver_id UUID,
  p_gift_type TEXT,
  p_credit_value INTEGER,
  p_source_type TEXT DEFAULT 'post',
  p_source_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_sender_balance INTEGER;
  v_platform_fee INTEGER;
  v_creator_amount INTEGER;
BEGIN
  -- Get the sender (current user)
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cannot gift yourself
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send gift to yourself';
  END IF;

  -- Check sender balance
  SELECT balance INTO v_sender_balance
  FROM user_credits WHERE user_id = v_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_credit_value THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Calculate platform fee (5%) and creator amount (95%)
  v_platform_fee := FLOOR(p_credit_value * 0.05);
  v_creator_amount := p_credit_value - v_platform_fee;

  -- Deduct from sender
  UPDATE user_credits SET balance = balance - p_credit_value WHERE user_id = v_sender_id;

  -- Add to receiver (95%)
  INSERT INTO user_credits (user_id, balance) VALUES (p_receiver_id, v_creator_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_creator_amount;

  -- Record transactions
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES 
    (v_sender_id, -p_credit_value, 'gift_sent', 'Sent ' || p_gift_type || ' gift', p_source_id),
    (p_receiver_id, v_creator_amount, 'gift_received', 'Received ' || p_gift_type || ' gift (after 5% fee)', p_source_id);

  -- Add platform fee to platform wallet
  UPDATE platform_wallet 
  SET balance = balance + v_platform_fee, 
      gift_revenue = COALESCE(gift_revenue, 0) + v_platform_fee,
      total_earned = total_earned + v_platform_fee
  WHERE id = (SELECT id FROM platform_wallet LIMIT 1);

  -- Record profit to profits wallet
  PERFORM record_profit(
    v_platform_fee, 
    'gift_fee', 
    p_source_type, 
    p_source_id, 
    'Gift fee from ' || p_gift_type || ' (' || p_credit_value || ' credits)'
  );

  -- Log to gift analytics
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id)
  VALUES (v_sender_id, p_receiver_id, p_gift_type, p_credit_value, v_platform_fee, p_source_type, p_source_id);

  -- Update post gifts count if source is post
  IF p_source_type = 'post' AND p_source_id IS NOT NULL THEN
    UPDATE posts SET gifts_count = COALESCE(gifts_count, 0) + 1 WHERE id = p_source_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- Update send_live_gift function to also record profit
CREATE OR REPLACE FUNCTION public.send_live_gift(
  p_stream_id UUID,
  p_receiver_id UUID,
  p_gift_type TEXT,
  p_credit_value INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_sender_balance INTEGER;
  v_platform_fee INTEGER;
  v_creator_amount INTEGER;
BEGIN
  -- Get the sender (current user)
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cannot gift yourself
  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send gift to yourself';
  END IF;

  -- Check sender balance
  SELECT balance INTO v_sender_balance
  FROM user_credits WHERE user_id = v_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_credit_value THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Calculate platform fee (5%) and creator amount (95%)
  v_platform_fee := FLOOR(p_credit_value * 0.05);
  v_creator_amount := p_credit_value - v_platform_fee;

  -- Deduct from sender
  UPDATE user_credits SET balance = balance - p_credit_value WHERE user_id = v_sender_id;

  -- Add to receiver (95%)
  INSERT INTO user_credits (user_id, balance) VALUES (p_receiver_id, v_creator_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_creator_amount;

  -- Record transactions
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES 
    (v_sender_id, -p_credit_value, 'live_gift_sent', 'Sent ' || p_gift_type || ' gift in live stream', p_stream_id),
    (p_receiver_id, v_creator_amount, 'live_gift_received', 'Received ' || p_gift_type || ' gift in live stream (after 5% fee)', p_stream_id);

  -- Add platform fee to platform wallet
  UPDATE platform_wallet 
  SET balance = balance + v_platform_fee, 
      gift_revenue = COALESCE(gift_revenue, 0) + v_platform_fee,
      total_earned = total_earned + v_platform_fee
  WHERE id = (SELECT id FROM platform_wallet LIMIT 1);

  -- Record profit to profits wallet
  PERFORM record_profit(
    v_platform_fee, 
    'live_gift_fee', 
    'live_stream', 
    p_stream_id, 
    'Live gift fee from ' || p_gift_type || ' (' || p_credit_value || ' credits)'
  );

  -- Record the live stream gift
  INSERT INTO live_stream_gifts (stream_id, sender_id, receiver_id, gift_type, credit_value)
  VALUES (p_stream_id, v_sender_id, p_receiver_id, p_gift_type, p_credit_value);

  -- Log to gift analytics
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id)
  VALUES (v_sender_id, p_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'live_stream', p_stream_id);

  RETURN TRUE;
END;
$$;

-- Function to withdraw from profits wallet (admin only)
CREATE OR REPLACE FUNCTION public.admin_withdraw_from_profits(
  p_amount BIGINT,
  p_reason TEXT DEFAULT 'Withdrawal'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance BIGINT;
  v_new_balance BIGINT;
BEGIN
  -- Check admin permission
  IF NOT can_manage_credits() THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM profits_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance in profits wallet';
  END IF;

  -- Update profits wallet
  UPDATE profits_wallet
  SET 
    balance = balance - p_amount,
    total_withdrawn = total_withdrawn + p_amount,
    last_withdrawal_at = NOW(),
    updated_at = NOW()
  WHERE id = '00000000-0000-0000-0000-000000000001'
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO profits_transactions (
    transaction_type, amount, description, performed_by, balance_after
  ) VALUES (
    'withdrawal', -p_amount, p_reason, auth.uid(), v_new_balance
  );

  -- Also log to platform transactions
  INSERT INTO platform_transactions (transaction_type, amount, description, performed_by)
  VALUES ('profits_withdrawal', p_amount, p_reason, auth.uid());

  RETURN TRUE;
END;
$$;
