
-- Fix the process_gift_with_split function - add WHERE clause to UPDATE
CREATE OR REPLACE FUNCTION public.process_gift_with_split()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  gift_value NUMERIC;
  platform_cut NUMERIC;
  creator_cut NUMERIC;
  wallet_id UUID;
BEGIN
  gift_value := NEW.credit_value;
  platform_cut := gift_value * 0.70;
  creator_cut := gift_value * 0.30;
  
  -- Get the platform wallet ID
  SELECT id INTO wallet_id FROM platform_wallet LIMIT 1;
  
  -- Update platform wallet with platform's 70% share (with WHERE clause)
  IF wallet_id IS NOT NULL THEN
    UPDATE platform_wallet 
    SET 
      gift_revenue = COALESCE(gift_revenue, 0) + platform_cut,
      platform_profit = COALESCE(platform_profit, 0) + platform_cut,
      total_earned = COALESCE(total_earned, 0) + platform_cut,
      creator_payouts_total = COALESCE(creator_payouts_total, 0) + creator_cut,
      updated_at = now()
    WHERE id = wallet_id;
  END IF;
  
  -- Add creator's 30% share to their wallet
  INSERT INTO user_credits (user_id, balance)
  VALUES (NEW.receiver_id, creator_cut)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + creator_cut;
  
  -- Record transaction for creator
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (NEW.receiver_id, creator_cut, 'gift_received', 'Gift received (30% of ' || gift_value || ')', NEW.id);
  
  -- Record platform transaction
  INSERT INTO platform_transactions (transaction_type, amount, description, from_user_id, to_user_id)
  VALUES ('gift_fee', platform_cut, 'Platform share (70%) from gift', NEW.sender_id, NULL);
  
  RETURN NEW;
END;
$function$;

-- Also fix the profits_wallet UPDATE in send_live_gift if it has the same issue
CREATE OR REPLACE FUNCTION public.send_live_gift(p_stream_id uuid, p_gift_type text, p_credit_value integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Update profits wallet with WHERE clause
  SELECT id INTO v_profits_wallet_id FROM profits_wallet LIMIT 1;
  IF v_profits_wallet_id IS NOT NULL THEN
    UPDATE profits_wallet SET 
      balance = balance + v_platform_fee,
      total_collected = total_collected + v_platform_fee
    WHERE id = v_profits_wallet_id;
  END IF;

  -- Record in live_stream_gifts table
  INSERT INTO live_stream_gifts (stream_id, sender_id, receiver_id, gift_type, credit_value)
  VALUES (p_stream_id, v_sender_id, v_receiver_id, p_gift_type, p_credit_value);

  -- Record gift analytics
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'live_stream', p_stream_id);

  RETURN json_build_object('success', true);
END;
$function$;
