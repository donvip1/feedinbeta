-- Drop existing constraint and recreate with gift types
ALTER TABLE public.credit_transactions 
DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE public.credit_transactions 
ADD CONSTRAINT credit_transactions_type_check 
CHECK (type = ANY (ARRAY[
  'purchase'::text, 
  'earned'::text, 
  'spent'::text, 
  'refund'::text, 
  'transfer_sent'::text, 
  'transfer_received'::text, 
  'bonus'::text, 
  'admin_grant'::text,
  'gift_sent'::text,
  'gift_received'::text,
  'promotion'::text,
  'promotion_reward'::text,
  'daily_bonus'::text
]));