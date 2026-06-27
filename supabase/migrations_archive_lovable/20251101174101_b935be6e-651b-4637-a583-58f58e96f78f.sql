-- Add daily AI usage tracking to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_ai_prompt_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_ai_image_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_ai_reset_date DATE DEFAULT CURRENT_DATE;

-- Create P2P Credit Marketplace tables
CREATE TABLE IF NOT EXISTS public.p2p_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credits_amount INTEGER NOT NULL CHECK (credits_amount > 0),
  price_usd NUMERIC(10,2) NOT NULL CHECK (price_usd > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.p2p_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES p2p_listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credits_amount INTEGER NOT NULL,
  price_usd NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'proof_uploaded', 'completed', 'disputed', 'cancelled')),
  proof_url TEXT,
  escrow_locked BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.p2p_escrow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES p2p_transactions(id) ON DELETE CASCADE,
  credits_amount INTEGER NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'released', 'refunded'))
);

-- Enable RLS on P2P tables
ALTER TABLE public.p2p_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2p_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.p2p_escrow ENABLE ROW LEVEL SECURITY;

-- RLS Policies for P2P Listings
CREATE POLICY "Users can view active listings"
ON public.p2p_listings FOR SELECT
USING (status = 'active' OR seller_id = auth.uid());

CREATE POLICY "Users can create listings"
ON public.p2p_listings FOR INSERT
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their listings"
ON public.p2p_listings FOR UPDATE
USING (auth.uid() = seller_id);

-- RLS Policies for P2P Transactions
CREATE POLICY "Users can view their transactions"
ON public.p2p_transactions FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create transactions"
ON public.p2p_transactions FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Transaction participants can update"
ON public.p2p_transactions FOR UPDATE
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policies for Escrow
CREATE POLICY "Transaction participants can view escrow"
ON public.p2p_escrow FOR SELECT
USING (
  transaction_id IN (
    SELECT id FROM p2p_transactions
    WHERE buyer_id = auth.uid() OR seller_id = auth.uid()
  )
);

-- Add friend count limits based on subscription tier
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_friends INTEGER DEFAULT 20;

-- Create function to check friend limit
CREATE OR REPLACE FUNCTION check_friend_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_friend_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Count current friends
  SELECT COUNT(*) INTO current_friend_count
  FROM friend_requests
  WHERE (sender_id = NEW.sender_id OR receiver_id = NEW.sender_id)
    AND status = 'accepted';
  
  -- Get max friends allowed
  SELECT max_friends INTO max_allowed
  FROM profiles
  WHERE id = NEW.sender_id;
  
  IF current_friend_count >= max_allowed THEN
    RAISE EXCEPTION 'Friend limit reached. Upgrade your subscription to add more friends.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for friend limit check
DROP TRIGGER IF EXISTS check_friend_limit_trigger ON friend_requests;
CREATE TRIGGER check_friend_limit_trigger
BEFORE INSERT ON friend_requests
FOR EACH ROW
EXECUTE FUNCTION check_friend_limit();

-- Update trigger for timestamps on P2P tables
CREATE TRIGGER update_p2p_listings_updated_at
BEFORE UPDATE ON public.p2p_listings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_p2p_transactions_updated_at
BEFORE UPDATE ON public.p2p_transactions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();