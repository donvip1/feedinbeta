-- Expand credit_transactions type constraint to include all transaction types
ALTER TABLE public.credit_transactions 
DROP CONSTRAINT credit_transactions_type_check;

ALTER TABLE public.credit_transactions 
ADD CONSTRAINT credit_transactions_type_check 
CHECK (type IN (
  'purchase',
  'earned', 
  'spent',
  'refund',
  'transfer_sent',
  'transfer_received',
  'bonus',
  'admin_grant'
));