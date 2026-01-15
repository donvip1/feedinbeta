-- Part 1: Add call_type column to call_invites table
ALTER TABLE public.call_invites ADD COLUMN IF NOT EXISTS call_type text DEFAULT 'video';

-- Part 2: Add credits_deducted column to call_logs table
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS credits_deducted integer DEFAULT 0;

-- Create index for better query performance on call history with credits
CREATE INDEX IF NOT EXISTS idx_call_logs_credits ON public.call_logs(caller_id, receiver_id, credits_deducted) WHERE credits_deducted > 0;