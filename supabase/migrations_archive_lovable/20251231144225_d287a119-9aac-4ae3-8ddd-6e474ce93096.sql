-- Enable realtime for wallet tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_credits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_transactions;