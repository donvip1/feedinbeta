
-- Platform wallet to store platform revenue (5% from gifts)
CREATE TABLE public.platform_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance BIGINT NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert initial platform wallet record
INSERT INTO public.platform_wallet (id, balance, total_earned) 
VALUES ('00000000-0000-0000-0000-000000000001', 0, 0);

-- Team wallets for admin/developers
CREATE TABLE public.team_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_name TEXT NOT NULL DEFAULT 'Team Wallet',
  balance BIGINT NOT NULL DEFAULT 0,
  total_earned BIGINT NOT NULL DEFAULT 0,
  total_withdrawn BIGINT NOT NULL DEFAULT 0,
  can_withdraw BOOLEAN DEFAULT false,
  can_transfer BOOLEAN DEFAULT false,
  can_mint BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Credit supply tracking
CREATE TABLE public.credit_supply (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circulating_supply BIGINT NOT NULL DEFAULT 0,
  total_supply BIGINT NOT NULL DEFAULT 100000000, -- 100 million max
  max_circulating BIGINT NOT NULL DEFAULT 10000000, -- 10 million circulating cap
  last_mint_at TIMESTAMP WITH TIME ZONE,
  last_mint_by UUID REFERENCES auth.users(id),
  last_mint_amount BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert initial credit supply record
INSERT INTO public.credit_supply (id, circulating_supply, total_supply, max_circulating)
VALUES ('00000000-0000-0000-0000-000000000002', 0, 100000000, 10000000);

-- Platform wallet transactions log
CREATE TABLE public.platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL, -- 'gift_fee', 'withdrawal', 'transfer', 'mint'
  amount BIGINT NOT NULL,
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  description TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_supply ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_transactions ENABLE ROW LEVEL SECURITY;

-- Platform wallet: only admins can view/update
CREATE POLICY "Admins can view platform wallet"
  ON public.platform_wallet FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- Team wallets: owners and admins can view
CREATE POLICY "Users can view own team wallet"
  ON public.team_wallets FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage team wallets"
  ON public.team_wallets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Credit supply: admins and moderators can view
CREATE POLICY "Admins can view credit supply"
  ON public.credit_supply FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- Platform transactions: admins only
CREATE POLICY "Admins can view platform transactions"
  ON public.platform_transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert platform transactions"
  ON public.platform_transactions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Updated send_gift function with 5% platform fee
CREATE OR REPLACE FUNCTION public.send_gift(p_sender_id uuid, p_recipient_id uuid, p_post_id uuid, p_gift_type text, p_cost integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_balance INTEGER;
  platform_fee INTEGER;
  recipient_amount INTEGER;
  result JSON;
BEGIN
  -- Verify the sender is the current authenticated user
  IF auth.uid() != p_sender_id THEN
    RAISE EXCEPTION 'Unauthorized: You can only send gifts from your own account';
  END IF;

  -- Validate cost
  IF p_cost <= 0 THEN
    RAISE EXCEPTION 'Invalid gift cost';
  END IF;

  -- Check sender balance
  SELECT balance INTO sender_balance
  FROM user_credits
  WHERE user_id = p_sender_id;

  IF sender_balance IS NULL OR sender_balance < p_cost THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %', COALESCE(sender_balance, 0);
  END IF;

  -- Calculate platform fee (5% from recipient's portion)
  -- Sender pays full cost, recipient gets 80% of cost, platform gets 5% from that
  recipient_amount := FLOOR(p_cost * 0.8); -- 80% to recipient
  platform_fee := FLOOR(recipient_amount * 0.05); -- 5% of recipient amount goes to platform
  recipient_amount := recipient_amount - platform_fee; -- Deduct platform fee from recipient

  -- Deduct from sender
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (p_sender_id, 'gift_sent', -p_cost, 'Sent ' || p_gift_type || ' gift', p_post_id);

  -- Add to recipient (75% after 20% platform cut and 5% platform fee)
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (p_recipient_id, 'gift_received', recipient_amount, 'Received ' || p_gift_type || ' gift (after 5% platform fee)', p_post_id);

  -- Add platform fee to platform wallet
  UPDATE platform_wallet 
  SET balance = balance + platform_fee,
      total_earned = total_earned + platform_fee,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Log platform transaction
  INSERT INTO platform_transactions (transaction_type, amount, from_user_id, to_user_id, description)
  VALUES ('gift_fee', platform_fee, p_recipient_id, NULL, '5% fee from gift: ' || p_gift_type);

  -- Create notification for recipient
  INSERT INTO notifications (user_id, from_user_id, type, title, message, related_id, related_type)
  VALUES (
    p_recipient_id,
    p_sender_id,
    'gift',
    'You received a gift!',
    'Someone sent you a ' || p_gift_type || ' gift worth ' || p_cost || ' credits (you received ' || recipient_amount || ' after fees)',
    p_post_id,
    'post'
  );

  -- Return success
  SELECT json_build_object(
    'success', true,
    'message', 'Gift sent successfully',
    'gift_type', p_gift_type,
    'amount', p_cost,
    'recipient_received', recipient_amount,
    'platform_fee', platform_fee
  ) INTO result;

  RETURN result;
END;
$function$;

-- Updated send_live_gift function with 5% platform fee
CREATE OR REPLACE FUNCTION public.send_live_gift(p_stream_id uuid, p_receiver_id uuid, p_gift_type text, p_credit_value integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_id UUID;
  sender_balance INTEGER;
  platform_fee INTEGER;
  receiver_amount INTEGER;
  result JSON;
BEGIN
  sender_id := auth.uid();
  IF sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check sender balance
  SELECT balance INTO sender_balance
  FROM user_credits
  WHERE user_id = sender_id;

  IF sender_balance IS NULL OR sender_balance < p_credit_value THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Calculate platform fee (5% from receiver's amount)
  platform_fee := FLOOR(p_credit_value * 0.05);
  receiver_amount := p_credit_value - platform_fee;

  -- Record the gift
  INSERT INTO live_stream_gifts (stream_id, sender_id, receiver_id, gift_type, credit_value)
  VALUES (p_stream_id, sender_id, p_receiver_id, p_gift_type, p_credit_value);

  -- Deduct from sender
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (sender_id, 'live_gift_sent', -p_credit_value, 'Sent ' || p_gift_type || ' in live stream', p_stream_id);

  -- Add to receiver (minus 5% platform fee)
  INSERT INTO credit_transactions (user_id, type, amount, description, related_id)
  VALUES (p_receiver_id, 'live_gift_received', receiver_amount, 'Received ' || p_gift_type || ' in live stream (after 5% fee)', p_stream_id);

  -- Add platform fee to platform wallet
  UPDATE platform_wallet 
  SET balance = balance + platform_fee,
      total_earned = total_earned + platform_fee,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Log platform transaction
  INSERT INTO platform_transactions (transaction_type, amount, from_user_id, to_user_id, description)
  VALUES ('gift_fee', platform_fee, p_receiver_id, NULL, '5% fee from live gift: ' || p_gift_type);

  SELECT json_build_object(
    'success', true,
    'message', 'Gift sent successfully',
    'credit_value', p_credit_value,
    'receiver_received', receiver_amount,
    'platform_fee', platform_fee
  ) INTO result;

  RETURN result;
END;
$function$;

-- Function for admins to mint credits
CREATE OR REPLACE FUNCTION public.admin_mint_credits(p_amount integer, p_reason text DEFAULT 'Admin mint')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_supply RECORD;
  result JSON;
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can mint credits';
  END IF;

  -- Get current supply
  SELECT * INTO current_supply FROM credit_supply WHERE id = '00000000-0000-0000-0000-000000000002';

  -- Check if mint would exceed total supply
  IF (current_supply.circulating_supply + p_amount) > current_supply.total_supply THEN
    RAISE EXCEPTION 'Cannot mint: would exceed total supply of %', current_supply.total_supply;
  END IF;

  -- Update circulating supply
  UPDATE credit_supply
  SET circulating_supply = circulating_supply + p_amount,
      last_mint_at = now(),
      last_mint_by = auth.uid(),
      last_mint_amount = p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000002';

  -- Add to platform wallet
  UPDATE platform_wallet
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Log transaction
  INSERT INTO platform_transactions (transaction_type, amount, performed_by, description)
  VALUES ('mint', p_amount, auth.uid(), p_reason);

  SELECT json_build_object(
    'success', true,
    'minted', p_amount,
    'new_circulating_supply', current_supply.circulating_supply + p_amount
  ) INTO result;

  RETURN result;
END;
$function$;

-- Function for admins to transfer from platform wallet to user
CREATE OR REPLACE FUNCTION public.admin_transfer_to_user(p_user_id uuid, p_amount integer, p_reason text DEFAULT 'Admin transfer')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  platform_balance BIGINT;
  result JSON;
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can transfer from platform wallet';
  END IF;

  -- Get platform balance
  SELECT balance INTO platform_balance FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  IF platform_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  -- Deduct from platform wallet
  UPDATE platform_wallet
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Add to user
  INSERT INTO credit_transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'admin_transfer', p_amount, p_reason);

  -- Log transaction
  INSERT INTO platform_transactions (transaction_type, amount, to_user_id, performed_by, description)
  VALUES ('transfer', p_amount, p_user_id, auth.uid(), p_reason);

  SELECT json_build_object(
    'success', true,
    'transferred', p_amount,
    'to_user', p_user_id
  ) INTO result;

  RETURN result;
END;
$function$;

-- Function for admins to withdraw from platform wallet to team wallet
CREATE OR REPLACE FUNCTION public.admin_withdraw_to_team_wallet(p_amount integer, p_reason text DEFAULT 'Withdrawal to team wallet')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  platform_balance BIGINT;
  team_wallet_exists BOOLEAN;
  result JSON;
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can withdraw to team wallet';
  END IF;

  -- Get platform balance
  SELECT balance INTO platform_balance FROM platform_wallet WHERE id = '00000000-0000-0000-0000-000000000001';

  IF platform_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  -- Check if team wallet exists for this admin, create if not
  SELECT EXISTS(SELECT 1 FROM team_wallets WHERE user_id = auth.uid()) INTO team_wallet_exists;
  
  IF NOT team_wallet_exists THEN
    INSERT INTO team_wallets (user_id, wallet_name, can_withdraw, can_transfer, can_mint)
    VALUES (auth.uid(), 'Admin Team Wallet', true, true, true);
  END IF;

  -- Deduct from platform wallet
  UPDATE platform_wallet
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001';

  -- Add to team wallet
  UPDATE team_wallets
  SET balance = balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = now()
  WHERE user_id = auth.uid();

  -- Log transaction
  INSERT INTO platform_transactions (transaction_type, amount, to_user_id, performed_by, description)
  VALUES ('withdrawal', p_amount, auth.uid(), auth.uid(), p_reason);

  SELECT json_build_object(
    'success', true,
    'withdrawn', p_amount
  ) INTO result;

  RETURN result;
END;
$function$;
