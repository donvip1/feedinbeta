
-- User bank accounts for withdrawals
CREATE TABLE public.user_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  recipient_code TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts" ON public.user_bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bank accounts" ON public.user_bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bank accounts" ON public.user_bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bank accounts" ON public.user_bank_accounts FOR DELETE USING (auth.uid() = user_id);

-- Withdrawal requests
CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credit_amount INTEGER NOT NULL,
  platform_fee_credits INTEGER NOT NULL DEFAULT 0,
  net_credits INTEGER NOT NULL DEFAULT 0,
  amount_ngn NUMERIC NOT NULL DEFAULT 0,
  exchange_rate_used NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  bank_account_id UUID REFERENCES public.user_bank_accounts(id),
  paystack_transfer_code TEXT,
  paystack_reference TEXT,
  failure_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own withdrawals" ON public.withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add withdrawal_revenue column to platform_wallet
ALTER TABLE public.platform_wallet ADD COLUMN IF NOT EXISTS withdrawal_revenue NUMERIC DEFAULT 0;

-- Deduct credits for withdrawal (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.deduct_credits_for_withdrawal(p_user_id UUID, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id FOR UPDATE;
  
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  INSERT INTO credit_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -p_amount, 'withdrawal', 'Credit withdrawal to bank account');
END;
$$;

-- Refund failed withdrawal (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.refund_failed_withdrawal(p_user_id UUID, p_amount INTEGER, p_withdrawal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO credit_transactions (user_id, amount, type, description, related_id)
  VALUES (p_user_id, p_amount, 'withdrawal_refund', 'Refund for failed withdrawal', p_withdrawal_id);
END;
$$;
