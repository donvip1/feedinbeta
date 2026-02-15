ALTER TABLE public.user_subscriptions ALTER COLUMN stripe_subscription_id DROP NOT NULL;
ALTER TABLE public.user_subscriptions ALTER COLUMN stripe_customer_id DROP NOT NULL;