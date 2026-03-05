-- Rename stripe_payment_intent_id to payment_reference in payment_history
ALTER TABLE public.payment_history 
  RENAME COLUMN stripe_payment_intent_id TO payment_reference;

-- Also add payment_reference column to credit_transactions if not exists
ALTER TABLE public.credit_transactions 
  ADD COLUMN IF NOT EXISTS payment_reference text;

-- Copy existing stripe references to the new column
UPDATE public.credit_transactions 
  SET payment_reference = stripe_payment_intent_id 
  WHERE stripe_payment_intent_id IS NOT NULL AND payment_reference IS NULL;