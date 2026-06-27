
ALTER TABLE public.credit_transactions DROP CONSTRAINT credit_transactions_type_check;

ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_type_check 
CHECK (type = ANY (ARRAY['purchase','earned','spent','refund','transfer_sent','transfer_received','bonus','admin_grant','gift_sent','gift_received','gift_converted','promotion','promotion_reward','promotion_attribution','daily_bonus','live_gift_sent','live_gift_received','subscription','payout']));
