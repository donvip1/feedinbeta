-- feedIn native baseline: credits, payments, monetization, and P2P marketplace.
-- These schemas are included for product readiness, but payment secrets stay server-side.

create table if not exists public.credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits integer not null check (credits > 0),
  bonus_credits integer not null default 0,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  stripe_price_id text,
  paystack_plan_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_credits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  lifetime_earned integer not null default 0,
  lifetime_spent integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  balance_after integer,
  type text not null,
  description text,
  payment_reference text,
  payment_provider text,
  stripe_payment_intent_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credit_package_id uuid references public.credit_packages(id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'USD',
  provider text not null,
  provider_reference text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'USD',
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid references public.subscription_tiers(id) on delete set null,
  provider text,
  provider_subscription_id text,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_monetization (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_monetized boolean not null default false,
  monetized_at timestamptz,
  total_earnings numeric(12,2) not null default 0,
  available_balance numeric(12,2) not null default 0,
  last_payout_at timestamptz,
  next_eligible_payout timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_incentive_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_earnings numeric(12,2) not null default 0,
  max_earnings numeric(12,2),
  payout_percentage numeric(5,2) not null default 50,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD',
  payout_method text,
  status text not null default 'pending',
  admin_notes text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.creator_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier_id uuid references public.creator_incentive_tiers(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'USD',
  total_earnings numeric(12,2) not null default 0,
  status text not null default 'pending',
  provider_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.p2p_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method_type text not null default 'bank',
  account_name text,
  account_number text,
  bank_name text,
  bank_code text,
  country_code text not null default 'NG',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.p2p_user_eligibility (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  can_buy boolean not null default true,
  can_sell boolean not null default false,
  first_p2p_trade_completed boolean not null default false,
  completed_trades integer not null default 0,
  dispute_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.p2p_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  credits_amount integer not null check (credits_amount > 0),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'NGN',
  payment_method_id uuid references public.p2p_payment_methods(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.p2p_transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.p2p_listings(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  credits_amount integer not null check (credits_amount > 0),
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'NGN',
  status text not null default 'pending',
  escrow_locked boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.p2p_escrow (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.p2p_transactions(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  credits_amount integer not null check (credits_amount > 0),
  status text not null default 'locked',
  locked_at timestamptz not null default now(),
  released_at timestamptz
);

create table if not exists public.p2p_payment_proofs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.p2p_transactions(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  proof_url text,
  proof_type text not null default 'payment',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.p2p_disputes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.p2p_transactions(id) on delete cascade,
  initiated_by uuid not null references public.profiles(id) on delete cascade,
  moderator_id uuid references public.profiles(id) on delete set null,
  reason text,
  status text not null default 'open',
  resolution text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.p2p_chat_messages (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.p2p_transactions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  earning_date date not null default current_date,
  post_earnings numeric(12,2) not null default 0,
  gift_fees numeric(12,2) not null default 0,
  subscription_fees numeric(12,2) not null default 0,
  p2p_fees numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, earning_date)
);

create index if not exists credit_transactions_user_created_idx on public.credit_transactions(user_id, created_at desc);
create index if not exists payment_history_user_created_idx on public.payment_history(user_id, created_at desc);
create index if not exists p2p_listings_status_created_idx on public.p2p_listings(status, created_at desc);
create index if not exists p2p_transactions_buyer_idx on public.p2p_transactions(buyer_id, created_at desc);
create index if not exists p2p_transactions_seller_idx on public.p2p_transactions(seller_id, created_at desc);

drop trigger if exists set_credit_packages_updated_at on public.credit_packages;
create trigger set_credit_packages_updated_at
before update on public.credit_packages
for each row execute function public.set_updated_at();

drop trigger if exists set_user_credits_updated_at on public.user_credits;
create trigger set_user_credits_updated_at
before update on public.user_credits
for each row execute function public.set_updated_at();

drop trigger if exists set_payment_history_updated_at on public.payment_history;
create trigger set_payment_history_updated_at
before update on public.payment_history
for each row execute function public.set_updated_at();

drop trigger if exists set_user_subscriptions_updated_at on public.user_subscriptions;
create trigger set_user_subscriptions_updated_at
before update on public.user_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists set_creator_monetization_updated_at on public.creator_monetization;
create trigger set_creator_monetization_updated_at
before update on public.creator_monetization
for each row execute function public.set_updated_at();

drop trigger if exists set_p2p_payment_methods_updated_at on public.p2p_payment_methods;
create trigger set_p2p_payment_methods_updated_at
before update on public.p2p_payment_methods
for each row execute function public.set_updated_at();

drop trigger if exists set_p2p_user_eligibility_updated_at on public.p2p_user_eligibility;
create trigger set_p2p_user_eligibility_updated_at
before update on public.p2p_user_eligibility
for each row execute function public.set_updated_at();

drop trigger if exists set_p2p_listings_updated_at on public.p2p_listings;
create trigger set_p2p_listings_updated_at
before update on public.p2p_listings
for each row execute function public.set_updated_at();

drop trigger if exists set_p2p_transactions_updated_at on public.p2p_transactions;
create trigger set_p2p_transactions_updated_at
before update on public.p2p_transactions
for each row execute function public.set_updated_at();

