-- Server-owned wallet checkout and creator payout contracts.
--
-- The native schema in 20260624000500_native_money_p2p_schema.sql is the
-- source of truth. Prices are always read from price_cents + currency. Provider
-- secrets remain in Edge Functions and all money fulfillment RPCs are locked
-- to service_role.

-- ---------------------------------------------------------------------------
-- 1. Additive catalog and subscription fields
-- ---------------------------------------------------------------------------

alter table public.subscription_tiers
  add column if not exists billing_interval text not null default 'month'
    check (billing_interval in ('day', 'week', 'month', 'year')),
  add column if not exists subscription_credits integer not null default 0
    check (subscription_credits >= 0),
  add column if not exists paystack_plan_code text,
  add column if not exists stripe_price_id text;

alter table public.user_subscriptions
  add column if not exists provider_customer_id text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists last_payment_reference text;

alter table public.payment_history
  add column if not exists payment_intent_id uuid,
  add column if not exists subscription_tier_id uuid
    references public.subscription_tiers(id) on delete set null,
  add column if not exists purchase_type text,
  add column if not exists description text;

-- Restore the established wallet catalog when the native baseline was applied
-- without the archived web seed data.
insert into public.credit_packages (
  name,
  credits,
  bonus_credits,
  price_cents,
  currency,
  is_active
)
select seed.name, seed.credits, seed.bonus_credits, seed.price_cents, 'USD', true
from (
  values
    ('Starter Pack', 500, 50, 499),
    ('Popular Pack', 1200, 180, 999),
    ('Mega Pack', 2000, 360, 1799),
    ('Ultimate Pack', 5000, 1250, 3999),
    ('Reseller Pack', 300000, 135000, 300000)
) as seed(name, credits, bonus_credits, price_cents)
where not exists (
  select 1
  from public.credit_packages existing
  where lower(existing.name) = lower(seed.name)
);

insert into public.subscription_tiers (
  name,
  description,
  price_cents,
  currency,
  features,
  is_active,
  billing_interval,
  subscription_credits
)
select
  seed.name,
  seed.description,
  seed.price_cents,
  'USD',
  seed.features::jsonb,
  true,
  'month',
  seed.subscription_credits
from (
  values
    (
      'Basic',
      'Core premium access',
      499,
      '["Premium groups", "5 AI generations per day", "No ads", "Priority support"]',
      100
    ),
    (
      'Pro',
      'Advanced creator and AI features',
      999,
      '["All Basic features", "Unlimited AI generations", "Advanced analytics", "Custom profile themes"]',
      500
    ),
    (
      'Premium',
      'Full Feedin premium access',
      1999,
      '["All Pro features", "Verified badge", "Exclusive premium groups", "Revenue sharing", "Direct support"]',
      1500
    )
) as seed(name, description, price_cents, features, subscription_credits)
where not exists (
  select 1
  from public.subscription_tiers existing
  where lower(existing.name) = lower(seed.name)
);

-- ---------------------------------------------------------------------------
-- 2. Checkout intent and provider event ledgers
-- ---------------------------------------------------------------------------

create table if not exists public.wallet_payment_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purchase_type text not null check (purchase_type in ('credits', 'subscription')),
  credit_package_id uuid references public.credit_packages(id) on delete restrict,
  subscription_tier_id uuid references public.subscription_tiers(id) on delete restrict,
  provider text not null check (provider in ('paystack', 'stripe')),
  idempotency_key text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  credits_amount bigint not null default 0 check (credits_amount >= 0),
  billing_interval text check (billing_interval in ('day', 'week', 'month', 'year')),
  status text not null default 'creating'
    check (status in (
      'creating',
      'initializing',
      'initialized',
      'completed',
      'failed',
      'expired',
      'canceled'
    )),
  initialization_token uuid,
  provider_reference text,
  provider_checkout_id text,
  provider_payment_reference text,
  provider_subscription_id text,
  checkout_url text,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_payment_intents_item_check check (
    (
      purchase_type = 'credits'
      and credit_package_id is not null
      and subscription_tier_id is null
    )
    or (
      purchase_type = 'subscription'
      and credit_package_id is null
      and subscription_tier_id is not null
    )
  )
);

create unique index if not exists wallet_payment_intents_user_idempotency_uidx
  on public.wallet_payment_intents(user_id, idempotency_key);

create unique index if not exists wallet_payment_intents_provider_reference_uidx
  on public.wallet_payment_intents(provider, provider_reference)
  where provider_reference is not null;

create unique index if not exists wallet_payment_intents_active_item_uidx
  on public.wallet_payment_intents (
    user_id,
    purchase_type,
    coalesce(credit_package_id, subscription_tier_id),
    provider
  )
  where status in ('creating', 'initializing', 'initialized');

create index if not exists wallet_payment_intents_user_created_idx
  on public.wallet_payment_intents(user_id, created_at desc);

create table if not exists public.wallet_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('paystack', 'stripe')),
  provider_event_id text not null,
  payment_intent_id uuid references public.wallet_payment_intents(id) on delete set null,
  event_type text not null,
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'failed')),
  payload_hash text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

alter table public.wallet_payment_intents enable row level security;
alter table public.wallet_payment_events enable row level security;

drop policy if exists "Users can read own wallet payment intents"
  on public.wallet_payment_intents;
create policy "Users can read own wallet payment intents"
  on public.wallet_payment_intents for select
  using (auth.uid() = user_id);

-- Provider events intentionally have no client policies.

drop trigger if exists set_wallet_payment_intents_updated_at
  on public.wallet_payment_intents;
create trigger set_wallet_payment_intents_updated_at
before update on public.wallet_payment_intents
for each row execute function public.set_updated_at();

alter table public.payment_history
  drop constraint if exists payment_history_payment_intent_id_fkey;
alter table public.payment_history
  add constraint payment_history_payment_intent_id_fkey
  foreign key (payment_intent_id)
  references public.wallet_payment_intents(id)
  on delete set null;

create unique index if not exists payment_history_payment_intent_uidx
  on public.payment_history(payment_intent_id)
  where payment_intent_id is not null;

create unique index if not exists payment_history_provider_reference_uidx
  on public.payment_history(provider, provider_reference)
  where payment_intent_id is not null and provider_reference is not null;

create unique index if not exists user_subscriptions_provider_subscription_uidx
  on public.user_subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create unique index if not exists credit_transactions_purchase_reference_uidx
  on public.credit_transactions(payment_provider, payment_reference)
  where type = 'purchase'
    and payment_provider is not null
    and payment_reference is not null;

-- ---------------------------------------------------------------------------
-- 3. Provider-aware credit issuance
-- ---------------------------------------------------------------------------

create or replace function public.add_credits_from_purchase(
  p_user_id uuid,
  p_amount bigint,
  p_description text,
  p_reference text,
  p_provider text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  dev uuid := (
    select value::uuid
    from public.platform_config
    where key = 'developer_wallet_user_id'
  );
  pool bigint;
  shortfall bigint;
  new_balance bigint;
begin
  if p_amount is null or p_amount <= 0 or p_amount > 2147483647 then
    raise exception 'amount must be positive';
  end if;
  if p_provider not in ('paystack', 'stripe') then
    raise exception 'unsupported payment provider';
  end if;
  if p_reference is null or length(btrim(p_reference)) = 0 then
    raise exception 'payment reference is required';
  end if;

  p_provider := lower(btrim(p_provider));
  p_reference := btrim(p_reference);
  perform pg_advisory_xact_lock(
    hashtextextended('wallet-purchase:' || p_provider || ':' || p_reference, 0)
  );

  select coalesce(
    balance_after,
    (select balance from public.user_credits where user_id = p_user_id)
  )
  into new_balance
  from public.credit_transactions
  where payment_provider = p_provider
    and payment_reference = p_reference
    and type = 'purchase'
  limit 1;

  if found then
    return new_balance;
  end if;

  select balance into pool
  from public.platform_wallet
  where id = 1
  for update;

  if pool is null then
    raise exception 'platform wallet is not configured';
  end if;

  if pool < p_amount then
    shortfall := p_amount - pool;

    update public.user_credits
    set balance = balance - shortfall,
        lifetime_spent = lifetime_spent + shortfall,
        updated_at = now()
    where user_id = dev
      and balance >= shortfall;

    if not found then
      raise exception 'developer reserve exhausted: cannot issue % credits', p_amount;
    end if;

    update public.platform_wallet
    set balance = balance + shortfall,
        lifetime_supplied = lifetime_supplied + shortfall,
        updated_at = now()
    where id = 1;
  end if;

  update public.platform_wallet
  set balance = balance - p_amount,
      lifetime_issued = lifetime_issued + p_amount,
      updated_at = now()
  where id = 1;

  insert into public.user_credits (user_id, balance, lifetime_earned)
  values (p_user_id, p_amount, p_amount)
  on conflict (user_id) do update
  set balance = public.user_credits.balance + excluded.balance,
      lifetime_earned = public.user_credits.lifetime_earned + excluded.lifetime_earned,
      updated_at = now()
  returning balance into new_balance;

  insert into public.credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    payment_reference,
    payment_provider,
    metadata
  )
  values (
    p_user_id,
    p_amount,
    new_balance,
    'purchase',
    p_description,
    p_reference,
    p_provider,
    jsonb_build_object('source', 'wallet_payment_intent')
  );

  return new_balance;
end;
$$;

-- Keep the existing four-argument service contract for older webhook callers.
create or replace function public.add_credits_from_purchase(
  p_user_id uuid,
  p_amount bigint,
  p_description text default 'Credit purchase',
  p_reference text default null
)
returns bigint
language sql
security definer
set search_path = public
as $$
  select public.add_credits_from_purchase(
    p_user_id,
    p_amount,
    p_description,
    p_reference,
    'paystack'
  );
$$;

revoke all on function public.add_credits_from_purchase(uuid, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.add_credits_from_purchase(uuid, bigint, text, text, text)
  to service_role;

revoke all on function public.add_credits_from_purchase(uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.add_credits_from_purchase(uuid, bigint, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. Atomic checkout lifecycle
-- ---------------------------------------------------------------------------

create or replace function public.wallet_configure_paystack_plan(
  p_tier_id uuid,
  p_plan_code text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_code text;
begin
  if nullif(btrim(p_plan_code), '') is null then
    raise exception 'Paystack plan code is required';
  end if;

  select paystack_plan_code into configured_code
  from public.subscription_tiers
  where id = p_tier_id
  for update;

  if not found then
    raise exception 'subscription tier not found';
  end if;
  if nullif(btrim(configured_code), '') is not null then
    return configured_code;
  end if;

  update public.subscription_tiers
  set paystack_plan_code = btrim(p_plan_code)
  where id = p_tier_id
  returning paystack_plan_code into configured_code;

  return configured_code;
end;
$$;

create or replace function public.wallet_register_payment_intent(
  p_user_id uuid,
  p_purchase_type text,
  p_item_id uuid,
  p_provider text,
  p_idempotency_key text,
  p_amount_minor bigint,
  p_currency text,
  p_credits_amount bigint default 0,
  p_billing_interval text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.wallet_payment_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.wallet_payment_intents;
  normalized_currency text := upper(btrim(p_currency));
  normalized_credits bigint := coalesce(p_credits_amount, 0);
begin
  if p_purchase_type not in ('credits', 'subscription') then
    raise exception 'invalid purchase type';
  end if;
  if p_provider not in ('paystack', 'stripe') then
    raise exception 'invalid payment provider';
  end if;
  if p_idempotency_key is null
     or length(p_idempotency_key) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid idempotency key';
  end if;
  if p_amount_minor is null
     or p_amount_minor <= 0
     or p_amount_minor > 2147483647 then
    raise exception 'invalid checkout amount';
  end if;
  if normalized_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid checkout currency';
  end if;
  if normalized_credits < 0 or normalized_credits > 2147483647 then
    raise exception 'invalid checkout credits';
  end if;
  if p_purchase_type = 'credits' and normalized_credits <= 0 then
    raise exception 'credit purchase amount must be positive';
  end if;
  if p_purchase_type = 'subscription'
     and coalesce(p_billing_interval, '') not in ('day', 'week', 'month', 'year') then
    raise exception 'invalid subscription billing interval';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('wallet-checkout:' || p_user_id::text, 0)
  );

  update public.wallet_payment_intents
  set status = 'expired',
      failure_code = 'checkout_expired',
      failure_message = 'Checkout initialization expired',
      updated_at = now()
  where user_id = p_user_id
    and status in ('creating', 'initializing')
    and created_at <= now() - interval '5 minutes';

  update public.wallet_payment_intents
  set status = 'expired',
      failure_code = 'checkout_expired',
      failure_message = 'Checkout link expired',
      updated_at = now()
  where user_id = p_user_id
    and status = 'initialized'
    and expires_at is not null
    and expires_at <= now();

  select * into intent
  from public.wallet_payment_intents
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if intent.purchase_type <> p_purchase_type
       or intent.provider <> p_provider
       or intent.amount_minor <> p_amount_minor
       or intent.currency <> normalized_currency
       or intent.credits_amount <> normalized_credits
       or intent.billing_interval is distinct from p_billing_interval
       or (
         case
           when p_purchase_type = 'credits' then intent.credit_package_id
           else intent.subscription_tier_id
         end
       ) is distinct from p_item_id then
      raise exception 'idempotency key was already used for another checkout';
    end if;
    return intent;
  end if;

  select * into intent
  from public.wallet_payment_intents
  where user_id = p_user_id
    and purchase_type = p_purchase_type
    and provider = p_provider
    and (
      case
        when p_purchase_type = 'credits' then credit_package_id
        else subscription_tier_id
      end
    ) = p_item_id
    and status in ('creating', 'initializing', 'initialized')
  order by created_at desc
  limit 1
  for update;

  if found then
    if intent.amount_minor <> p_amount_minor
       or intent.currency <> normalized_currency
       or intent.credits_amount <> normalized_credits
       or intent.billing_interval is distinct from p_billing_interval then
      raise exception 'an active checkout already exists for this catalog item';
    end if;
    return intent;
  end if;

  insert into public.wallet_payment_intents (
    user_id,
    purchase_type,
    credit_package_id,
    subscription_tier_id,
    provider,
    idempotency_key,
    amount_minor,
    currency,
    credits_amount,
    billing_interval,
    metadata
  )
  values (
    p_user_id,
    p_purchase_type,
    case when p_purchase_type = 'credits' then p_item_id end,
    case when p_purchase_type = 'subscription' then p_item_id end,
    p_provider,
    p_idempotency_key,
    p_amount_minor,
    normalized_currency,
    normalized_credits,
    p_billing_interval,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into intent;

  return intent;
end;
$$;

create or replace function public.wallet_claim_checkout_initialization(
  p_intent_id uuid,
  p_initialization_token uuid
)
returns public.wallet_payment_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.wallet_payment_intents;
begin
  if p_initialization_token is null then
    raise exception 'initialization token is required';
  end if;

  update public.wallet_payment_intents
  set status = 'initializing',
      initialization_token = p_initialization_token,
      failure_code = null,
      failure_message = null,
      updated_at = now()
  where id = p_intent_id
    and status = 'creating'
  returning * into intent;

  if found then
    return intent;
  end if;

  select * into intent
  from public.wallet_payment_intents
  where id = p_intent_id;

  if not found then
    raise exception 'payment intent not found';
  end if;
  return intent;
end;
$$;

create or replace function public.wallet_mark_checkout_initialized(
  p_intent_id uuid,
  p_initialization_token uuid,
  p_provider_reference text,
  p_provider_checkout_id text,
  p_checkout_url text,
  p_expires_at timestamptz default null
)
returns public.wallet_payment_intents
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.wallet_payment_intents;
begin
  if p_provider_reference is null or length(btrim(p_provider_reference)) = 0 then
    raise exception 'provider reference is required';
  end if;
  if p_checkout_url is null or p_checkout_url !~ '^https://' then
    raise exception 'secure checkout url is required';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'future checkout expiry is required';
  end if;

  update public.wallet_payment_intents
  set status = 'initialized',
      provider_reference = p_provider_reference,
      provider_checkout_id = p_provider_checkout_id,
      checkout_url = p_checkout_url,
      expires_at = p_expires_at,
      initialization_token = null,
      failure_code = null,
      failure_message = null,
      updated_at = now()
  where id = p_intent_id
    and status = 'initializing'
    and initialization_token = p_initialization_token
  returning * into intent;

  if found then
    return intent;
  end if;

  select * into intent
  from public.wallet_payment_intents
  where id = p_intent_id;

  if not found then
    raise exception 'payment intent not found';
  end if;
  if intent.status = 'initialized'
     and intent.provider_reference = p_provider_reference then
    return intent;
  end if;

  raise exception 'payment intent cannot be initialized from status %', intent.status;
end;
$$;

create or replace function public.wallet_mark_checkout_failed(
  p_intent_id uuid,
  p_initialization_token uuid,
  p_failure_code text,
  p_failure_message text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.wallet_payment_intents
  set status = 'failed',
      failure_code = left(coalesce(p_failure_code, 'provider_error'), 80),
      failure_message = left(coalesce(p_failure_message, 'Checkout initialization failed'), 500),
      updated_at = now()
  where id = p_intent_id
    and status = 'initializing'
    and initialization_token = p_initialization_token;
$$;

create or replace function public.wallet_complete_payment(
  p_intent_id uuid,
  p_provider text,
  p_provider_reference text,
  p_provider_payment_reference text,
  p_provider_subscription_id text,
  p_provider_customer_id text,
  p_amount_minor bigint,
  p_currency text,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intent public.wallet_payment_intents;
  subscription_id uuid;
  period_start timestamptz;
  period_end timestamptz;
  payment_reference text;
  new_balance bigint;
begin
  select * into intent
  from public.wallet_payment_intents
  where id = p_intent_id
  for update;

  if not found then
    raise exception 'payment intent not found';
  end if;
  if p_provider is null
     or p_provider not in ('paystack', 'stripe')
     or p_provider_reference is null
     or length(btrim(p_provider_reference)) = 0
     or p_amount_minor is null
     or p_amount_minor <= 0
     or p_currency is null
     or upper(btrim(p_currency)) !~ '^[A-Z]{3}$' then
    raise exception 'invalid provider completion details';
  end if;
  if intent.provider <> p_provider then
    raise exception 'payment provider mismatch';
  end if;
  if intent.provider_reference <> p_provider_reference then
    raise exception 'payment reference mismatch';
  end if;
  if intent.amount_minor <> p_amount_minor
     or intent.currency <> upper(p_currency) then
    raise exception 'payment amount or currency mismatch';
  end if;

  if intent.status = 'completed' then
    return jsonb_build_object(
      'payment_intent_id', intent.id,
      'status', 'completed',
      'already_processed', true
    );
  end if;
  if intent.status <> 'initialized' then
    raise exception 'payment intent is not ready for completion';
  end if;
  payment_reference := coalesce(
    nullif(p_provider_payment_reference, ''),
    p_provider_reference
  );

  if intent.purchase_type = 'credits' then
    new_balance := public.add_credits_from_purchase(
      intent.user_id,
      intent.credits_amount,
      coalesce(intent.metadata ->> 'description', 'Credit purchase'),
      payment_reference,
      intent.provider
    );

    insert into public.p2p_user_eligibility (
      user_id,
      can_buy,
      updated_at
    )
    values (intent.user_id, true, now())
    on conflict (user_id) do update
    set can_buy = true,
        updated_at = now();
  else
    period_start := coalesce(p_period_start, now());
    period_end := coalesce(
      p_period_end,
      case coalesce(intent.billing_interval, 'month')
        when 'day' then period_start + interval '1 day'
        when 'week' then period_start + interval '1 week'
        when 'year' then period_start + interval '1 year'
        else period_start + interval '1 month'
      end
    );

    select id into subscription_id
    from public.user_subscriptions
    where user_id = intent.user_id
      and provider = intent.provider
    order by created_at desc
    limit 1
    for update;

    if subscription_id is null then
      insert into public.user_subscriptions (
        user_id,
        tier_id,
        provider,
        provider_subscription_id,
        provider_customer_id,
        status,
        current_period_start,
        current_period_end,
        last_payment_reference
      )
      values (
        intent.user_id,
        intent.subscription_tier_id,
        intent.provider,
        p_provider_subscription_id,
        p_provider_customer_id,
        'active',
        period_start,
        period_end,
        payment_reference
      )
      returning id into subscription_id;
    else
      update public.user_subscriptions
      set tier_id = intent.subscription_tier_id,
          provider_subscription_id = coalesce(
            nullif(p_provider_subscription_id, ''),
            provider_subscription_id
          ),
          provider_customer_id = coalesce(
            nullif(p_provider_customer_id, ''),
            provider_customer_id
          ),
          status = 'active',
          current_period_start = period_start,
          current_period_end = period_end,
          cancel_at_period_end = false,
          last_payment_reference = payment_reference,
          updated_at = now()
      where id = subscription_id;
    end if;

    if intent.credits_amount > 0 then
      new_balance := public.add_credits_from_purchase(
        intent.user_id,
        intent.credits_amount,
        coalesce(
          intent.metadata ->> 'description',
          'Subscription credits'
        ),
        payment_reference || ':subscription-credits',
        intent.provider
      );
    end if;
  end if;

  insert into public.payment_history (
    user_id,
    credit_package_id,
    subscription_tier_id,
    payment_intent_id,
    amount_cents,
    currency,
    provider,
    provider_reference,
    status,
    purchase_type,
    description,
    metadata
  )
  values (
    intent.user_id,
    intent.credit_package_id,
    intent.subscription_tier_id,
    intent.id,
    intent.amount_minor::integer,
    intent.currency,
    intent.provider,
    payment_reference,
    'succeeded',
    intent.purchase_type,
    intent.metadata ->> 'description',
    jsonb_build_object(
      'checkout_reference', intent.provider_reference,
      'provider_subscription_id', p_provider_subscription_id
    )
  )
  on conflict (payment_intent_id) where payment_intent_id is not null
  do nothing;

  update public.wallet_payment_intents
  set status = 'completed',
      provider_payment_reference = payment_reference,
      provider_subscription_id = nullif(p_provider_subscription_id, ''),
      completed_at = now(),
      updated_at = now()
  where id = intent.id;

  return jsonb_build_object(
    'payment_intent_id', intent.id,
    'status', 'completed',
    'already_processed', false,
    'purchase_type', intent.purchase_type,
    'balance_after', new_balance,
    'subscription_id', subscription_id
  );
end;
$$;

create or replace function public.wallet_complete_subscription_renewal(
  p_provider text,
  p_provider_subscription_id text,
  p_provider_payment_reference text,
  p_amount_minor bigint,
  p_currency text,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription public.user_subscriptions;
  tier public.subscription_tiers;
  checkout public.wallet_payment_intents;
  period_start timestamptz;
  period_end timestamptz;
  new_balance bigint;
begin
  if p_provider not in ('paystack', 'stripe')
     or nullif(btrim(p_provider_subscription_id), '') is null
     or nullif(btrim(p_provider_payment_reference), '') is null
     or p_amount_minor is null
     or p_amount_minor <= 0
     or upper(btrim(p_currency)) !~ '^[A-Z]{3}$' then
    raise exception 'invalid subscription renewal details';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'wallet-renewal:' || p_provider || ':' || p_provider_payment_reference,
      0
    )
  );

  select * into subscription
  from public.user_subscriptions
  where provider = p_provider
    and provider_subscription_id = p_provider_subscription_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'subscription not found';
  end if;

  select * into tier
  from public.subscription_tiers
  where id = subscription.tier_id;

  if not found then
    raise exception 'subscription tier not found';
  end if;

  select * into checkout
  from public.wallet_payment_intents
  where user_id = subscription.user_id
    and subscription_tier_id = subscription.tier_id
    and provider = p_provider
    and status = 'completed'
  order by completed_at desc nulls last, created_at desc
  limit 1;

  if not found
     or checkout.amount_minor <> p_amount_minor
     or checkout.currency <> upper(btrim(p_currency)) then
    raise exception 'subscription renewal amount or currency mismatch';
  end if;

  period_start := coalesce(p_period_start, now());
  period_end := coalesce(
    p_period_end,
    case coalesce(checkout.billing_interval, 'month')
      when 'day' then period_start + interval '1 day'
      when 'week' then period_start + interval '1 week'
      when 'year' then period_start + interval '1 year'
      else period_start + interval '1 month'
    end
  );

  if tier.subscription_credits > 0 then
    new_balance := public.add_credits_from_purchase(
      subscription.user_id,
      tier.subscription_credits,
      tier.name || ' subscription credits',
      p_provider_payment_reference || ':subscription-credits',
      p_provider
    );
  end if;

  update public.user_subscriptions
  set status = 'active',
      current_period_start = period_start,
      current_period_end = period_end,
      cancel_at_period_end = false,
      last_payment_reference = p_provider_payment_reference,
      updated_at = now()
  where id = subscription.id;

  if not exists (
    select 1
    from public.payment_history
    where provider = p_provider
      and provider_reference = p_provider_payment_reference
  ) then
    insert into public.payment_history (
      user_id,
      subscription_tier_id,
      amount_cents,
      currency,
      provider,
      provider_reference,
      status,
      purchase_type,
      description,
      metadata
    )
    values (
      subscription.user_id,
      subscription.tier_id,
      p_amount_minor::integer,
      upper(btrim(p_currency)),
      p_provider,
      p_provider_payment_reference,
      'succeeded',
      'subscription',
      tier.name || ' subscription renewal',
      jsonb_build_object(
        'provider_subscription_id',
        p_provider_subscription_id,
        'renewal',
        true
      )
    );
  end if;

  return jsonb_build_object(
    'subscription_id', subscription.id,
    'status', 'active',
    'balance_after', new_balance,
    'period_start', period_start,
    'period_end', period_end
  );
end;
$$;

revoke all on function public.wallet_register_payment_intent(
  uuid, text, uuid, text, text, bigint, text, bigint, text, jsonb
) from public, anon, authenticated;
grant execute on function public.wallet_register_payment_intent(
  uuid, text, uuid, text, text, bigint, text, bigint, text, jsonb
) to service_role;

revoke all on function public.wallet_configure_paystack_plan(uuid, text)
  from public, anon, authenticated;
grant execute on function public.wallet_configure_paystack_plan(uuid, text)
  to service_role;

revoke all on function public.wallet_claim_checkout_initialization(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.wallet_claim_checkout_initialization(uuid, uuid)
  to service_role;

revoke all on function public.wallet_mark_checkout_initialized(
  uuid, uuid, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.wallet_mark_checkout_initialized(
  uuid, uuid, text, text, text, timestamptz
) to service_role;

revoke all on function public.wallet_mark_checkout_failed(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.wallet_mark_checkout_failed(uuid, uuid, text, text)
  to service_role;

revoke all on function public.wallet_complete_payment(
  uuid, text, text, text, text, text, bigint, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.wallet_complete_payment(
  uuid, text, text, text, text, text, bigint, text, timestamptz, timestamptz
) to service_role;

revoke all on function public.wallet_complete_subscription_renewal(
  text, text, text, bigint, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.wallet_complete_subscription_renewal(
  text, text, text, bigint, text, timestamptz, timestamptz
) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Creator payout destinations and reserved payout requests
-- ---------------------------------------------------------------------------

create table if not exists public.creator_payout_destinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('paystack', 'stripe')),
  display_label text not null,
  account_last4 text,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  country_code text,
  status text not null default 'active'
    check (status in ('pending', 'active', 'disabled')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Provider recipient/account references are isolated from client-readable rows.
create table if not exists public.creator_payout_destination_secrets (
  destination_id uuid primary key
    references public.creator_payout_destinations(id) on delete cascade,
  provider_reference text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_payout_destinations enable row level security;
alter table public.creator_payout_destination_secrets enable row level security;

drop policy if exists "Users can read own creator payout destinations"
  on public.creator_payout_destinations;
create policy "Users can read own creator payout destinations"
  on public.creator_payout_destinations for select
  using (auth.uid() = user_id);

-- No client policy is created for destination secrets.

drop trigger if exists set_creator_payout_destinations_updated_at
  on public.creator_payout_destinations;
create trigger set_creator_payout_destinations_updated_at
before update on public.creator_payout_destinations
for each row execute function public.set_updated_at();

create or replace function public.wallet_save_creator_payout_destination(
  p_user_id uuid,
  p_display_label text,
  p_account_last4 text,
  p_currency text,
  p_country_code text,
  p_provider_reference text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.creator_payout_destinations
language plpgsql
security definer
set search_path = public
as $$
declare
  destination public.creator_payout_destinations;
begin
  if p_user_id is null
     or nullif(btrim(p_display_label), '') is null
     or p_account_last4 !~ '^[0-9]{4}$'
     or upper(btrim(p_currency)) !~ '^[A-Z]{3}$'
     or upper(btrim(p_country_code)) !~ '^[A-Z]{2}$'
     or nullif(btrim(p_provider_reference), '') is null then
    raise exception 'invalid payout destination details';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('creator-payout-destination:' || p_user_id::text, 0)
  );

  update public.creator_payout_destinations
  set is_default = false,
      updated_at = now()
  where user_id = p_user_id
    and is_default;

  insert into public.creator_payout_destinations (
    user_id,
    provider,
    display_label,
    account_last4,
    currency,
    country_code,
    status,
    is_default
  )
  values (
    p_user_id,
    'paystack',
    btrim(p_display_label),
    p_account_last4,
    upper(btrim(p_currency)),
    upper(btrim(p_country_code)),
    'active',
    true
  )
  returning * into destination;

  insert into public.creator_payout_destination_secrets (
    destination_id,
    provider_reference,
    metadata
  )
  values (
    destination.id,
    btrim(p_provider_reference),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return destination;
end;
$$;

drop trigger if exists set_creator_payout_destination_secrets_updated_at
  on public.creator_payout_destination_secrets;
create trigger set_creator_payout_destination_secrets_updated_at
before update on public.creator_payout_destination_secrets
for each row execute function public.set_updated_at();

alter table public.creator_payout_requests
  add column if not exists amount_minor bigint,
  add column if not exists provider text,
  add column if not exists payout_destination_id uuid
    references public.creator_payout_destinations(id) on delete restrict,
  add column if not exists idempotency_key text,
  add column if not exists provider_reference text,
  add column if not exists failure_reason text,
  add column if not exists funds_released_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists creator_payout_requests_user_idempotency_uidx
  on public.creator_payout_requests(user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists creator_payout_requests_provider_reference_uidx
  on public.creator_payout_requests(provider, provider_reference)
  where provider_reference is not null;

drop trigger if exists set_creator_payout_requests_updated_at
  on public.creator_payout_requests;
create trigger set_creator_payout_requests_updated_at
before update on public.creator_payout_requests
for each row execute function public.set_updated_at();

-- Payouts must reserve funds through the server-owned RPC below.
drop policy if exists "Users can create own payout requests"
  on public.creator_payout_requests;

create or replace function public.wallet_request_creator_payout(
  p_user_id uuid,
  p_amount_minor bigint,
  p_currency text,
  p_provider text,
  p_destination_id uuid,
  p_idempotency_key text
)
returns public.creator_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  monetization public.creator_monetization;
  destination public.creator_payout_destinations;
  payout public.creator_payout_requests;
  amount_major numeric(12,2);
begin
  if p_user_id is null then
    raise exception 'payout owner is required';
  end if;
  if p_amount_minor is null
     or p_amount_minor < 1000
     or p_amount_minor > 999999999999 then
    raise exception 'minimum payout is 1000 minor units';
  end if;
  if p_currency is null or upper(btrim(p_currency)) <> 'USD' then
    raise exception 'creator earnings are currently denominated in USD';
  end if;
  if p_provider is null or p_provider not in ('paystack', 'stripe') then
    raise exception 'unsupported payout provider';
  end if;
  if p_idempotency_key is null
     or length(p_idempotency_key) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid idempotency key';
  end if;

  -- Serialize retries for one creator so the idempotency lookup and balance
  -- reservation are one atomic decision.
  perform pg_advisory_xact_lock(
    hashtextextended('creator-payout:' || p_user_id::text, 0)
  );

  select * into payout
  from public.creator_payout_requests
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    if payout.amount_minor <> p_amount_minor
       or payout.provider <> p_provider
       or payout.payout_destination_id <> p_destination_id then
      raise exception 'idempotency key was already used for another payout';
    end if;
    return payout;
  end if;

  select * into payout
  from public.creator_payout_requests
  where user_id = p_user_id
    and status in ('pending', 'processing', 'queued')
  order by requested_at desc
  limit 1;

  if found then
    if payout.amount_minor = p_amount_minor
       and payout.provider = p_provider
       and payout.payout_destination_id = p_destination_id then
      return payout;
    end if;
    raise exception 'a payout request is already being processed';
  end if;

  select * into destination
  from public.creator_payout_destinations
  where id = p_destination_id
    and user_id = p_user_id
    and provider = p_provider
    and status = 'active';

  if not found then
    raise exception 'active payout destination not found';
  end if;

  select * into monetization
  from public.creator_monetization
  where user_id = p_user_id
  for update;

  if not found or not monetization.is_monetized then
    raise exception 'creator is not eligible for payouts';
  end if;

  amount_major := p_amount_minor::numeric / 100;
  if monetization.available_balance < amount_major then
    raise exception 'insufficient creator balance';
  end if;
  if monetization.next_eligible_payout is not null
     and monetization.next_eligible_payout > now() then
    raise exception 'creator payout cooldown is active';
  end if;

  update public.creator_monetization
  set available_balance = available_balance - amount_major,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.creator_payout_requests (
    user_id,
    amount,
    amount_minor,
    currency,
    payout_method,
    provider,
    payout_destination_id,
    idempotency_key,
    status,
    metadata
  )
  values (
    p_user_id,
    amount_major,
    p_amount_minor,
    'USD',
    p_provider,
    p_provider,
    p_destination_id,
    p_idempotency_key,
    'pending',
    jsonb_build_object('funds_reserved', true)
  )
  returning * into payout;

  return payout;
end;
$$;

-- Keep the native client's historical RPC name, but require an explicit
-- idempotency key so a lost response can be retried without reserving twice.
drop function if exists public.request_creator_payout(integer);
drop function if exists public.request_creator_payout(numeric);

create or replace function public.request_creator_payout(
  p_amount numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  destination_id uuid;
  payout_provider text;
  payout public.creator_payout_requests;
  amount_minor bigint;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;
  if p_amount is null
     or p_amount <= 0
     or p_amount > 9999999999.99
     or p_amount <> round(p_amount, 2) then
    raise exception 'payout amount must be a positive USD amount with at most two decimals';
  end if;

  amount_minor := (p_amount * 100)::bigint;

  select id, provider
  into destination_id, payout_provider
  from public.creator_payout_destinations
  where user_id = caller_id
    and status = 'active'
  order by is_default desc, created_at asc
  limit 1;

  if destination_id is null then
    raise exception 'an active payout destination is required';
  end if;

  payout := public.wallet_request_creator_payout(
    caller_id,
    amount_minor,
    'USD',
    payout_provider,
    destination_id,
    p_idempotency_key
  );

  return jsonb_build_object('success', true, 'request', to_jsonb(payout));
end;
$$;

create or replace function public.request_creator_payout(p_amount numeric)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.request_creator_payout(
    p_amount,
    'legacy-' || gen_random_uuid()::text
  );
$$;

revoke all on function public.request_creator_payout(numeric, text)
  from public, anon, authenticated;
grant execute on function public.request_creator_payout(numeric, text)
  to authenticated;

revoke all on function public.request_creator_payout(numeric)
  from public, anon, authenticated;
grant execute on function public.request_creator_payout(numeric)
  to authenticated;

alter table public.creator_payouts
  add column if not exists payout_request_id uuid
    references public.creator_payout_requests(id) on delete set null;

create unique index if not exists creator_payouts_request_uidx
  on public.creator_payouts(payout_request_id)
  where payout_request_id is not null;

create or replace function public.wallet_claim_creator_payout(
  p_request_id uuid,
  p_user_id uuid,
  p_provider_reference text
)
returns public.creator_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  payout public.creator_payout_requests;
begin
  if p_user_id is null
     or nullif(btrim(p_provider_reference), '') is null then
    raise exception 'invalid payout claim details';
  end if;

  select * into payout
  from public.creator_payout_requests
  where id = p_request_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'payout request not found';
  end if;
  if payout.provider <> 'paystack' then
    raise exception 'unsupported payout provider';
  end if;

  if payout.status = 'pending' then
    update public.creator_payout_requests
    set status = 'processing',
        provider_reference = btrim(p_provider_reference),
        updated_at = now()
    where id = payout.id
    returning * into payout;
    return payout;
  end if;

  if payout.status = 'processing'
     and payout.provider_reference = btrim(p_provider_reference) then
    return payout;
  end if;

  raise exception 'payout request cannot be claimed from status %', payout.status;
end;
$$;

create or replace function public.wallet_update_creator_payout_status(
  p_request_id uuid,
  p_status text,
  p_provider_reference text default null,
  p_failure_reason text default null
)
returns public.creator_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  payout public.creator_payout_requests;
begin
  if p_status not in ('processing', 'paid', 'failed', 'rejected', 'canceled') then
    raise exception 'invalid payout status';
  end if;
  if p_status = 'paid'
     and nullif(btrim(p_provider_reference), '') is null then
    raise exception 'provider reference is required for paid payouts';
  end if;

  select * into payout
  from public.creator_payout_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'payout request not found';
  end if;

  if payout.status in ('paid', 'failed', 'rejected', 'canceled') then
    return payout;
  end if;

  if p_status in ('failed', 'rejected', 'canceled')
     and payout.funds_released_at is null then
    update public.creator_monetization
    set available_balance = available_balance + payout.amount,
        updated_at = now()
    where user_id = payout.user_id;
  end if;

  update public.creator_payout_requests
  set status = p_status,
      provider_reference = coalesce(
        nullif(p_provider_reference, ''),
        provider_reference
      ),
      failure_reason = case
        when p_status in ('failed', 'rejected', 'canceled')
          then left(coalesce(p_failure_reason, p_status), 500)
        else null
      end,
      funds_released_at = case
        when p_status in ('failed', 'rejected', 'canceled')
          then coalesce(funds_released_at, now())
        else funds_released_at
      end,
      processed_at = case
        when p_status in ('paid', 'failed', 'rejected', 'canceled') then now()
        else processed_at
      end,
      updated_at = now()
  where id = payout.id
  returning * into payout;

  if p_status = 'paid' then
    update public.creator_monetization
    set last_payout_at = now(),
        updated_at = now()
    where user_id = payout.user_id;

    insert into public.creator_payouts (
      user_id,
      amount,
      currency,
      total_earnings,
      status,
      provider_reference,
      payout_request_id,
      paid_at
    )
    select
      payout.user_id,
      payout.amount,
      payout.currency,
      monetization.total_earnings,
      'paid',
      payout.provider_reference,
      payout.id,
      now()
    from public.creator_monetization monetization
    where monetization.user_id = payout.user_id
    on conflict (payout_request_id) where payout_request_id is not null
    do nothing;
  end if;

  return payout;
end;
$$;

revoke all on function public.wallet_request_creator_payout(
  uuid, bigint, text, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.wallet_request_creator_payout(
  uuid, bigint, text, text, uuid, text
) to service_role;

revoke all on function public.wallet_save_creator_payout_destination(
  uuid, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.wallet_save_creator_payout_destination(
  uuid, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.wallet_claim_creator_payout(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.wallet_claim_creator_payout(uuid, uuid, text)
  to service_role;

revoke all on function public.wallet_update_creator_payout_status(
  uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.wallet_update_creator_payout_status(
  uuid, text, text, text
) to service_role;
