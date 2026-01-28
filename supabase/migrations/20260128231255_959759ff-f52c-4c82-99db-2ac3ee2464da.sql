-- Fix RLS policies for gift/credit system to work properly with SECURITY DEFINER functions

-- 1. Drop restrictive policies on user_credits that block the send_gift function
DROP POLICY IF EXISTS user_credits_insert_blocked ON user_credits;
DROP POLICY IF EXISTS user_credits_update_blocked ON user_credits;

-- 2. Create proper policies for user_credits - allow SECURITY DEFINER functions to work
-- Users can only SELECT their own credits (already exists, keep it)
-- No direct INSERT/UPDATE from client - only through SECURITY DEFINER functions

-- 3. Fix gift_analytics - allow users to see gifts they sent or received
DROP POLICY IF EXISTS admins_view_gift_analytics ON gift_analytics;

CREATE POLICY "Users can view gifts they sent or received"
ON gift_analytics FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Allow admins to still view all
CREATE POLICY "Admins can view all gift analytics"
ON gift_analytics FOR SELECT
USING (can_view_admin_wallet());

-- 4. Fix credit_transactions - allow viewing own transactions
DROP POLICY IF EXISTS credit_transactions_no_direct_insert ON credit_transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON credit_transactions;
DROP POLICY IF EXISTS credit_transactions_view_own ON credit_transactions;

CREATE POLICY "Users can view own credit transactions"
ON credit_transactions FOR SELECT
USING (auth.uid() = user_id);

-- 5. Create policy for notifications related to gifts
-- (notifications table likely already has policies, but ensure gift notifications work)

-- 6. Recreate the send_gift function with proper bypassing of RLS
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

  -- Check sender balance
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

  -- Deduct from sender (with explicit check to prevent negative)
  UPDATE user_credits 
  SET balance = balance - p_credit_value,
      total_spent = total_spent + p_credit_value,
      updated_at = now()
  WHERE user_id = v_sender_id AND balance >= p_credit_value;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;
  
  -- Add to receiver (minus fee)
  INSERT INTO user_credits (user_id, balance, total_earned, total_spent)
  VALUES (v_receiver_id, v_receiver_amount, v_receiver_amount, 0)
  ON CONFLICT (user_id) DO UPDATE SET 
    balance = user_credits.balance + v_receiver_amount,
    total_earned = user_credits.total_earned + v_receiver_amount,
    updated_at = now();

  -- Record transactions
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (v_sender_id, -p_credit_value, 'gift_sent', 'Gift sent: ' || p_gift_type, p_post_id);

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
  INSERT INTO gift_analytics (sender_id, receiver_id, gift_type, credit_value, platform_fee, source_type, source_id)
  VALUES (v_sender_id, v_receiver_id, p_gift_type, p_credit_value, v_platform_fee, 'post', p_post_id);

  -- Update post gifts count by 1
  UPDATE posts SET gifts_count = COALESCE(gifts_count, 0) + 1 WHERE id = p_post_id;

  -- CREATE NOTIFICATION FOR RECEIVER
  INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
  VALUES (
    v_receiver_id, 
    v_sender_id, 
    'gift_received', 
    'New Gift!', 
    'You received a ' || p_gift_type || ' gift worth ' || v_receiver_amount || ' credits',
    p_post_id,
    'post'
  );

  RETURN json_build_object('success', true, 'amount', p_credit_value, 'receiver_gets', v_receiver_amount);
END;
$function$;

-- 7. Also fix any other credit-related functions that might have similar issues
-- Ensure follows table allows users to follow others
DROP POLICY IF EXISTS "Users can follow others" ON follows;
DROP POLICY IF EXISTS "Users can unfollow" ON follows;
DROP POLICY IF EXISTS "Anyone can view follows" ON follows;

CREATE POLICY "Anyone can view follows"
ON follows FOR SELECT
USING (true);

CREATE POLICY "Users can follow others"
ON follows FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
ON follows FOR DELETE
USING (auth.uid() = follower_id);