
-- Fix send_gift function to NOT manually update balances
-- The apply_credit_transaction trigger handles balance updates automatically
CREATE OR REPLACE FUNCTION public.send_gift(p_post_id uuid, p_gift_type text, p_credit_value integer)
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

  -- Check sender balance (ensure user_credits record exists)
  SELECT balance INTO v_sender_balance FROM user_credits WHERE user_id = v_sender_id;
  
  IF v_sender_balance IS NULL THEN
    -- Create credit record for sender if it doesn't exist
    INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
    VALUES (v_sender_id, 0, 0, 0);
    v_sender_balance := 0;
  END IF;
  
  IF v_sender_balance < p_credit_value THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits. You have ' || v_sender_balance || ' credits.');
  END IF;

  -- Calculate platform fee (5%)
  v_platform_fee := GREATEST(1, (p_credit_value * 5) / 100);
  v_receiver_amount := p_credit_value - v_platform_fee;

  -- Record transactions - the trigger will automatically update balances
  -- Sender deduction (negative amount)
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Gift sent: ' || p_gift_type, p_post_id);

  -- Receiver credit (positive amount minus platform fee)
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_receiver_id, v_receiver_amount, 'gift_received', 'Gift received: ' || p_gift_type, p_post_id);

  -- Record platform fee
  INSERT INTO profits_transactions (amount, transaction_type, source_type, source_id, description)
  VALUES (v_platform_fee, 'gift_fee', 'post_gift', p_post_id, 'Platform fee from gift');

  -- Update profits wallet
  UPDATE profits_wallet SET 
    balance = balance + v_platform_fee,
    total_collected = total_collected + v_platform_fee
  WHERE id = (SELECT id FROM profits_wallet LIMIT 1);

  -- Record gift analytics
  INSERT INTO gift_analytics (sender_id, receiver_id, post_id, gift_type, credit_value, platform_fee)
  VALUES (v_sender_id, v_receiver_id, p_post_id, p_gift_type, p_credit_value, v_platform_fee);

  -- Create notification for receiver
  INSERT INTO notifications (user_id, type, title, message, related_id, related_type, actor_id)
  VALUES (
    v_receiver_id, 
    'gift_received', 
    'Gift Received!', 
    'You received a ' || p_gift_type || ' gift worth ' || v_receiver_amount || ' credits!',
    p_post_id,
    'post',
    v_sender_id
  );

  RETURN json_build_object(
    'success', true, 
    'gift_type', p_gift_type,
    'credit_value', p_credit_value,
    'receiver_amount', v_receiver_amount,
    'platform_fee', v_platform_fee
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;
