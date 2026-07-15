-- Server-authoritative P2P credit trading.
--
-- Listings remain user-created, but every reservation, escrow movement,
-- payment transition, cancellation, and dispute settlement is performed by a
-- SECURITY DEFINER RPC under row locks. Credit ledger references are unique so
-- retries cannot debit, release, or refund credits more than once.

-- ---------------------------------------------------------------------------
-- 1. Bigint credit amounts and additive trade state
-- ---------------------------------------------------------------------------

alter table public.p2p_listings
  alter column credits_amount type bigint;

alter table public.p2p_transactions
  alter column credits_amount type bigint;

alter table public.p2p_escrow
  alter column credits_amount type bigint;

alter table public.p2p_user_eligibility
  alter column can_sell set default true;

update public.p2p_user_eligibility
set can_sell = true,
    updated_at = now()
where can_sell is distinct from true;

alter table public.p2p_listings
  add column if not exists payment_window_minutes integer default 30,
  add column if not exists reserved_transaction_id uuid
    references public.p2p_transactions(id) on delete set null,
  add column if not exists reserved_at timestamptz,
  add column if not exists reservation_expires_at timestamptz;

alter table public.p2p_transactions
  add column if not exists idempotency_key text,
  add column if not exists proof_url text,
  add column if not exists proof_notes text,
  add column if not exists proof_submitted_at timestamptz,
  add column if not exists dispute_id uuid
    references public.p2p_disputes(id) on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists settled_at timestamptz,
  add column if not exists settled_to text,
  add column if not exists settlement_reason text;

alter table public.p2p_escrow
  add column if not exists dispute_id uuid
    references public.p2p_disputes(id) on delete set null,
  add column if not exists refunded_at timestamptz,
  add column if not exists settled_by uuid
    references public.profiles(id) on delete set null,
  add column if not exists settlement_reason text;

alter table public.p2p_disputes
  add column if not exists award_to text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.credit_transactions
  add column if not exists p2p_transaction_id uuid
    references public.p2p_transactions(id) on delete restrict;

comment on column public.p2p_transactions.proof_url is
  'Private p2p-proofs object path, not a public URL.';
comment on column public.p2p_payment_proofs.proof_url is
  'Private p2p-proofs object path, not a public URL.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.p2p_listings'::regclass
      and conname = 'p2p_listings_trade_status_check'
  ) then
    alter table public.p2p_listings
      add constraint p2p_listings_trade_status_check
      check (status in ('active', 'reserved', 'sold', 'cancelled'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.p2p_listings'::regclass
      and conname = 'p2p_listings_payment_window_check'
  ) then
    alter table public.p2p_listings
      add constraint p2p_listings_payment_window_check
      check (
        payment_window_minutes is null
        or payment_window_minutes between 5 and 1440
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.p2p_transactions'::regclass
      and conname = 'p2p_transactions_trade_status_check'
  ) then
    alter table public.p2p_transactions
      add constraint p2p_transactions_trade_status_check
      check (
        status in (
          'pending',
          'proof_submitted',
          'disputed',
          'completed',
          'cancelled'
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.p2p_transactions'::regclass
      and conname = 'p2p_transactions_idempotency_key_check'
  ) then
    alter table public.p2p_transactions
      add constraint p2p_transactions_idempotency_key_check
      check (
        idempotency_key is null
        or (
          idempotency_key = btrim(idempotency_key)
          and length(idempotency_key) between 8 and 128
        )
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.p2p_transactions'::regclass
      and conname = 'p2p_transactions_settled_to_check'
  ) then
    alter table public.p2p_transactions
      add constraint p2p_transactions_settled_to_check
      check (settled_to is null or settled_to in ('buyer', 'seller'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.p2p_escrow'::regclass
      and conname = 'p2p_escrow_trade_status_check'
  ) then
    alter table public.p2p_escrow
      add constraint p2p_escrow_trade_status_check
      check (status in ('locked', 'released', 'refunded'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.p2p_disputes'::regclass
      and conname = 'p2p_disputes_trade_status_check'
  ) then
    alter table public.p2p_disputes
      add constraint p2p_disputes_trade_status_check
      check (status in ('open', 'under_review', 'resolved', 'cancelled'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.p2p_disputes'::regclass
      and conname = 'p2p_disputes_award_to_check'
  ) then
    alter table public.p2p_disputes
      add constraint p2p_disputes_award_to_check
      check (award_to is null or award_to in ('buyer', 'seller'))
      not valid;
  end if;
end;
$$;

create unique index if not exists p2p_transactions_buyer_idempotency_uidx
  on public.p2p_transactions(buyer_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists p2p_transactions_active_listing_uidx
  on public.p2p_transactions(listing_id)
  where listing_id is not null
    and status in ('pending', 'proof_submitted', 'disputed');

create index if not exists p2p_transactions_status_expires_idx
  on public.p2p_transactions(status, expires_at)
  where status in ('pending', 'proof_submitted', 'disputed');

create unique index if not exists p2p_escrow_transaction_uidx
  on public.p2p_escrow(transaction_id);

create unique index if not exists p2p_disputes_transaction_uidx
  on public.p2p_disputes(transaction_id);

create index if not exists p2p_payment_proofs_transaction_created_idx
  on public.p2p_payment_proofs(transaction_id, created_at desc);

create unique index if not exists credit_transactions_p2p_event_uidx
  on public.credit_transactions(p2p_transaction_id, user_id, type)
  where p2p_transaction_id is not null;

drop trigger if exists set_p2p_disputes_updated_at
  on public.p2p_disputes;
create trigger set_p2p_disputes_updated_at
before update on public.p2p_disputes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Private proof storage scoped to transaction participants
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'p2p-proofs',
  'p2p-proofs',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own p2p proofs"
  on storage.objects;
drop policy if exists "Users can view p2p proofs"
  on storage.objects;
drop policy if exists "P2P participants can read proof objects"
  on storage.objects;
create policy "P2P participants can read proof objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'p2p-proofs'
  and (storage.foldername(name))[1] = 'proofs'
  and exists (
    select 1
    from public.p2p_transactions transaction
    where transaction.id::text = (storage.foldername(name))[2]
      and auth.uid() in (
        transaction.buyer_id,
        transaction.seller_id
      )
  )
);

drop policy if exists "P2P participants can upload proof objects"
  on storage.objects;
create policy "P2P participants can upload proof objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'p2p-proofs'
  and (storage.foldername(name))[1] = 'proofs'
  and exists (
    select 1
    from public.p2p_transactions transaction
    where transaction.id::text = (storage.foldername(name))[2]
      and auth.uid() in (
        transaction.buyer_id,
        transaction.seller_id
      )
      and transaction.status in (
        'pending',
        'proof_submitted',
        'disputed'
      )
  )
);

-- ---------------------------------------------------------------------------
-- 3. Append-only trade audit
-- ---------------------------------------------------------------------------

create table if not exists public.p2p_trade_events (
  id bigint generated always as identity primary key,
  transaction_id uuid not null
    references public.p2p_transactions(id) on delete restrict,
  listing_id uuid
    references public.p2p_listings(id) on delete set null,
  actor_id uuid not null
    references public.profiles(id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text not null,
  credits_amount bigint not null check (credits_amount > 0),
  credit_transaction_id uuid
    references public.credit_transactions(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists p2p_trade_events_transaction_created_idx
  on public.p2p_trade_events(transaction_id, created_at);

alter table public.p2p_trade_events enable row level security;

drop policy if exists "P2P parties and admin can read trade events"
  on public.p2p_trade_events;
create policy "P2P parties and admin can read trade events"
on public.p2p_trade_events for select
using (
  public.can_view_admin_wallet()
  or exists (
    select 1
    from public.p2p_transactions transaction
    where transaction.id = p2p_trade_events.transaction_id
      and auth.uid() in (
        transaction.buyer_id,
        transaction.seller_id
      )
  )
);

create or replace function public.prevent_p2p_trade_event_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'P2P trade events are append-only'
    using errcode = '55000';
  return null;
end;
$$;

drop trigger if exists prevent_p2p_trade_event_mutation
  on public.p2p_trade_events;
create trigger prevent_p2p_trade_event_mutation
before update or delete on public.p2p_trade_events
for each row execute function public.prevent_p2p_trade_event_mutation();

-- ---------------------------------------------------------------------------
-- 4. RLS hardening: clients read state but mutations go through RPCs
-- ---------------------------------------------------------------------------

drop policy if exists "Active p2p listings are readable"
  on public.p2p_listings;
create policy "Active p2p listings are readable"
on public.p2p_listings for select
using (
  status = 'active'
  or auth.uid() = seller_id
  or public.can_view_admin_wallet()
  or exists (
    select 1
    from public.p2p_transactions transaction
    where transaction.listing_id = p2p_listings.id
      and auth.uid() in (
        transaction.buyer_id,
        transaction.seller_id
      )
  )
);

drop policy if exists "Users can create own p2p listings"
  on public.p2p_listings;
create policy "Users can create own p2p listings"
on public.p2p_listings for insert
with check (
  auth.uid() = seller_id
  and status = 'active'
  and reserved_transaction_id is null
  and reserved_at is null
  and reservation_expires_at is null
);

drop policy if exists "Users can update own p2p listings"
  on public.p2p_listings;
create policy "Users can update own p2p listings"
on public.p2p_listings for update
using (
  auth.uid() = seller_id
  and status = 'active'
  and reserved_transaction_id is null
)
with check (
  auth.uid() = seller_id
  and status in ('active', 'cancelled')
  and reserved_transaction_id is null
  and reserved_at is null
  and reservation_expires_at is null
);

drop policy if exists "P2P parties can read transactions"
  on public.p2p_transactions;
create policy "P2P parties can read transactions"
on public.p2p_transactions for select
using (
  auth.uid() in (buyer_id, seller_id)
  or public.can_view_admin_wallet()
);

drop policy if exists "Buyers can create p2p transactions"
  on public.p2p_transactions;

drop policy if exists "P2P parties can read escrow"
  on public.p2p_escrow;
create policy "P2P parties can read escrow"
on public.p2p_escrow for select
using (
  auth.uid() in (buyer_id, seller_id)
  or public.can_view_admin_wallet()
);

drop policy if exists "P2P parties can read proofs"
  on public.p2p_payment_proofs;
create policy "P2P parties can read proofs"
on public.p2p_payment_proofs for select
using (
  public.can_view_admin_wallet()
  or exists (
    select 1
    from public.p2p_transactions transaction
    where transaction.id = p2p_payment_proofs.transaction_id
      and auth.uid() in (
        transaction.buyer_id,
        transaction.seller_id
      )
  )
);

drop policy if exists "P2P parties can upload proofs"
  on public.p2p_payment_proofs;

drop policy if exists "P2P parties can read disputes"
  on public.p2p_disputes;
create policy "P2P parties can read disputes"
on public.p2p_disputes for select
using (
  public.can_view_admin_wallet()
  or exists (
    select 1
    from public.p2p_transactions transaction
    where transaction.id = p2p_disputes.transaction_id
      and auth.uid() in (
        transaction.buyer_id,
        transaction.seller_id
      )
  )
);

drop policy if exists "P2P parties can create disputes"
  on public.p2p_disputes;

revoke insert, update, delete on table public.p2p_transactions
  from public, anon, authenticated;
revoke insert, update, delete on table public.p2p_escrow
  from public, anon, authenticated;
revoke insert, update, delete on table public.p2p_payment_proofs
  from public, anon, authenticated;
revoke insert, update, delete on table public.p2p_disputes
  from public, anon, authenticated;
revoke insert, update, delete on table public.p2p_user_eligibility
  from public, anon, authenticated;
revoke insert, update, delete on table public.user_credits
  from public, anon, authenticated;
revoke insert, update, delete on table public.credit_transactions
  from public, anon, authenticated;

revoke all on table public.p2p_trade_events
  from public, anon, authenticated, service_role;
grant select on table public.p2p_trade_events
  to authenticated, service_role;

revoke all on sequence public.p2p_trade_events_id_seq
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Buyer starts a transaction and seller credits move into escrow
-- ---------------------------------------------------------------------------

create or replace function public.p2p_start_transaction(
  p_listing_id uuid,
  p_idempotency_key text
)
returns public.p2p_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  normalized_key text := nullif(btrim(p_idempotency_key), '');
  listing public.p2p_listings;
  transaction public.p2p_transactions;
  seller_balance bigint;
  seller_balance_after bigint;
  payment_window integer;
  escrow_id uuid;
  ledger_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;
  if p_listing_id is null then
    raise exception 'listing id is required';
  end if;
  if normalized_key is null
     or length(normalized_key) < 8
     or length(normalized_key) > 128 then
    raise exception 'invalid idempotency key';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'p2p-start:' || caller_id::text || ':' || normalized_key,
      0
    )
  );

  select existing.*
  into transaction
  from public.p2p_transactions existing
  where existing.buyer_id = caller_id
    and existing.idempotency_key = normalized_key;

  if found then
    if transaction.listing_id is distinct from p_listing_id then
      raise exception 'idempotency key was already used for another listing';
    end if;
    return transaction;
  end if;

  select candidate.*
  into listing
  from public.p2p_listings candidate
  where candidate.id = p_listing_id
  for update;

  if not found then
    raise exception 'listing not found';
  end if;
  if listing.seller_id = caller_id then
    raise exception 'buyers cannot purchase their own listing';
  end if;
  if listing.status <> 'active'
     or listing.reserved_transaction_id is not null then
    raise exception 'listing is not available';
  end if;
  if listing.credits_amount <= 0 then
    raise exception 'listing has an invalid credit amount';
  end if;

  payment_window := coalesce(listing.payment_window_minutes, 30);
  if payment_window < 5 or payment_window > 1440 then
    raise exception 'listing has an invalid payment window';
  end if;

  select credits.balance
  into seller_balance
  from public.user_credits credits
  where credits.user_id = listing.seller_id
  for update;

  if not found then
    raise exception 'seller credit balance not found';
  end if;
  if seller_balance < listing.credits_amount then
    raise exception 'seller has insufficient available credits';
  end if;

  update public.user_credits
  set balance = balance - listing.credits_amount,
      updated_at = now()
  where user_id = listing.seller_id
  returning balance into seller_balance_after;

  insert into public.p2p_transactions (
    listing_id,
    buyer_id,
    seller_id,
    credits_amount,
    price_cents,
    currency,
    status,
    escrow_locked,
    expires_at,
    idempotency_key
  )
  values (
    listing.id,
    caller_id,
    listing.seller_id,
    listing.credits_amount,
    listing.price_cents,
    listing.currency,
    'pending',
    true,
    now() + make_interval(mins => payment_window),
    normalized_key
  )
  returning * into transaction;

  update public.p2p_listings
  set status = 'reserved',
      reserved_transaction_id = transaction.id,
      reserved_at = now(),
      reservation_expires_at = transaction.expires_at,
      updated_at = now()
  where id = listing.id;

  insert into public.p2p_escrow (
    transaction_id,
    seller_id,
    buyer_id,
    credits_amount,
    status
  )
  values (
    transaction.id,
    transaction.seller_id,
    transaction.buyer_id,
    transaction.credits_amount,
    'locked'
  )
  returning id into escrow_id;

  insert into public.credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    payment_reference,
    payment_provider,
    metadata,
    p2p_transaction_id
  )
  values (
    transaction.seller_id,
    -transaction.credits_amount,
    seller_balance_after,
    'p2p_escrow_lock',
    'Credits locked for P2P sale',
    'p2p:' || transaction.id::text || ':escrow-lock',
    'p2p',
    jsonb_build_object(
      'transaction_id', transaction.id,
      'listing_id', transaction.listing_id,
      'escrow_id', escrow_id,
      'event', 'escrow_lock'
    ),
    transaction.id
  )
  returning id into ledger_id;

  insert into public.p2p_trade_events (
    transaction_id,
    listing_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    credits_amount,
    credit_transaction_id,
    details
  )
  values (
    transaction.id,
    transaction.listing_id,
    caller_id,
    'started',
    null,
    'pending',
    transaction.credits_amount,
    ledger_id,
    jsonb_build_object(
      'idempotency_key', normalized_key,
      'escrow_id', escrow_id,
      'seller_balance_after', seller_balance_after,
      'expires_at', transaction.expires_at
    )
  );

  return transaction;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Buyer submits payment proof
-- ---------------------------------------------------------------------------

create or replace function public.p2p_submit_payment_proof(
  p_transaction_id uuid,
  p_proof_url text default null,
  p_notes text default null
)
returns public.p2p_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  normalized_proof_ref text := nullif(btrim(p_proof_url), '');
  proof_object_path text;
  expected_path_prefix text;
  normalized_notes text := nullif(btrim(p_notes), '');
  transaction public.p2p_transactions;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;
  if p_transaction_id is null then
    raise exception 'transaction id is required';
  end if;
  if normalized_proof_ref is not null
     and length(normalized_proof_ref) > 4096 then
    raise exception 'proof reference is too long';
  end if;
  if normalized_notes is not null and length(normalized_notes) > 2000 then
    raise exception 'proof notes are too long';
  end if;

  select existing.*
  into transaction
  from public.p2p_transactions existing
  where existing.id = p_transaction_id
  for update;

  if not found then
    raise exception 'transaction not found';
  end if;
  if transaction.buyer_id <> caller_id then
    raise exception 'only the buyer can submit payment proof';
  end if;
  if transaction.status = 'proof_submitted' then
    return transaction;
  end if;
  if transaction.status <> 'pending' then
    raise exception 'payment proof can only be submitted for a pending transaction';
  end if;
  if transaction.expires_at is not null
     and transaction.expires_at <= now() then
    raise exception 'transaction payment window has expired';
  end if;

  proof_object_path := normalized_proof_ref;
  if proof_object_path is not null
     and strpos(proof_object_path, '/p2p-proofs/') > 0 then
    proof_object_path :=
      split_part(proof_object_path, '/p2p-proofs/', 2);
  end if;
  if proof_object_path is not null then
    proof_object_path := split_part(proof_object_path, '?', 1);
    proof_object_path := regexp_replace(proof_object_path, '^/+', '');
    expected_path_prefix := 'proofs/' || transaction.id::text || '/';

    if length(proof_object_path) > 2048
       or left(proof_object_path, length(expected_path_prefix))
          <> expected_path_prefix
       or length(proof_object_path) <= length(expected_path_prefix)
       or proof_object_path like '%/../%'
       or proof_object_path like '../%' then
      raise exception
        'proof must reference proofs/%/... in the private p2p-proofs bucket',
        transaction.id;
    end if;
  end if;

  insert into public.p2p_payment_proofs (
    transaction_id,
    uploaded_by,
    proof_url,
    proof_type,
    notes
  )
  values (
    transaction.id,
    caller_id,
    proof_object_path,
    'payment',
    normalized_notes
  );

  update public.p2p_transactions
  set status = 'proof_submitted',
      proof_url = proof_object_path,
      proof_notes = normalized_notes,
      proof_submitted_at = now(),
      updated_at = now()
  where id = transaction.id
  returning * into transaction;

  insert into public.p2p_trade_events (
    transaction_id,
    listing_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    credits_amount,
    details
  )
  values (
    transaction.id,
    transaction.listing_id,
    caller_id,
    'payment_proof_submitted',
    'pending',
    'proof_submitted',
    transaction.credits_amount,
    jsonb_build_object(
      'has_proof', proof_object_path is not null,
      'proof_object_path', proof_object_path,
      'has_notes', normalized_notes is not null
    )
  );

  return transaction;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Seller releases escrowed credits to the buyer
-- ---------------------------------------------------------------------------

create or replace function public.p2p_release_credits(
  p_transaction_id uuid
)
returns public.p2p_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  transaction public.p2p_transactions;
  escrow public.p2p_escrow;
  buyer_balance_after bigint;
  ledger_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;
  if p_transaction_id is null then
    raise exception 'transaction id is required';
  end if;

  select existing.*
  into transaction
  from public.p2p_transactions existing
  where existing.id = p_transaction_id
  for update;

  if not found then
    raise exception 'transaction not found';
  end if;
  if transaction.seller_id <> caller_id then
    raise exception 'only the seller can release credits';
  end if;
  if transaction.status = 'completed'
     and transaction.settled_to = 'buyer' then
    return transaction;
  end if;
  if transaction.status <> 'proof_submitted' then
    raise exception 'credits can only be released after payment proof is submitted';
  end if;

  select existing.*
  into escrow
  from public.p2p_escrow existing
  where existing.transaction_id = transaction.id
  for update;

  if not found
     or escrow.status <> 'locked'
     or escrow.credits_amount <> transaction.credits_amount
     or escrow.seller_id <> transaction.seller_id
     or escrow.buyer_id <> transaction.buyer_id then
    raise exception 'transaction escrow is not valid or is already settled';
  end if;

  perform 1
  from public.user_credits credits
  where credits.user_id = transaction.seller_id
  for update;

  if not found then
    raise exception 'seller credit balance not found';
  end if;

  insert into public.user_credits (
    user_id,
    balance,
    lifetime_earned
  )
  values (
    transaction.buyer_id,
    transaction.credits_amount,
    transaction.credits_amount
  )
  on conflict (user_id) do update
  set balance = public.user_credits.balance + excluded.balance,
      lifetime_earned =
        public.user_credits.lifetime_earned + excluded.lifetime_earned,
      updated_at = now()
  returning balance into buyer_balance_after;

  update public.user_credits
  set lifetime_spent = lifetime_spent + transaction.credits_amount,
      updated_at = now()
  where user_id = transaction.seller_id;

  insert into public.credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    payment_reference,
    payment_provider,
    metadata,
    p2p_transaction_id
  )
  values (
    transaction.buyer_id,
    transaction.credits_amount,
    buyer_balance_after,
    'p2p_purchase',
    'Credits received from P2P trade',
    'p2p:' || transaction.id::text || ':buyer-credit',
    'p2p',
    jsonb_build_object(
      'transaction_id', transaction.id,
      'listing_id', transaction.listing_id,
      'event', 'seller_release'
    ),
    transaction.id
  )
  returning id into ledger_id;

  update public.p2p_escrow
  set status = 'released',
      released_at = now(),
      settled_by = caller_id,
      settlement_reason = 'seller_release'
  where id = escrow.id;

  update public.p2p_transactions
  set status = 'completed',
      escrow_locked = false,
      completed_at = now(),
      settled_at = now(),
      settled_to = 'buyer',
      settlement_reason = 'seller_release',
      updated_at = now()
  where id = transaction.id
  returning * into transaction;

  update public.p2p_listings
  set status = 'sold',
      reservation_expires_at = null,
      updated_at = now()
  where id = transaction.listing_id
    and reserved_transaction_id = transaction.id;

  insert into public.p2p_user_eligibility (
    user_id,
    can_buy,
    can_sell,
    first_p2p_trade_completed,
    completed_trades
  )
  values (
    transaction.buyer_id,
    true,
    true,
    true,
    1
  )
  on conflict (user_id) do update
  set can_sell = true,
      first_p2p_trade_completed = true,
      completed_trades =
        public.p2p_user_eligibility.completed_trades + 1,
      updated_at = now();

  insert into public.p2p_user_eligibility (
    user_id,
    can_buy,
    can_sell,
    first_p2p_trade_completed,
    completed_trades
  )
  values (
    transaction.seller_id,
    true,
    true,
    true,
    1
  )
  on conflict (user_id) do update
  set can_sell = true,
      first_p2p_trade_completed = true,
      completed_trades =
        public.p2p_user_eligibility.completed_trades + 1,
      updated_at = now();

  insert into public.p2p_trade_events (
    transaction_id,
    listing_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    credits_amount,
    credit_transaction_id,
    details
  )
  values (
    transaction.id,
    transaction.listing_id,
    caller_id,
    'credits_released',
    'proof_submitted',
    'completed',
    transaction.credits_amount,
    ledger_id,
    jsonb_build_object(
      'award_to', 'buyer',
      'buyer_balance_after', buyer_balance_after
    )
  );

  return transaction;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Either party cancels a still-pending transaction
-- ---------------------------------------------------------------------------

create or replace function public.p2p_cancel_transaction(
  p_transaction_id uuid
)
returns public.p2p_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  transaction public.p2p_transactions;
  escrow public.p2p_escrow;
  seller_balance_after bigint;
  ledger_id uuid;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;
  if p_transaction_id is null then
    raise exception 'transaction id is required';
  end if;

  select existing.*
  into transaction
  from public.p2p_transactions existing
  where existing.id = p_transaction_id
  for update;

  if not found then
    raise exception 'transaction not found';
  end if;
  if caller_id not in (transaction.buyer_id, transaction.seller_id) then
    raise exception 'only transaction participants can cancel';
  end if;
  if transaction.status = 'cancelled'
     and transaction.settled_to = 'seller' then
    return transaction;
  end if;
  if transaction.status <> 'pending' then
    raise exception 'only pending transactions can be cancelled';
  end if;

  select existing.*
  into escrow
  from public.p2p_escrow existing
  where existing.transaction_id = transaction.id
  for update;

  if not found
     or escrow.status <> 'locked'
     or escrow.credits_amount <> transaction.credits_amount
     or escrow.seller_id <> transaction.seller_id
     or escrow.buyer_id <> transaction.buyer_id then
    raise exception 'transaction escrow is not valid or is already settled';
  end if;

  perform 1
  from public.user_credits credits
  where credits.user_id = transaction.seller_id
  for update;

  if not found then
    raise exception 'seller credit balance not found';
  end if;

  update public.user_credits
  set balance = balance + transaction.credits_amount,
      updated_at = now()
  where user_id = transaction.seller_id
  returning balance into seller_balance_after;

  insert into public.credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    payment_reference,
    payment_provider,
    metadata,
    p2p_transaction_id
  )
  values (
    transaction.seller_id,
    transaction.credits_amount,
    seller_balance_after,
    'p2p_escrow_refund',
    'P2P transaction cancelled; escrow returned',
    'p2p:' || transaction.id::text || ':seller-refund',
    'p2p',
    jsonb_build_object(
      'transaction_id', transaction.id,
      'listing_id', transaction.listing_id,
      'event', 'cancelled',
      'cancelled_by', caller_id
    ),
    transaction.id
  )
  returning id into ledger_id;

  update public.p2p_escrow
  set status = 'refunded',
      released_at = now(),
      refunded_at = now(),
      settled_by = caller_id,
      settlement_reason = 'cancelled'
  where id = escrow.id;

  update public.p2p_transactions
  set status = 'cancelled',
      escrow_locked = false,
      cancelled_at = now(),
      cancelled_by = caller_id,
      settled_at = now(),
      settled_to = 'seller',
      settlement_reason = 'cancelled',
      updated_at = now()
  where id = transaction.id
  returning * into transaction;

  update public.p2p_listings
  set status = 'active',
      reserved_transaction_id = null,
      reserved_at = null,
      reservation_expires_at = null,
      updated_at = now()
  where id = transaction.listing_id
    and reserved_transaction_id = transaction.id;

  insert into public.p2p_trade_events (
    transaction_id,
    listing_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    credits_amount,
    credit_transaction_id,
    details
  )
  values (
    transaction.id,
    transaction.listing_id,
    caller_id,
    'cancelled',
    'pending',
    'cancelled',
    transaction.credits_amount,
    ledger_id,
    jsonb_build_object(
      'award_to', 'seller',
      'seller_balance_after', seller_balance_after
    )
  );

  return transaction;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Either party opens one dispute after proof submission
-- ---------------------------------------------------------------------------

create or replace function public.p2p_open_dispute(
  p_transaction_id uuid,
  p_reason text
)
returns public.p2p_disputes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  normalized_reason text := nullif(btrim(p_reason), '');
  transaction public.p2p_transactions;
  dispute public.p2p_disputes;
begin
  if caller_id is null then
    raise exception 'authentication is required';
  end if;
  if p_transaction_id is null then
    raise exception 'transaction id is required';
  end if;
  if normalized_reason is null or length(normalized_reason) > 2000 then
    raise exception 'a valid dispute reason is required';
  end if;

  select existing.*
  into transaction
  from public.p2p_transactions existing
  where existing.id = p_transaction_id
  for update;

  if not found then
    raise exception 'transaction not found';
  end if;
  if caller_id not in (transaction.buyer_id, transaction.seller_id) then
    raise exception 'only transaction participants can open a dispute';
  end if;
  if transaction.status = 'disputed' then
    select existing.*
    into dispute
    from public.p2p_disputes existing
    where existing.transaction_id = transaction.id;

    if found then
      return dispute;
    end if;
    raise exception 'transaction dispute state is inconsistent';
  end if;
  if transaction.status <> 'proof_submitted' then
    raise exception 'a dispute can only be opened after payment proof is submitted';
  end if;

  insert into public.p2p_disputes (
    transaction_id,
    initiated_by,
    reason,
    status
  )
  values (
    transaction.id,
    caller_id,
    normalized_reason,
    'open'
  )
  returning * into dispute;

  update public.p2p_transactions
  set status = 'disputed',
      dispute_id = dispute.id,
      updated_at = now()
  where id = transaction.id;

  update public.p2p_escrow
  set dispute_id = dispute.id
  where transaction_id = transaction.id
    and status = 'locked';

  insert into public.p2p_user_eligibility (
    user_id,
    can_buy,
    can_sell,
    dispute_count
  )
  values (
    caller_id,
    true,
    true,
    1
  )
  on conflict (user_id) do update
  set can_sell = true,
      dispute_count = public.p2p_user_eligibility.dispute_count + 1,
      updated_at = now();

  insert into public.p2p_trade_events (
    transaction_id,
    listing_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    credits_amount,
    details
  )
  values (
    transaction.id,
    transaction.listing_id,
    caller_id,
    'dispute_opened',
    'proof_submitted',
    'disputed',
    transaction.credits_amount,
    jsonb_build_object(
      'dispute_id', dispute.id,
      'reason', normalized_reason
    )
  );

  return dispute;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Admin resolves a dispute to buyer or seller exactly once
-- ---------------------------------------------------------------------------

create or replace function public.p2p_resolve_dispute(
  p_transaction_id uuid,
  p_award_to text,
  p_resolution text
)
returns public.p2p_transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reviewer_id uuid := auth.uid();
  normalized_award text := lower(nullif(btrim(p_award_to), ''));
  normalized_resolution text := nullif(btrim(p_resolution), '');
  transaction public.p2p_transactions;
  escrow public.p2p_escrow;
  dispute public.p2p_disputes;
  balance_after bigint;
  ledger_id uuid;
  target_status text;
begin
  if public.can_view_admin_wallet() is not true then
    raise exception 'not authorized';
  end if;
  if reviewer_id is null then
    raise exception 'authentication is required';
  end if;
  if p_transaction_id is null then
    raise exception 'transaction id is required';
  end if;
  if normalized_award not in ('buyer', 'seller') then
    raise exception 'award must be buyer or seller';
  end if;
  if normalized_resolution is null
     or length(normalized_resolution) > 2000 then
    raise exception 'a valid dispute resolution is required';
  end if;

  select existing.*
  into transaction
  from public.p2p_transactions existing
  where existing.id = p_transaction_id
  for update;

  if not found then
    raise exception 'transaction not found';
  end if;
  if transaction.settlement_reason = 'dispute_resolution'
     and transaction.status in ('completed', 'cancelled') then
    if transaction.settled_to <> normalized_award then
      raise exception 'dispute was already resolved to the other party';
    end if;
    return transaction;
  end if;
  if transaction.status <> 'disputed' then
    raise exception 'only disputed transactions can be resolved';
  end if;

  select existing.*
  into dispute
  from public.p2p_disputes existing
  where existing.transaction_id = transaction.id
  for update;

  if not found then
    raise exception 'dispute not found';
  end if;
  if dispute.status not in ('open', 'under_review') then
    raise exception 'dispute is not open';
  end if;

  select existing.*
  into escrow
  from public.p2p_escrow existing
  where existing.transaction_id = transaction.id
  for update;

  if not found
     or escrow.status <> 'locked'
     or escrow.credits_amount <> transaction.credits_amount
     or escrow.seller_id <> transaction.seller_id
     or escrow.buyer_id <> transaction.buyer_id then
    raise exception 'transaction escrow is not valid or is already settled';
  end if;

  if normalized_award = 'buyer' then
    perform 1
    from public.user_credits credits
    where credits.user_id = transaction.seller_id
    for update;

    if not found then
      raise exception 'seller credit balance not found';
    end if;

    insert into public.user_credits (
      user_id,
      balance,
      lifetime_earned
    )
    values (
      transaction.buyer_id,
      transaction.credits_amount,
      transaction.credits_amount
    )
    on conflict (user_id) do update
    set balance = public.user_credits.balance + excluded.balance,
        lifetime_earned =
          public.user_credits.lifetime_earned + excluded.lifetime_earned,
        updated_at = now()
    returning balance into balance_after;

    update public.user_credits
    set lifetime_spent = lifetime_spent + transaction.credits_amount,
        updated_at = now()
    where user_id = transaction.seller_id;

    insert into public.credit_transactions (
      user_id,
      amount,
      balance_after,
      type,
      description,
      payment_reference,
      payment_provider,
      metadata,
      p2p_transaction_id
    )
    values (
      transaction.buyer_id,
      transaction.credits_amount,
      balance_after,
      'p2p_purchase',
      'Credits awarded to buyer by P2P dispute resolution',
      'p2p:' || transaction.id::text || ':buyer-credit',
      'p2p',
      jsonb_build_object(
        'transaction_id', transaction.id,
        'listing_id', transaction.listing_id,
        'dispute_id', dispute.id,
        'event', 'dispute_award_buyer'
      ),
      transaction.id
    )
    returning id into ledger_id;

    update public.p2p_escrow
    set status = 'released',
        released_at = now(),
        settled_by = reviewer_id,
        settlement_reason = 'dispute_resolution'
    where id = escrow.id;

    target_status := 'completed';

    update public.p2p_transactions
    set status = target_status,
        escrow_locked = false,
        completed_at = now(),
        settled_at = now(),
        settled_to = 'buyer',
        settlement_reason = 'dispute_resolution',
        updated_at = now()
    where id = transaction.id
    returning * into transaction;

    update public.p2p_listings
    set status = 'sold',
        reservation_expires_at = null,
        updated_at = now()
    where id = transaction.listing_id
      and reserved_transaction_id = transaction.id;

    insert into public.p2p_user_eligibility (
      user_id,
      can_buy,
      can_sell,
      first_p2p_trade_completed,
      completed_trades
    )
    values (
      transaction.buyer_id,
      true,
      true,
      true,
      1
    )
    on conflict (user_id) do update
    set can_sell = true,
        first_p2p_trade_completed = true,
        completed_trades =
          public.p2p_user_eligibility.completed_trades + 1,
        updated_at = now();

    insert into public.p2p_user_eligibility (
      user_id,
      can_buy,
      can_sell,
      first_p2p_trade_completed,
      completed_trades
    )
    values (
      transaction.seller_id,
      true,
      true,
      true,
      1
    )
    on conflict (user_id) do update
    set can_sell = true,
        first_p2p_trade_completed = true,
        completed_trades =
          public.p2p_user_eligibility.completed_trades + 1,
        updated_at = now();
  else
    perform 1
    from public.user_credits credits
    where credits.user_id = transaction.seller_id
    for update;

    if not found then
      raise exception 'seller credit balance not found';
    end if;

    update public.user_credits
    set balance = balance + transaction.credits_amount,
        updated_at = now()
    where user_id = transaction.seller_id
    returning balance into balance_after;

    insert into public.credit_transactions (
      user_id,
      amount,
      balance_after,
      type,
      description,
      payment_reference,
      payment_provider,
      metadata,
      p2p_transaction_id
    )
    values (
      transaction.seller_id,
      transaction.credits_amount,
      balance_after,
      'p2p_escrow_refund',
      'Credits returned to seller by P2P dispute resolution',
      'p2p:' || transaction.id::text || ':seller-refund',
      'p2p',
      jsonb_build_object(
        'transaction_id', transaction.id,
        'listing_id', transaction.listing_id,
        'dispute_id', dispute.id,
        'event', 'dispute_award_seller'
      ),
      transaction.id
    )
    returning id into ledger_id;

    update public.p2p_escrow
    set status = 'refunded',
        released_at = now(),
        refunded_at = now(),
        settled_by = reviewer_id,
        settlement_reason = 'dispute_resolution'
    where id = escrow.id;

    target_status := 'cancelled';

    update public.p2p_transactions
    set status = target_status,
        escrow_locked = false,
        cancelled_at = now(),
        cancelled_by = reviewer_id,
        settled_at = now(),
        settled_to = 'seller',
        settlement_reason = 'dispute_resolution',
        updated_at = now()
    where id = transaction.id
    returning * into transaction;

    update public.p2p_listings
    set status = 'active',
        reserved_transaction_id = null,
        reserved_at = null,
        reservation_expires_at = null,
        updated_at = now()
    where id = transaction.listing_id
      and reserved_transaction_id = transaction.id;
  end if;

  update public.p2p_disputes
  set status = 'resolved',
      award_to = normalized_award,
      resolution = normalized_resolution,
      moderator_id = reviewer_id,
      resolved_at = now(),
      updated_at = now()
  where id = dispute.id;

  insert into public.p2p_trade_events (
    transaction_id,
    listing_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    credits_amount,
    credit_transaction_id,
    details
  )
  values (
    transaction.id,
    transaction.listing_id,
    reviewer_id,
    'dispute_resolved',
    'disputed',
    target_status,
    transaction.credits_amount,
    ledger_id,
    jsonb_build_object(
      'dispute_id', dispute.id,
      'award_to', normalized_award,
      'resolution', normalized_resolution,
      'balance_after', balance_after
    )
  );

  return transaction;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. Explicit execution grants
-- ---------------------------------------------------------------------------

revoke all on function public.prevent_p2p_trade_event_mutation()
  from public, anon, authenticated, service_role;

revoke all on function public.p2p_start_transaction(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.p2p_start_transaction(uuid, text)
  to authenticated;

revoke all on function public.p2p_submit_payment_proof(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.p2p_submit_payment_proof(uuid, text, text)
  to authenticated;

revoke all on function public.p2p_release_credits(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.p2p_release_credits(uuid)
  to authenticated;

revoke all on function public.p2p_cancel_transaction(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.p2p_cancel_transaction(uuid)
  to authenticated;

revoke all on function public.p2p_open_dispute(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.p2p_open_dispute(uuid, text)
  to authenticated;

revoke all on function public.p2p_resolve_dispute(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.p2p_resolve_dispute(uuid, text, text)
  to authenticated;

notify pgrst, 'reload schema';
