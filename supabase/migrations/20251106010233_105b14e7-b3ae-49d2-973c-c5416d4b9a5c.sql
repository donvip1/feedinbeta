-- Create referral system objects
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referral codes are publicly readable"
ON public.referral_codes
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own referral code"
ON public.referral_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral code"
ON public.referral_codes
FOR UPDATE
USING (auth.uid() = user_id);

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'signed_up',
  created_at timestamptz NOT NULL DEFAULT now(),
  purchased_at timestamptz,
  bonus_awarded boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_code ON public.referrals(code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their referrals"
ON public.referrals
FOR SELECT
USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

CREATE POLICY "Users can claim referral for themselves"
ON public.referrals
FOR INSERT
WITH CHECK (auth.uid() = referred_user_id AND referrer_id <> auth.uid());

-- Trigger to keep user_credits in sync with credit_transactions
CREATE OR REPLACE FUNCTION public.apply_credit_transaction()
RETURNS trigger AS $$
BEGIN
  UPDATE public.user_credits
  SET 
    balance = COALESCE(balance, 0) + NEW.amount,
    total_earned = COALESCE(total_earned, 0) + CASE WHEN NEW.amount > 0 THEN NEW.amount END
  WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_credits (user_id, balance, total_earned)
    VALUES (
      NEW.user_id,
      NEW.amount,
      CASE WHEN NEW.amount > 0 THEN NEW.amount ELSE 0 END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_credit_transaction ON public.credit_transactions;
CREATE TRIGGER trg_apply_credit_transaction
AFTER INSERT ON public.credit_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_credit_transaction();