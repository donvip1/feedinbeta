CREATE OR REPLACE FUNCTION public.send_space_gift(
  p_space_id UUID,
  p_gift_type TEXT,
  p_credit_value INTEGER,
  p_receiver_id UUID DEFAULT NULL
)
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
  v_profits_wallet_id UUID;
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

  -- Determine receiver
  IF p_receiver_id IS NOT NULL THEN
    v_receiver_id := p_receiver_id;
  ELSE
    SELECT user_id INTO v_receiver_id FROM live_spaces WHERE id = p_space_id;
  END IF;
  
  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Space not found');
  END IF;

  IF v_receiver_id = v_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot gift yourself');
  END IF;

  -- Check sender balance
  SELECT balance INTO v_sender_balance FROM user_credits WHERE user_id = v_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_credit_value THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Calculate platform fee (15% for live gifts, 85/15 split)
  v_platform_fee := GREATEST(1, (p_credit_value * 15) / 100);
  v_receiver_amount := p_credit_value - v_platform_fee;

  -- Deduct from sender via credit_transactions (apply_credit_transaction trigger handles balance)
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_sender_id, -p_credit_value, 'live_gift_sent', 'Space gift sent: ' || p_gift_type, p_space_id);

  -- Record platform fee in profits
  INSERT INTO profits_transactions (amount, transaction_type, source_type, source_id, description)
  VALUES (v_platform_fee, 'gift_fee', 'live_gift', p_space_id, 'Platform fee from space gift');

  -- Update profits wallet
  SELECT id INTO v_profits_wallet_id FROM profits_wallet LIMIT 1;
  IF v_profits_wallet_id IS NOT NULL THEN
    UPDATE profits_wallet SET 
      balance = balance + v_platform_fee,
      total_collected = total_collected + v_platform_fee
    WHERE id = v_profits_wallet_id;
  END IF;

  -- Record in live_space_gifts table
  INSERT INTO live_space_gifts (space_id, sender_id, receiver_id, gift_type, credit_value)
  VALUES (p_space_id, v_sender_id, v_receiver_id, p_gift_type, p_credit_value);

  -- Record gift analytics - receiver converts this later via convert_gift/convert_all_gifts
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'live_space', p_space_id);

  RETURN json_build_object('success', true);
END;
$$;