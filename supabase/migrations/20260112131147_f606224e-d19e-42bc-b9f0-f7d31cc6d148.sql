-- Update NGN exchange rate to real Bybit rate
UPDATE currency_rates SET rate_to_usd = 1472.267, updated_at = now() WHERE currency_code = 'NGN';

-- Update credit packages with correct pricing (100 credits = $1 base)
-- First, let's update existing packages
UPDATE credit_packages SET 
  credits = 500, 
  price = 4.99, 
  bonus_credits = 50,
  discount_percentage = 10,
  updated_at = now()
WHERE name = 'Starter Pack' OR name ILIKE '%starter%';

UPDATE credit_packages SET 
  credits = 1200, 
  price = 9.99, 
  bonus_credits = 180,
  discount_percentage = 15,
  updated_at = now()
WHERE name = 'Popular Pack' OR name ILIKE '%popular%';

UPDATE credit_packages SET 
  credits = 2000, 
  price = 17.99, 
  bonus_credits = 360,
  discount_percentage = 18,
  updated_at = now()
WHERE name = 'Mega Pack' OR name ILIKE '%mega%';

UPDATE credit_packages SET 
  credits = 5000, 
  price = 39.99, 
  bonus_credits = 1250,
  discount_percentage = 25,
  updated_at = now()
WHERE name = 'Ultimate Pack' OR name ILIKE '%ultimate%';

-- Insert Reseller Pack if it doesn't exist
INSERT INTO credit_packages (name, credits, bonus_credits, price, currency, stripe_price_id, is_active, discount_percentage)
SELECT 'Reseller Pack', 300000, 135000, 3000, 'usd', 'price_reseller_bulk', true, 45
WHERE NOT EXISTS (SELECT 1 FROM credit_packages WHERE name = 'Reseller Pack');

-- Create P2P user eligibility table
CREATE TABLE IF NOT EXISTS p2p_user_eligibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  has_purchased_pack BOOLEAN DEFAULT false,
  first_p2p_trade_completed BOOLEAN DEFAULT false,
  min_trade_amount INTEGER DEFAULT 500,
  total_trades INTEGER DEFAULT 0,
  total_volume_usd DECIMAL(12, 2) DEFAULT 0,
  is_reseller BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on p2p_user_eligibility
ALTER TABLE p2p_user_eligibility ENABLE ROW LEVEL SECURITY;

-- RLS policies for p2p_user_eligibility
CREATE POLICY "Users can view their own eligibility"
  ON p2p_user_eligibility FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own eligibility"
  ON p2p_user_eligibility FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own eligibility"
  ON p2p_user_eligibility FOR UPDATE
  USING (auth.uid() = user_id);

-- Add country_code and currency_code to p2p_payment_methods if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'p2p_payment_methods' AND column_name = 'country_code') THEN
    ALTER TABLE p2p_payment_methods ADD COLUMN country_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'p2p_payment_methods' AND column_name = 'currency_code') THEN
    ALTER TABLE p2p_payment_methods ADD COLUMN currency_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'p2p_payment_methods' AND column_name = 'is_verified') THEN
    ALTER TABLE p2p_payment_methods ADD COLUMN is_verified BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'p2p_payment_methods' AND column_name = 'is_default') THEN
    ALTER TABLE p2p_payment_methods ADD COLUMN is_default BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add region lock columns to p2p_listings if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'p2p_listings' AND column_name = 'country_code') THEN
    ALTER TABLE p2p_listings ADD COLUMN country_code TEXT DEFAULT 'US';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'p2p_listings' AND column_name = 'currency_code') THEN
    ALTER TABLE p2p_listings ADD COLUMN currency_code TEXT DEFAULT 'USD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'p2p_listings' AND column_name = 'is_international') THEN
    ALTER TABLE p2p_listings ADD COLUMN is_international BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'p2p_listings' AND column_name = 'credits_per_dollar') THEN
    ALTER TABLE p2p_listings ADD COLUMN credits_per_dollar DECIMAL(10, 4) DEFAULT 85;
  END IF;
END $$;

-- Create function to update eligibility after pack purchase
CREATE OR REPLACE FUNCTION update_eligibility_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a credit purchase transaction
  IF NEW.type = 'purchase' THEN
    INSERT INTO p2p_user_eligibility (user_id, has_purchased_pack, min_trade_amount)
    VALUES (NEW.user_id, true, 100)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      has_purchased_pack = true,
      min_trade_amount = 100,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for purchase eligibility
DROP TRIGGER IF EXISTS trigger_update_eligibility_on_purchase ON credit_transactions;
CREATE TRIGGER trigger_update_eligibility_on_purchase
  AFTER INSERT ON credit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_eligibility_on_purchase();

-- Create function to update eligibility after first P2P trade
CREATE OR REPLACE FUNCTION update_eligibility_on_p2p_trade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    -- Update buyer eligibility
    INSERT INTO p2p_user_eligibility (user_id, first_p2p_trade_completed, min_trade_amount, total_trades)
    VALUES (NEW.buyer_id, true, 100, 1)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      first_p2p_trade_completed = true,
      min_trade_amount = 100,
      total_trades = p2p_user_eligibility.total_trades + 1,
      total_volume_usd = p2p_user_eligibility.total_volume_usd + NEW.price_usd,
      updated_at = now();
    
    -- Update seller eligibility
    INSERT INTO p2p_user_eligibility (user_id, first_p2p_trade_completed, min_trade_amount, total_trades)
    VALUES (NEW.seller_id, true, 100, 1)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      first_p2p_trade_completed = true,
      min_trade_amount = 100,
      total_trades = p2p_user_eligibility.total_trades + 1,
      total_volume_usd = p2p_user_eligibility.total_volume_usd + NEW.price_usd,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for P2P trade eligibility
DROP TRIGGER IF EXISTS trigger_update_eligibility_on_p2p_trade ON p2p_transactions;
CREATE TRIGGER trigger_update_eligibility_on_p2p_trade
  AFTER UPDATE ON p2p_transactions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION update_eligibility_on_p2p_trade();