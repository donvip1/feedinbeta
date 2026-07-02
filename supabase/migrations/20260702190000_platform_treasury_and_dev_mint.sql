-- Platform treasury + developer mint wallet (server-authoritative, no client trust).
--
-- Model (all identities/balances live in the DB, never in the mobile app):
--   * Developer (mint) wallet  = the user_credits row for the developer account
--     (viplearn4free@gmail.com). Seeded with 10,000,000,000 credits. The reserve.
--   * Project (platform) wallet = a single-row pool that backs credits issued to
--     users. Auto-refilled from the developer wallet on demand.
--   * A user buying credits (after verified Paystack payment) gets credits issued
--     from the project wallet via add_credits_from_purchase(); the project wallet
--     is debited and, if short, transparently topped up from the developer wallet.
--
-- Security properties:
--   * The developer-wallet address is stored in platform_config, which is
--     RLS-locked (no client can read it) and made IMMUTABLE by a trigger (any
--     UPDATE/DELETE of that key raises an error) — fixed and unchangeable.
--   * platform_wallet/platform_config carry NO client policies except an
--     admin-only read; regular users can neither see nor modify them.
--   * All credit movement happens in SECURITY DEFINER functions the app can only
--     invoke — balances are never writable directly by clients.

-- ---------------------------------------------------------------------------
-- 0. Widen credit amounts to bigint (10B > int4 max of 2,147,483,647)
-- ---------------------------------------------------------------------------
alter table public.user_credits
  alter column balance type bigint,
  alter column lifetime_earned type bigint,
  alter column lifetime_spent type bigint;

alter table public.credit_transactions
  alter column amount type bigint,
  alter column balance_after type bigint;

-- ---------------------------------------------------------------------------
-- 1. Project (platform) wallet — single row
-- ---------------------------------------------------------------------------
create table if not exists public.platform_wallet (
  id integer primary key default 1 check (id = 1),
  balance bigint not null default 0 check (balance >= 0),
  lifetime_supplied bigint not null default 0,
  lifetime_issued bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.platform_wallet (id, balance) values (1, 0)
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Immutable server-side config: the developer (mint) wallet address
-- ---------------------------------------------------------------------------
create table if not exists public.platform_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.platform_config (key, value)
  values ('developer_wallet_user_id', '05f5ff0f-16a5-44c6-ad47-d89ea469437e')
  on conflict (key) do nothing;

-- Make the developer wallet address FIXED: block any change/removal of the key.
create or replace function public.protect_platform_config()
returns trigger language plpgsql as $$
begin
  if coalesce(old.key, new.key) = 'developer_wallet_user_id' then
    raise exception 'developer_wallet_user_id is immutable and cannot be changed';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists protect_platform_config_trg on public.platform_config;
create trigger protect_platform_config_trg
  before update or delete on public.platform_config
  for each row execute function public.protect_platform_config();

-- ---------------------------------------------------------------------------
-- 3. RLS — clients cannot see or touch the treasury (admin read only)
-- ---------------------------------------------------------------------------
alter table public.platform_wallet enable row level security;
alter table public.platform_config enable row level security;

create or replace function public.can_view_admin_wallet()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = (
    select value::uuid from public.platform_config
    where key = 'developer_wallet_user_id'
  );
$$;

drop policy if exists "Admin can view platform wallet" on public.platform_wallet;
create policy "Admin can view platform wallet"
  on public.platform_wallet for select using (public.can_view_admin_wallet());

-- (No policies on platform_config → invisible to every client; only service_role
--  and SECURITY DEFINER functions can read it.)

-- ---------------------------------------------------------------------------
-- 4. Seed the developer (mint) wallet with 10,000,000,000 credits
-- ---------------------------------------------------------------------------
do $$
declare
  dev uuid := (select value::uuid from public.platform_config where key = 'developer_wallet_user_id');
begin
  insert into public.user_credits (user_id, balance, lifetime_earned)
    values (dev, 10000000000, 10000000000)
  on conflict (user_id) do update
    set balance = 10000000000,
        lifetime_earned = greatest(public.user_credits.lifetime_earned, 10000000000),
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Credit-movement functions (SECURITY DEFINER; clients can only invoke)
-- ---------------------------------------------------------------------------

-- Issue purchased credits to a user and debit the project wallet. Called by the
-- paystack-webhook edge function (service_role) AFTER a payment is verified —
-- never by the client directly. If the project wallet is short, it is topped up
-- from the developer (mint) wallet so purchases never fail while reserves exist.
create or replace function public.add_credits_from_purchase(
  p_user_id uuid,
  p_amount bigint,
  p_description text default 'Credit purchase',
  p_reference text default null
)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  dev uuid := (select value::uuid from public.platform_config where key = 'developer_wallet_user_id');
  pool bigint;
  shortfall bigint;
  new_balance bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Ensure the project pool can cover the issue; refill from the mint if needed.
  select balance into pool from public.platform_wallet where id = 1 for update;
  if pool < p_amount then
    shortfall := p_amount - pool;
    update public.user_credits
      set balance = balance - shortfall,
          lifetime_spent = lifetime_spent + shortfall,
          updated_at = now()
      where user_id = dev and balance >= shortfall;
    if not found then
      raise exception 'developer reserve exhausted: cannot issue % credits', p_amount;
    end if;
    update public.platform_wallet
      set balance = balance + shortfall,
          lifetime_supplied = lifetime_supplied + shortfall,
          updated_at = now()
      where id = 1;
  end if;

  -- Debit the project pool and credit the user.
  update public.platform_wallet
    set balance = balance - p_amount,
        lifetime_issued = lifetime_issued + p_amount,
        updated_at = now()
    where id = 1;

  insert into public.user_credits (user_id, balance, lifetime_earned)
    values (p_user_id, p_amount, p_amount)
  on conflict (user_id) do update
    set balance = public.user_credits.balance + p_amount,
        lifetime_earned = public.user_credits.lifetime_earned + p_amount,
        updated_at = now()
  returning balance into new_balance;

  insert into public.credit_transactions
    (user_id, amount, balance_after, type, description, payment_reference, payment_provider)
    values (p_user_id, p_amount, new_balance, 'purchase', p_description, p_reference, 'paystack');

  return new_balance;
end;
$$;

-- Manual top-up: move credits from the developer (mint) wallet into the project
-- wallet. Admin (developer) only; the in-function gate is the real enforcement.
create or replace function public.supply_project_wallet(p_amount bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  dev uuid := (select value::uuid from public.platform_config where key = 'developer_wallet_user_id');
  pool bigint;
begin
  if not public.can_view_admin_wallet() then
    raise exception 'not authorized';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update public.user_credits
    set balance = balance - p_amount,
        lifetime_spent = lifetime_spent + p_amount,
        updated_at = now()
    where user_id = dev and balance >= p_amount;
  if not found then
    raise exception 'insufficient developer wallet balance';
  end if;

  update public.platform_wallet
    set balance = balance + p_amount,
        lifetime_supplied = lifetime_supplied + p_amount,
        updated_at = now()
    where id = 1
  returning balance into pool;

  return pool;
end;
$$;

-- Lock down execution: clients cannot self-issue credits. NOTE: Supabase grants
-- EXECUTE on public functions to `authenticated`/`anon` by default, so revoking
-- from PUBLIC is not enough — must revoke from those roles explicitly, leaving
-- only service_role (the paystack-webhook, post-payment) able to issue.
revoke all on function public.add_credits_from_purchase(uuid, bigint, text, text) from public;
revoke execute on function public.add_credits_from_purchase(uuid, bigint, text, text) from authenticated, anon;
grant execute on function public.add_credits_from_purchase(uuid, bigint, text, text) to service_role;
revoke all on function public.supply_project_wallet(bigint) from public;
grant execute on function public.supply_project_wallet(bigint) to authenticated, service_role;
grant execute on function public.can_view_admin_wallet() to authenticated, service_role;
