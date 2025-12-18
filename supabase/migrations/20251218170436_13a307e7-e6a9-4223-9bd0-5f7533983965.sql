
-- Add missing source_type column to profits_transactions table
ALTER TABLE public.profits_transactions 
ADD COLUMN IF NOT EXISTS source_type TEXT;

-- Update send_gift function to work correctly
CREATE OR REPLACE FUNCTION public.send_gift(p_post_id UUID, p_gift_type TEXT, p_credit_value INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_sender_balance INTEGER;
  v_platform_fee INTEGER;
  v_receiver_amount INTEGER;
  v_last_gift TIMESTAMPTZ;
  v_daily_total INTEGER;
BEGIN
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Rate limiting: 5 seconds between gifts
  SELECT created_at INTO v_last_gift
  FROM credit_transactions
  WHERE user_id = v_sender_id 
    AND type IN ('gift_sent', 'live_gift_sent', 'transfer_sent')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_last_gift > now() - interval '5 seconds' THEN
    RETURN json_build_object('success', false, 'error', 'Please wait 5 seconds between transfers');
  END IF;

  -- Transaction amount cap
  IF p_credit_value > 10000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum gift amount is 10,000 credits');
  END IF;

  IF p_credit_value < 1 THEN
    RETURN json_build_object('success', false, 'error', 'Gift amount must be at least 1 credit');
  END IF;

  -- Daily transfer limit
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_total
  FROM credit_transactions
  WHERE user_id = v_sender_id
    AND type IN ('gift_sent', 'live_gift_sent', 'transfer_sent')
    AND created_at > now() - interval '24 hours';

  IF v_daily_total + p_credit_value > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Daily transfer limit of 50,000 credits exceeded');
  END IF;

  -- Get post owner
  SELECT user_id INTO v_receiver_id FROM posts WHERE id = p_post_id;
  
  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Post not found');
  END IF;

  IF v_receiver_id = v_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot gift yourself');
  END IF;

  -- Check sender balance
  SELECT balance INTO v_sender_balance FROM user_credits WHERE user_id = v_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_credit_value THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Calculate platform fee (5%)
  v_platform_fee := GREATEST(1, (p_credit_value * 5) / 100);
  v_receiver_amount := p_credit_value - v_platform_fee;

  -- Deduct from sender
  UPDATE user_credits SET balance = balance - p_credit_value WHERE user_id = v_sender_id;
  
  -- Add to receiver (minus fee)
  INSERT INTO user_credits (user_id, balance) VALUES (v_receiver_id, v_receiver_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_receiver_amount;

  -- Record transactions
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Gift sent: ' || p_gift_type, p_post_id);

  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_receiver_id, v_receiver_amount, 'gift_received', 'Gift received: ' || p_gift_type, p_post_id);

  -- Record platform fee (using correct columns)
  INSERT INTO profits_transactions (amount, transaction_type, source_type, source_id, description)
  VALUES (v_platform_fee, 'gift_fee', 'post_gift', p_post_id, 'Platform fee from gift');

  -- Update profits wallet
  UPDATE profits_wallet SET 
    balance = balance + v_platform_fee,
    total_collected = total_collected + v_platform_fee
  WHERE id = (SELECT id FROM profits_wallet LIMIT 1);

  -- Record gift analytics
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'post', p_post_id);

  -- Update post gifts count
  UPDATE posts SET gifts_count = COALESCE(gifts_count, 0) + p_credit_value WHERE id = p_post_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Also update send_live_gift to ensure consistency
CREATE OR REPLACE FUNCTION public.send_live_gift(p_stream_id UUID, p_gift_type TEXT, p_credit_value INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_receiver_id UUID;
  v_sender_balance INTEGER;
  v_platform_fee INTEGER;
  v_receiver_amount INTEGER;
  v_last_gift TIMESTAMPTZ;
  v_daily_total INTEGER;
BEGIN
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Rate limiting
  SELECT created_at INTO v_last_gift
  FROM credit_transactions
  WHERE user_id = v_sender_id 
    AND type IN ('gift_sent', 'live_gift_sent', 'transfer_sent')
  ORDER BY created_at DESC 
  LIMIT 1;

  IF v_last_gift > now() - interval '5 seconds' THEN
    RETURN json_build_object('success', false, 'error', 'Please wait 5 seconds between transfers');
  END IF;

  IF p_credit_value > 10000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum gift amount is 10,000 credits');
  END IF;

  IF p_credit_value < 1 THEN
    RETURN json_build_object('success', false, 'error', 'Gift amount must be at least 1 credit');
  END IF;

  -- Daily transfer limit
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_total
  FROM credit_transactions
  WHERE user_id = v_sender_id
    AND type IN ('gift_sent', 'live_gift_sent', 'transfer_sent')
    AND created_at > now() - interval '24 hours';

  IF v_daily_total + p_credit_value > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Daily transfer limit of 50,000 credits exceeded');
  END IF;

  -- Get stream owner
  SELECT user_id INTO v_receiver_id FROM live_streams WHERE id = p_stream_id;
  
  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Stream not found');
  END IF;

  IF v_receiver_id = v_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot gift yourself');
  END IF;

  -- Check sender balance
  SELECT balance INTO v_sender_balance FROM user_credits WHERE user_id = v_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_credit_value THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Calculate platform fee (5%)
  v_platform_fee := GREATEST(1, (p_credit_value * 5) / 100);
  v_receiver_amount := p_credit_value - v_platform_fee;

  -- Deduct from sender
  UPDATE user_credits SET balance = balance - p_credit_value WHERE user_id = v_sender_id;
  
  -- Add to receiver
  INSERT INTO user_credits (user_id, balance) VALUES (v_receiver_id, v_receiver_amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = user_credits.balance + v_receiver_amount;

  -- Record transactions
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_sender_id, -p_credit_value, 'live_gift_sent', 'Live gift sent: ' || p_gift_type, p_stream_id);

  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_receiver_id, v_receiver_amount, 'live_gift_received', 'Live gift received: ' || p_gift_type, p_stream_id);

  -- Record platform fee
  INSERT INTO profits_transactions (amount, transaction_type, source_type, source_id, description)
  VALUES (v_platform_fee, 'gift_fee', 'live_gift', p_stream_id, 'Platform fee from live gift');

  -- Update profits wallet
  UPDATE profits_wallet SET 
    balance = balance + v_platform_fee,
    total_collected = total_collected + v_platform_fee
  WHERE id = (SELECT id FROM profits_wallet LIMIT 1);

  -- Record in live_stream_gifts table
  INSERT INTO live_stream_gifts (stream_id, sender_id, receiver_id, gift_type, credit_value)
  VALUES (p_stream_id, v_sender_id, v_receiver_id, p_gift_type, p_credit_value);

  -- Record gift analytics
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'live_stream', p_stream_id);

  RETURN json_build_object('success', true);
END;
$$;
