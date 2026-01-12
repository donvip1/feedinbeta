-- Add cancellation tracking fields to p2p_user_eligibility
ALTER TABLE public.p2p_user_eligibility 
ADD COLUMN IF NOT EXISTS buyer_cancellation_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS buyer_ban_until timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_cancellation_at timestamp with time zone DEFAULT NULL;

-- Add cancellation_reason field to p2p_transactions
ALTER TABLE public.p2p_transactions
ADD COLUMN IF NOT EXISTS cancellation_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cancelled_by uuid DEFAULT NULL;