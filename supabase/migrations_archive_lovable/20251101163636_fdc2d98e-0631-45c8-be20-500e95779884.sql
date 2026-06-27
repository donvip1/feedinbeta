-- Add RLS INSERT denial policies for financial tables to prevent direct user manipulation

-- Block direct user insertions to user_subscriptions
-- Only system (service role) can insert via webhooks
CREATE POLICY "Only system can insert subscriptions"
  ON public.user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Block direct user insertions to credit_transactions
-- Only system (service role) can insert via webhooks
CREATE POLICY "Only system can insert credit transactions"
  ON public.credit_transactions FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Block direct user insertions to payment_history
-- Only system (service role) can insert via webhooks
CREATE POLICY "Only system can insert payment history"
  ON public.payment_history FOR INSERT
  TO authenticated
  WITH CHECK (false);