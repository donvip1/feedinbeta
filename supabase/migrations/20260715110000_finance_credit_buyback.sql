-- Finance-team buyback of user credits.
--
-- Pending requests represent held credits: the user's spendable balance is
-- reduced immediately, but lifetime_spent is finalized only after USD
-- settlement. Rejected or canceled requests return the held credits exactly
-- once. Every state transition is recorded in an append-only audit table.

create table public.finance_credit_buyback_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references public.profiles(id) on delete restrict,
  credits_amount bigint not null check (credits_amount > 0),
  idempotency_key text not null
    check (
      idempotency_key = btrim(idempotency_key)
      and length(idempotency_key) between 8 and 128
    ),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'rejected', 'canceled')),
  hold_transaction_id uuid not null unique
    references public.credit_transactions(id) on delete restrict,
  refund_transaction_id uuid unique
    references public.credit_transactions(id) on delete restrict,
  settlement_currency text
    check (settlement_currency is null or settlement_currency = 'USD'),
  usd_amount_cents bigint
    check (usd_amount_cents is null or usd_amount_cents > 0),
  external_payment_reference text
    check (
      external_payment_reference is null
      or (
        external_payment_reference = btrim(external_payment_reference)
        and length(external_payment_reference) between 1 and 255
      )
    ),
  platform_wallet_balance_after bigint
    check (
      platform_wallet_balance_after is null
      or platform_wallet_balance_after >= 0
    ),
  notes text check (notes is null or length(notes) <= 2000),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint finance_credit_buyback_request_state_check check (
    (
      status = 'pending'
      and refund_transaction_id is null
      and settlement_currency is null
      and usd_amount_cents is null
      and external_payment_reference is null
      and platform_wallet_balance_after is null
      and reviewed_by is null
      and reviewed_at is null
      and completed_at is null
      and rejected_at is null
      and canceled_at is null
      and refunded_at is null
    )
    or (
      status = 'completed'
      and refund_transaction_id is null
      and settlement_currency = 'USD'
      and usd_amount_cents is not null
      and nullif(btrim(external_payment_reference), '') is not null
      and platform_wallet_balance_after is not null
      and reviewed_by is not null
      and reviewed_at is not null
      and completed_at is not null
      and rejected_at is null
      and canceled_at is null
      and refunded_at is null
    )
    or (
      status = 'rejected'
      and refund_transaction_id is not null
      and settlement_currency is null
      and usd_amount_cents is null
      and external_payment_reference is null
      and platform_wallet_balance_after is null
      and reviewed_by is not null
      and reviewed_at is not null
      and completed_at is null
      and rejected_at is not null
      and canceled_at is null
      and refunded_at is not null
    )
    or (
      status = 'canceled'
      and refund_transaction_id is not null
      and settlement_currency is null
      and usd_amount_cents is null
      and external_payment_reference is null
      and platform_wallet_balance_after is null
      and reviewed_by is null
      and reviewed_at is null
      and completed_at is null
      and rejected_at is null
      and canceled_at is not null
      and refunded_at is not null
    )
  ),
  unique (user_id, idempotency_key)
);

create unique index finance_credit_buyback_external_reference_uidx
  on public.finance_credit_buyback_requests(external_payment_reference)
  where external_payment_reference is not null;

create index finance_credit_buyback_user_requested_idx
  on public.finance_credit_buyback_requests(user_id, requested_at desc);

create index finance_credit_buyback_status_requested_idx
  on public.finance_credit_buyback_requests(status, requested_at);

create unique index credit_transactions_finance_buyback_reference_uidx
  on public.credit_transactions(payment_provider, payment_reference)
  where payment_provider = 'finance_buyback'
    and payment_reference is not null;

create table public.finance_credit_buyback_audit (
  id bigint generated always as identity primary key,
  request_id uuid not null
    references public.finance_credit_buyback_requests(id) on delete restrict,
  actor_user_id uuid not null
    references public.profiles(id) on delete restrict,
  actor_role text not null
    check (actor_role in ('user', 'finance_admin')),
  event_type text not null
    check (event_type in ('requested', 'completed', 'rejected', 'canceled')),
  from_status text
    check (
      from_status is null
      or from_status in ('pending', 'completed', 'rejected', 'canceled')
    ),
  to_status text not null
    check (to_status in ('pending', 'completed', 'rejected', 'canceled')),
  credits_amount bigint not null check (credits_amount > 0),
  usd_amount_cents bigint
    check (usd_amount_cents is null or usd_amount_cents > 0),
  external_payment_reference text
    check (
      external_payment_reference is null
      or (
        external_payment_reference = btrim(external_payment_reference)
        and length(external_payment_reference) between 1 and 255
      )
    ),
  credit_transaction_id uuid
    references public.credit_transactions(id) on delete restrict,
  user_balance_after bigint
    check (user_balance_after is null or user_balance_after >= 0),
  platform_wallet_balance_after bigint
    check (
      platform_wallet_balance_after is null
      or platform_wallet_balance_after >= 0
    ),
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint finance_credit_buyback_audit_transition_check check (
    (
      event_type = 'requested'
      and actor_role = 'user'
      and from_status is null
      and to_status = 'pending'
      and credit_transaction_id is not null
      and user_balance_after is not null
      and platform_wallet_balance_after is null
      and usd_amount_cents is null
      and external_payment_reference is null
    )
    or (
      event_type = 'completed'
      and actor_role = 'finance_admin'
      and from_status = 'pending'
      and to_status = 'completed'
      and credit_transaction_id is null
      and user_balance_after is null
      and platform_wallet_balance_after is not null
      and usd_amount_cents is not null
      and nullif(btrim(external_payment_reference), '') is not null
    )
    or (
      event_type in ('rejected', 'canceled')
      and actor_role = case
        when event_type = 'rejected' then 'finance_admin'
        else 'user'
      end
      and from_status = 'pending'
      and to_status = event_type
      and credit_transaction_id is not null
      and user_balance_after is not null
      and platform_wallet_balance_after is null
      and usd_amount_cents is null
      and external_payment_reference is null
    )
  )
);

create index finance_credit_buyback_audit_request_created_idx
  on public.finance_credit_buyback_audit(request_id, created_at);

drop trigger if exists set_finance_credit_buyback_requests_updated_at
  on public.finance_credit_buyback_requests;
create trigger set_finance_credit_buyback_requests_updated_at
before update on public.finance_credit_buyback_requests
for each row execute function public.set_updated_at();

create or replace function public.prevent_finance_credit_buyback_audit_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'finance credit buyback audit rows are append-only'
    using errcode = '55000';
  return null;
end;
$$;

create trigger prevent_finance_credit_buyback_audit_mutation
before update or delete on public.finance_credit_buyback_audit
for each row
execute function public.prevent_finance_credit_buyback_audit_mutation();

alter table public.finance_credit_buyback_requests enable row level security;
alter table public.finance_credit_buyback_audit enable row level security;

create policy "Users and finance admin can read buyback requests"
  on public.finance_credit_buyback_requests
  for select
  using (
    auth.uid() = user_id
    or public.can_view_admin_wallet()
  );

create policy "Users and finance admin can read buyback audit"
  on public.finance_credit_buyback_audit
  for select
  using (
    public.can_view_admin_wallet()
    or exists (
      select 1
      from public.finance_credit_buyback_requests request
      where request.id = finance_credit_buyback_audit.request_id
        and request.user_id = auth.uid()
    )
  );

-- Creating a request atomically converts spendable credits into a held amount.
create or replace function public.request_finance_buyback(
  p_credits_amount bigint,
  p_idempotency_key text
)
returns public.finance_credit_buyback_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  normalized_key text := nullif(btrim(p_idempotency_key), '');
  request_id uuid := gen_random_uuid();
  buyback public.finance_credit_buyback_requests;
  current_balance bigint;
  new_balance bigint;
  hold_transaction_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;
  if p_credits_amount is null or p_credits_amount <= 0 then
    raise exception 'credits amount must be positive';
  end if;
  if normalized_key is null
     or length(normalized_key) < 8
     or length(normalized_key) > 128 then
    raise exception 'invalid idempotency key';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('finance-buyback-user:' || caller_id::text, 0)
  );

  select request.*
  into buyback
  from public.finance_credit_buyback_requests request
  where request.user_id = caller_id
    and request.idempotency_key = normalized_key;

  if found then
    if buyback.credits_amount <> p_credits_amount then
      raise exception 'idempotency key was already used for another buyback';
    end if;
    return buyback;
  end if;

  select credits.balance
  into current_balance
  from public.user_credits credits
  where credits.user_id = caller_id
  for update;

  if not found then
    raise exception 'credit balance not found';
  end if;
  if current_balance < p_credits_amount then
    raise exception 'insufficient credit balance';
  end if;

  update public.user_credits
  set balance = balance - p_credits_amount,
      updated_at = now()
  where user_id = caller_id
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
    caller_id,
    -p_credits_amount,
    new_balance,
    'finance_buyback_hold',
    'Credits held for finance buyback',
    'finance-buyback:' || request_id::text || ':hold',
    'finance_buyback',
    jsonb_build_object(
      'request_id', request_id,
      'event', 'hold',
      'idempotency_key', normalized_key
    )
  )
  returning id into hold_transaction_id;

  insert into public.finance_credit_buyback_requests (
    id,
    user_id,
    credits_amount,
    idempotency_key,
    status,
    hold_transaction_id
  )
  values (
    request_id,
    caller_id,
    p_credits_amount,
    normalized_key,
    'pending',
    hold_transaction_id
  )
  returning * into buyback;

  insert into public.finance_credit_buyback_audit (
    request_id,
    actor_user_id,
    actor_role,
    event_type,
    from_status,
    to_status,
    credits_amount,
    credit_transaction_id,
    user_balance_after
  )
  values (
    buyback.id,
    caller_id,
    'user',
    'requested',
    null,
    'pending',
    buyback.credits_amount,
    hold_transaction_id,
    new_balance
  );

  return buyback;
end;
$$;

-- Users may cancel only their own pending request. A repeated cancel returns the
-- already-canceled row without issuing a second refund.
create or replace function public.cancel_finance_buyback(
  p_request_id uuid
)
returns public.finance_credit_buyback_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  buyback public.finance_credit_buyback_requests;
  new_balance bigint;
  new_refund_transaction_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;

  select request.*
  into buyback
  from public.finance_credit_buyback_requests request
  where request.id = p_request_id
    and request.user_id = caller_id
  for update;

  if not found then
    raise exception 'buyback request not found';
  end if;
  if buyback.status = 'canceled' then
    return buyback;
  end if;
  if buyback.status <> 'pending' then
    raise exception 'only pending buyback requests can be canceled';
  end if;

  perform 1
  from public.user_credits credits
  where credits.user_id = buyback.user_id
  for update;

  if not found then
    raise exception 'credit balance not found';
  end if;

  update public.user_credits
  set balance = balance + buyback.credits_amount,
      updated_at = now()
  where user_id = buyback.user_id
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
    buyback.user_id,
    buyback.credits_amount,
    new_balance,
    'finance_buyback_refund',
    'Finance buyback canceled; held credits returned',
    'finance-buyback:' || buyback.id::text || ':refund',
    'finance_buyback',
    jsonb_build_object(
      'request_id', buyback.id,
      'event', 'canceled'
    )
  )
  returning id into new_refund_transaction_id;

  update public.finance_credit_buyback_requests
  set status = 'canceled',
      refund_transaction_id = new_refund_transaction_id,
      canceled_at = now(),
      refunded_at = now(),
      updated_at = now()
  where id = buyback.id
  returning * into buyback;

  insert into public.finance_credit_buyback_audit (
    request_id,
    actor_user_id,
    actor_role,
    event_type,
    from_status,
    to_status,
    credits_amount,
    credit_transaction_id,
    user_balance_after
  )
  values (
    buyback.id,
    caller_id,
    'user',
    'canceled',
    'pending',
    'canceled',
    buyback.credits_amount,
    new_refund_transaction_id,
    new_balance
  );

  return buyback;
end;
$$;

-- Completing a request settles the held credits into the platform wallet.
create or replace function public.admin_complete_finance_buyback(
  p_request_id uuid,
  p_usd_amount_cents bigint,
  p_external_payment_reference text,
  p_notes text default null
)
returns public.finance_credit_buyback_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reviewer_id uuid := auth.uid();
  normalized_reference text :=
    nullif(btrim(p_external_payment_reference), '');
  normalized_notes text := nullif(btrim(p_notes), '');
  buyback public.finance_credit_buyback_requests;
  platform_balance bigint;
begin
  if public.can_view_admin_wallet() is not true then
    raise exception 'not authorized';
  end if;
  if reviewer_id is null then
    raise exception 'authentication is required';
  end if;
  if p_usd_amount_cents is null or p_usd_amount_cents <= 0 then
    raise exception 'USD settlement amount must be positive';
  end if;
  if normalized_reference is null or length(normalized_reference) > 255 then
    raise exception 'external payment reference is required';
  end if;
  if normalized_notes is not null and length(normalized_notes) > 2000 then
    raise exception 'notes are too long';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'finance-buyback-settlement:' || normalized_reference,
      0
    )
  );

  select request.*
  into buyback
  from public.finance_credit_buyback_requests request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'buyback request not found';
  end if;
  if buyback.status = 'completed' then
    if buyback.usd_amount_cents <> p_usd_amount_cents
       or buyback.external_payment_reference <> normalized_reference then
      raise exception 'buyback request was completed with different settlement data';
    end if;
    return buyback;
  end if;
  if buyback.status <> 'pending' then
    raise exception 'only pending buyback requests can be completed';
  end if;
  if exists (
    select 1
    from public.finance_credit_buyback_requests request
    where request.external_payment_reference = normalized_reference
      and request.id <> buyback.id
  ) then
    raise exception 'external payment reference is already in use';
  end if;

  select wallet.balance
  into platform_balance
  from public.platform_wallet wallet
  where wallet.id = 1
  for update;

  if not found then
    raise exception 'platform wallet is not configured';
  end if;

  update public.platform_wallet
  set balance = balance + buyback.credits_amount,
      updated_at = now()
  where id = 1
  returning balance into platform_balance;

  update public.user_credits
  set lifetime_spent = lifetime_spent + buyback.credits_amount,
      updated_at = now()
  where user_id = buyback.user_id;

  if not found then
    raise exception 'credit balance not found';
  end if;

  update public.finance_credit_buyback_requests
  set status = 'completed',
      settlement_currency = 'USD',
      usd_amount_cents = p_usd_amount_cents,
      external_payment_reference = normalized_reference,
      platform_wallet_balance_after = platform_balance,
      notes = normalized_notes,
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      completed_at = now(),
      updated_at = now()
  where id = buyback.id
  returning * into buyback;

  insert into public.finance_credit_buyback_audit (
    request_id,
    actor_user_id,
    actor_role,
    event_type,
    from_status,
    to_status,
    credits_amount,
    usd_amount_cents,
    external_payment_reference,
    platform_wallet_balance_after,
    notes
  )
  values (
    buyback.id,
    reviewer_id,
    'finance_admin',
    'completed',
    'pending',
    'completed',
    buyback.credits_amount,
    buyback.usd_amount_cents,
    buyback.external_payment_reference,
    platform_balance,
    normalized_notes
  );

  return buyback;
end;
$$;

-- Rejecting a request returns its held credits and records the finance reviewer.
-- A repeated rejection returns the already-rejected row without refunding twice.
create or replace function public.admin_reject_finance_buyback(
  p_request_id uuid,
  p_notes text default null
)
returns public.finance_credit_buyback_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reviewer_id uuid := auth.uid();
  normalized_notes text := nullif(btrim(p_notes), '');
  buyback public.finance_credit_buyback_requests;
  new_balance bigint;
  new_refund_transaction_id uuid;
begin
  if public.can_view_admin_wallet() is not true then
    raise exception 'not authorized';
  end if;
  if reviewer_id is null then
    raise exception 'authentication is required';
  end if;
  if normalized_notes is not null and length(normalized_notes) > 2000 then
    raise exception 'notes are too long';
  end if;

  select request.*
  into buyback
  from public.finance_credit_buyback_requests request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'buyback request not found';
  end if;
  if buyback.status = 'rejected' then
    return buyback;
  end if;
  if buyback.status <> 'pending' then
    raise exception 'only pending buyback requests can be rejected';
  end if;

  perform 1
  from public.user_credits credits
  where credits.user_id = buyback.user_id
  for update;

  if not found then
    raise exception 'credit balance not found';
  end if;

  update public.user_credits
  set balance = balance + buyback.credits_amount,
      updated_at = now()
  where user_id = buyback.user_id
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
    buyback.user_id,
    buyback.credits_amount,
    new_balance,
    'finance_buyback_refund',
    'Finance buyback rejected; held credits returned',
    'finance-buyback:' || buyback.id::text || ':refund',
    'finance_buyback',
    jsonb_build_object(
      'request_id', buyback.id,
      'event', 'rejected'
    )
  )
  returning id into new_refund_transaction_id;

  update public.finance_credit_buyback_requests
  set status = 'rejected',
      refund_transaction_id = new_refund_transaction_id,
      notes = normalized_notes,
      reviewed_by = reviewer_id,
      reviewed_at = now(),
      rejected_at = now(),
      refunded_at = now(),
      updated_at = now()
  where id = buyback.id
  returning * into buyback;

  insert into public.finance_credit_buyback_audit (
    request_id,
    actor_user_id,
    actor_role,
    event_type,
    from_status,
    to_status,
    credits_amount,
    credit_transaction_id,
    user_balance_after,
    notes
  )
  values (
    buyback.id,
    reviewer_id,
    'finance_admin',
    'rejected',
    'pending',
    'rejected',
    buyback.credits_amount,
    new_refund_transaction_id,
    new_balance,
    normalized_notes
  );

  return buyback;
end;
$$;

-- Direct table mutation is intentionally unavailable to API roles. RLS permits
-- authenticated users to select their own rows and the finance admin to select
-- all rows; every write must go through a SECURITY DEFINER RPC.
revoke all on table public.finance_credit_buyback_requests
  from public, anon, authenticated, service_role;
grant select on table public.finance_credit_buyback_requests
  to authenticated;

revoke all on table public.finance_credit_buyback_audit
  from public, anon, authenticated, service_role;
grant select on table public.finance_credit_buyback_audit
  to authenticated;

revoke all on sequence public.finance_credit_buyback_audit_id_seq
  from public, anon, authenticated, service_role;

revoke all on function public.prevent_finance_credit_buyback_audit_mutation()
  from public, anon, authenticated, service_role;

revoke all on function public.request_finance_buyback(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function public.request_finance_buyback(bigint, text)
  to authenticated;

revoke all on function public.cancel_finance_buyback(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_finance_buyback(uuid)
  to authenticated;

revoke all on function public.admin_complete_finance_buyback(
  uuid, bigint, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.admin_complete_finance_buyback(
  uuid, bigint, text, text
) to authenticated;

revoke all on function public.admin_reject_finance_buyback(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_reject_finance_buyback(uuid, text)
  to authenticated;
