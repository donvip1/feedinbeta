
-- Drop existing functions to allow recreation with new return types
DROP FUNCTION IF EXISTS get_credit_statistics();

-- Recreate get_credit_statistics with updated fields
CREATE OR REPLACE FUNCTION get_credit_statistics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'user_credits_total', COALESCE((SELECT SUM(balance) FROM user_credits), 0),
    'user_count', (SELECT COUNT(*) FROM user_credits WHERE balance > 0),
    'p2p_escrow_locked', COALESCE((SELECT SUM(credits_amount) FROM p2p_escrow WHERE status = 'locked'), 0),
    'p2p_active_listings', COALESCE((SELECT SUM(credits_amount) FROM p2p_listings WHERE status = 'active'), 0),
    'platform_balance', COALESCE((SELECT balance FROM platform_wallet LIMIT 1), 0),
    'team_wallets_total', COALESCE((SELECT SUM(balance) FROM team_wallets), 0),
    'gift_revenue', COALESCE((SELECT gift_revenue FROM platform_wallet LIMIT 1), 0),
    'promotion_revenue', COALESCE((SELECT promotion_revenue FROM platform_wallet LIMIT 1), 0),
    'subscription_revenue', COALESCE((SELECT subscription_revenue FROM platform_wallet LIMIT 1), 0),
    'p2p_fee_revenue', COALESCE((SELECT p2p_fee_revenue FROM platform_wallet LIMIT 1), 0),
    'ai_feature_revenue', COALESCE((SELECT ai_feature_revenue FROM platform_wallet LIMIT 1), 0),
    'platform_profit', COALESCE((SELECT platform_profit FROM platform_wallet LIMIT 1), 0),
    'creator_payouts_total', COALESCE((SELECT creator_payouts_total FROM platform_wallet LIMIT 1), 0),
    'total_minted', COALESCE((SELECT total_supply FROM credit_supply LIMIT 1), 0),
    'circulating_supply', COALESCE((SELECT circulating_supply FROM credit_supply LIMIT 1), 0)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Update gift transaction to use 70/30 split (platform keeps 70%, creator gets 30%)
CREATE OR REPLACE FUNCTION process_gift_with_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gift_value NUMERIC;
  platform_cut NUMERIC;
  creator_cut NUMERIC;
BEGIN
  gift_value := NEW.credit_value;
  platform_cut := gift_value * 0.70;
  creator_cut := gift_value * 0.30;
  
  -- Update platform wallet with platform's 70% share
  UPDATE platform_wallet 
  SET 
    gift_revenue = COALESCE(gift_revenue, 0) + platform_cut,
    platform_profit = COALESCE(platform_profit, 0) + platform_cut,
    total_earned = COALESCE(total_earned, 0) + platform_cut,
    creator_payouts_total = COALESCE(creator_payouts_total, 0) + creator_cut,
    updated_at = now();
  
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
$$;

-- Create or replace trigger for gift processing
DROP TRIGGER IF EXISTS on_live_stream_gift_split ON live_stream_gifts;
CREATE TRIGGER on_live_stream_gift_split
  AFTER INSERT ON live_stream_gifts
  FOR EACH ROW
  EXECUTE FUNCTION process_gift_with_split();
