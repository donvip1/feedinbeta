ALTER TABLE public.user_subscriptions
ADD CONSTRAINT fk_user_subscriptions_tier
FOREIGN KEY (tier_id) REFERENCES public.subscription_tiers(id);