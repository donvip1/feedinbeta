-- Update send_gift function to log analytics
CREATE OR REPLACE FUNCTION public.send_gift(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_post_id uuid,
  p_gift_type text,
  p_cost integer
)
RETURNS json AS $$
DECLARE
  v_sender_balance integer;
  v_platform_fee integer;
  v_creator_amount integer;
BEGIN
  -- Calculate platform fee (5%) and creator amount (95%)
  v_platform_fee := GREATEST(1, (p_cost * 0.05)::integer);
  v_creator_amount := p_cost - v_platform_fee;
  
  -- Check sender balance
  SELECT balance INTO v_sender_balance
  FROM user_credits
  WHERE user_id = p_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_cost THEN
    RAISE EXCEPTION 'Insufficient credits. You have % credits but need %', COALESCE(v_sender_balance, 0), p_cost;
  END IF;
  
  -- Deduct from sender
  UPDATE user_credits
  SET balance = balance - p_cost, updated_at = now()
  WHERE user_id = p_sender_id;
  
  -- Add to recipient (minus platform fee)
  INSERT INTO user_credits (user_id, balance)
  VALUES (p_recipient_id, v_creator_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + v_creator_amount, updated_at = now();
  
  -- Add platform fee to platform wallet
  UPDATE platform_wallet
  SET balance = balance + v_platform_fee,
      gift_revenue = COALESCE(gift_revenue, 0) + v_platform_fee,
      total_earned = COALESCE(total_earned, 0) + v_platform_fee,
      updated_at = now();
  
  -- Log sender transaction
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (p_sender_id, -p_cost, 'gift_sent', 'Sent ' || p_gift_type || ' gift', p_post_id);
  
  -- Log recipient transaction  
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (p_recipient_id, v_creator_amount, 'gift_received', 'Received ' || p_gift_type || ' gift', p_post_id);
  
  -- Log platform transaction
  INSERT INTO platform_transactions (transaction_type, amount, description, from_user_id, to_user_id)
  VALUES ('gift_fee', v_platform_fee, 'Gift fee: ' || p_gift_type, p_sender_id, p_recipient_id);
  
  -- Log gift analytics
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, source_type, source_id, platform_fee)
  VALUES (p_sender_id, p_recipient_id, p_gift_type, p_cost, 'post', p_post_id, v_platform_fee);
  
  -- Create notification
  INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
  VALUES (p_recipient_id, p_sender_id, 'gift', 'New Gift!', 'You received a ' || p_gift_type || ' gift worth ' || v_creator_amount || ' credits', p_post_id, 'post');
  
  RETURN json_build_object(
    'success', true,
    'gift_type', p_gift_type,
    'cost', p_cost,
    'platform_fee', v_platform_fee,
    'creator_amount', v_creator_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create or update send_live_gift function to also log analytics
CREATE OR REPLACE FUNCTION public.send_live_gift(
  p_sender_id uuid,
  p_stream_id uuid,
  p_receiver_id uuid,
  p_gift_type text,
  p_credit_value integer
)
RETURNS json AS $$
DECLARE
  v_sender_balance integer;
  v_platform_fee integer;
  v_creator_amount integer;
BEGIN
  -- Calculate platform fee (5%) and creator amount (95%)
  v_platform_fee := GREATEST(1, (p_credit_value * 0.05)::integer);
  v_creator_amount := p_credit_value - v_platform_fee;
  
  -- Check sender balance
  SELECT balance INTO v_sender_balance
  FROM user_credits
  WHERE user_id = p_sender_id;
  
  IF v_sender_balance IS NULL OR v_sender_balance < p_credit_value THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  
  -- Deduct from sender
  UPDATE user_credits
  SET balance = balance - p_credit_value, updated_at = now()
  WHERE user_id = p_sender_id;
  
  -- Add to receiver (minus platform fee)
  INSERT INTO user_credits (user_id, balance)
  VALUES (p_receiver_id, v_creator_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = user_credits.balance + v_creator_amount, updated_at = now();
  
  -- Add platform fee to platform wallet
  UPDATE platform_wallet
  SET balance = balance + v_platform_fee,
      gift_revenue = COALESCE(gift_revenue, 0) + v_platform_fee,
      total_earned = COALESCE(total_earned, 0) + v_platform_fee,
      updated_at = now();
  
  -- Record the live stream gift
  INSERT INTO live_stream_gifts (stream_id, sender_id, receiver_id, gift_type, credit_value)
  VALUES (p_stream_id, p_sender_id, p_receiver_id, p_gift_type, p_credit_value);
  
  -- Log analytics
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, source_type, source_id, platform_fee)
  VALUES (p_sender_id, p_receiver_id, p_gift_type, p_credit_value, 'live_stream', p_stream_id, v_platform_fee);
  
  -- Log platform transaction
  INSERT INTO platform_transactions (transaction_type, amount, description, from_user_id, to_user_id)
  VALUES ('gift_fee', v_platform_fee, 'Live gift fee: ' || p_gift_type, p_sender_id, p_receiver_id);
  
  -- Create notification
  INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
  VALUES (p_receiver_id, p_sender_id, 'live_gift', 'Live Gift!', 'You received a ' || p_gift_type || ' during your stream worth ' || v_creator_amount || ' credits', p_stream_id, 'live_stream');
  
  RETURN json_build_object(
    'success', true,
    'gift_type', p_gift_type,
    'credit_value', p_credit_value,
    'platform_fee', v_platform_fee,
    'creator_amount', v_creator_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;