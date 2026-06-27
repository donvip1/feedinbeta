-- Fix the send_gift function to increment gifts_count by 1 (not credit value)
-- Also add direct gift sending support

CREATE OR REPLACE FUNCTION send_gift(
  p_post_id UUID,
  p_recipient_id UUID,
  p_gift_type TEXT,
  p_credit_value INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_balance INTEGER;
  platform_fee INTEGER;
  net_amount INTEGER;
BEGIN
  -- Get sender's credit balance
  SELECT balance INTO sender_balance
  FROM user_credits
  WHERE user_id = auth.uid();

  IF sender_balance IS NULL OR sender_balance < p_credit_value THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Calculate platform fee (10%)
  platform_fee := CEIL(p_credit_value * 0.1);
  net_amount := p_credit_value - platform_fee;

  -- Deduct credits from sender
  UPDATE user_credits
  SET balance = balance - p_credit_value,
      total_spent = COALESCE(total_spent, 0) + p_credit_value,
      updated_at = now()
  WHERE user_id = auth.uid();

  -- Add credits to recipient (minus platform fee)
  INSERT INTO user_credits (user_id, balance, total_earned)
  VALUES (p_recipient_id, net_amount, net_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance = user_credits.balance + net_amount,
    total_earned = COALESCE(user_credits.total_earned, 0) + net_amount,
    updated_at = now();

  -- Update post gifts_count by 1 (not credit value) - THIS IS THE FIX
  IF p_post_id IS NOT NULL THEN
    UPDATE posts
    SET gifts_count = COALESCE(gifts_count, 0) + 1
    WHERE id = p_post_id;
  END IF;

  -- Record gift analytics
  INSERT INTO gift_analytics (
    sender_id,
    receiver_id,
    gift_type,
    credit_value,
    platform_fee,
    source_type,
    source_id
  ) VALUES (
    auth.uid(),
    p_recipient_id,
    p_gift_type,
    p_credit_value,
    platform_fee,
    CASE WHEN p_post_id IS NOT NULL THEN 'post' ELSE 'direct' END,
    p_post_id
  );

  -- Record transaction for sender
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (auth.uid(), -p_credit_value, 'gift_sent', 'Sent ' || p_gift_type || ' gift', p_post_id);

  -- Record transaction for recipient
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (p_recipient_id, net_amount, 'gift_received', 'Received ' || p_gift_type || ' gift', p_post_id);
END;
$$;

-- Create function for direct gift sending (by username or email)
CREATE OR REPLACE FUNCTION send_direct_gift(
  p_recipient_identifier TEXT,
  p_gift_type TEXT,
  p_credit_value INTEGER
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  sender_balance INTEGER;
  platform_fee INTEGER;
  net_amount INTEGER;
  gift_id UUID;
BEGIN
  -- Find recipient by username or email
  SELECT p.id INTO recipient_id
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE LOWER(p.username) = LOWER(p_recipient_identifier)
     OR LOWER(au.email) = LOWER(p_recipient_identifier);

  IF recipient_id IS NULL THEN
    RAISE EXCEPTION 'User not found with that username or email';
  END IF;

  IF recipient_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot send gift to yourself';
  END IF;

  -- Get sender's credit balance
  SELECT balance INTO sender_balance
  FROM user_credits
  WHERE user_id = auth.uid();

  IF sender_balance IS NULL OR sender_balance < p_credit_value THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Calculate platform fee (10%)
  platform_fee := CEIL(p_credit_value * 0.1);
  net_amount := p_credit_value - platform_fee;

  -- Deduct credits from sender
  UPDATE user_credits
  SET balance = balance - p_credit_value,
      total_spent = COALESCE(total_spent, 0) + p_credit_value,
      updated_at = now()
  WHERE user_id = auth.uid();

  -- Add credits to recipient (minus platform fee)
  INSERT INTO user_credits (user_id, balance, total_earned)
  VALUES (recipient_id, net_amount, net_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance = user_credits.balance + net_amount,
    total_earned = COALESCE(user_credits.total_earned, 0) + net_amount,
    updated_at = now();

  -- Record gift analytics
  INSERT INTO gift_analytics (
    sender_id,
    receiver_id,
    gift_type,
    credit_value,
    platform_fee,
    source_type
  ) VALUES (
    auth.uid(),
    recipient_id,
    p_gift_type,
    p_credit_value,
    platform_fee,
    'direct'
  ) RETURNING id INTO gift_id;

  -- Record transaction for sender
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (auth.uid(), -p_credit_value, 'gift_sent', 'Sent ' || p_gift_type || ' gift (direct)');

  -- Record transaction for recipient
  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (recipient_id, net_amount, 'gift_received', 'Received ' || p_gift_type || ' gift (direct)');

  -- Create notification for recipient
  INSERT INTO notifications (user_id, from_user_id, type, title, message, related_type)
  VALUES (
    recipient_id,
    auth.uid(),
    'gift',
    'You received a gift!',
    'Someone sent you a ' || p_gift_type || ' gift worth ' || net_amount || ' credits',
    'gift'
  );

  RETURN gift_id;
END;
$$;