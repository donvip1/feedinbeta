-- Live-gift server-authoritative settlement + RLS lockdown.
--
-- BEFORE: clients inserted live_stream_gifts / live_space_gifts rows directly
-- with a CLIENT-SUPPLIED credit_value and receiver_id (RLS only checked
-- sender_id), and no credits ever moved — so gift values, recipients, and
-- leaderboards were forgeable. AFTER: live gifts behave like post/chat gifts —
-- the cost is server-owned, the sender is debited, the recipient (the room host)
-- earns recipient_percent, the platform keeps the remainder, all atomic and
-- idempotent. Direct client INSERT is revoked; the only write path is the
-- SECURITY DEFINER RPCs below.

-- 1) Server-owned live-gift price catalog (clients can read, never write).
create table if not exists public.live_gift_types (
  gift_type text primary key,
  label text not null,
  credit_cost integer not null check (credit_cost > 0),
  recipient_percent integer not null default 80
    check (recipient_percent between 0 and 100),
  is_active boolean not null default true,
  display_order integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.live_gift_types (gift_type, label, credit_cost, display_order) values
  ('rose', 'Rose', 10, 1),
  ('coffee', 'Coffee', 20, 2),
  ('heart', 'Love', 50, 3),
  ('diamond', 'Diamond', 100, 4),
  ('crown', 'Crown', 250, 5),
  ('rocket', 'Rocket', 500, 6),
  ('castle', 'Castle', 1000, 7),
  ('universe', 'Universe', 2500, 8)
on conflict (gift_type) do update set
  label = excluded.label,
  credit_cost = excluded.credit_cost,
  display_order = excluded.display_order,
  updated_at = now();

alter table public.live_gift_types enable row level security;
drop policy if exists "Live gift types are public" on public.live_gift_types;
create policy "Live gift types are public"
  on public.live_gift_types for select using (is_active);

-- 2) Settlement + idempotency columns on the two gift ledgers.
alter table public.live_stream_gifts
  add column if not exists idempotency_key uuid,
  add column if not exists recipient_credit_value integer,
  add column if not exists platform_fee_credits integer,
  add column if not exists sender_balance_after bigint,
  add column if not exists recipient_balance_after bigint;
alter table public.live_space_gifts
  add column if not exists idempotency_key uuid,
  add column if not exists recipient_credit_value integer,
  add column if not exists platform_fee_credits integer,
  add column if not exists sender_balance_after bigint,
  add column if not exists recipient_balance_after bigint;

create unique index if not exists live_stream_gifts_sender_key_idx
  on public.live_stream_gifts (sender_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists live_space_gifts_sender_key_idx
  on public.live_space_gifts (sender_id, idempotency_key)
  where idempotency_key is not null;

-- 3) Revoke direct client writes. The definer RPCs (owned by postgres) still
--    insert, bypassing RLS + table privileges.
drop policy if exists "Users can send stream gifts as self" on public.live_stream_gifts;
drop policy if exists "Users can send space gifts as self" on public.live_space_gifts;
revoke insert, update, delete on public.live_stream_gifts from authenticated, anon;
revoke insert, update, delete on public.live_space_gifts from authenticated, anon;

-- 4) Stream-gift settlement RPC.
create or replace function public.send_live_stream_gift(
  p_gift_type text,
  p_stream_id uuid,
  p_receiver_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  gift public.live_gift_types;
  stream public.live_streams;
  existing public.live_stream_gifts;
  recipient uuid;
  sender_balance bigint;
  sender_balance_after bigint;
  recipient_balance_after bigint;
  recipient_value integer;
  platform_fee integer;
  gift_record_id uuid := gen_random_uuid();
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_gift_type is null or p_stream_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'GIFT_ARGUMENT_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor::text || ':' || p_idempotency_key::text, 0)
  );

  select * into existing
  from public.live_stream_gifts g
  where g.sender_id = actor and g.idempotency_key = p_idempotency_key;
  if existing.id is not null then
    return jsonb_build_object(
      'gift_record_id', existing.id,
      'balance_after', coalesce(existing.sender_balance_after, 0),
      'recipient_balance_after', coalesce(existing.recipient_balance_after, 0),
      'recipient_credit_value', existing.recipient_credit_value,
      'platform_fee_credits', existing.platform_fee_credits,
      'credit_value', existing.credit_value
    );
  end if;

  select * into gift
  from public.live_gift_types t
  where t.gift_type = p_gift_type and t.is_active;
  if gift.gift_type is null then
    raise exception using errcode = '22023', message = 'GIFT_NOT_AVAILABLE';
  end if;

  select * into stream
  from public.live_streams s
  where s.id = p_stream_id
  for share;
  if stream.id is null then
    raise exception using errcode = '42501', message = 'STREAM_NOT_FOUND';
  end if;

  -- Recipient is always the stream host; a mismatched client value is rejected.
  recipient := stream.user_id;
  if p_receiver_id is not null and p_receiver_id <> recipient then
    raise exception using errcode = '22023', message = 'INVALID_RECIPIENT';
  end if;
  if recipient = actor then
    raise exception using errcode = '22023', message = 'SELF_GIFT_NOT_ALLOWED';
  end if;

  insert into public.user_credits(user_id, balance, lifetime_earned, lifetime_spent)
  values (actor, 0, 0, 0)
  on conflict (user_id) do nothing;
  select balance into sender_balance
  from public.user_credits where user_id = actor for update;
  if coalesce(sender_balance, 0) < gift.credit_cost then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  recipient_value := floor(
    gift.credit_cost::numeric * gift.recipient_percent::numeric / 100
  )::integer;
  platform_fee := gift.credit_cost - recipient_value;
  sender_balance_after := sender_balance - gift.credit_cost;

  update public.user_credits
  set balance = sender_balance_after,
      lifetime_spent = lifetime_spent + gift.credit_cost,
      updated_at = now()
  where user_id = actor;

  insert into public.credit_transactions(
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    actor, -gift.credit_cost, sender_balance_after, 'live_stream_gift_sent',
    'Sent ' || gift.label || ' in a live stream', p_idempotency_key::text,
    jsonb_build_object('stream_id', p_stream_id, 'recipient_id', recipient,
      'gift_record_id', gift_record_id, 'gift_type', gift.gift_type)
  );

  insert into public.user_credits(user_id, balance, lifetime_earned, lifetime_spent)
  values (recipient, recipient_value, recipient_value, 0)
  on conflict (user_id) do update set
    balance = public.user_credits.balance + excluded.balance,
    lifetime_earned = public.user_credits.lifetime_earned + excluded.lifetime_earned,
    updated_at = now()
  returning balance into recipient_balance_after;

  insert into public.credit_transactions(
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    recipient, recipient_value, recipient_balance_after, 'live_stream_gift_received',
    'Received ' || gift.label || ' in a live stream', p_idempotency_key::text,
    jsonb_build_object('stream_id', p_stream_id, 'sender_id', actor,
      'gift_record_id', gift_record_id, 'gift_type', gift.gift_type)
  );

  insert into public.platform_wallet(id, balance)
  values (1, platform_fee)
  on conflict (id) do update set
    balance = public.platform_wallet.balance + excluded.balance,
    updated_at = now();

  insert into public.live_stream_gifts(
    id, stream_id, sender_id, receiver_id, gift_type, credit_value,
    idempotency_key, recipient_credit_value, platform_fee_credits,
    sender_balance_after, recipient_balance_after
  ) values (
    gift_record_id, p_stream_id, actor, recipient, gift.gift_type, gift.credit_cost,
    p_idempotency_key, recipient_value, platform_fee,
    sender_balance_after, recipient_balance_after
  );

  return jsonb_build_object(
    'gift_record_id', gift_record_id,
    'balance_after', sender_balance_after,
    'recipient_balance_after', recipient_balance_after,
    'recipient_credit_value', recipient_value,
    'platform_fee_credits', platform_fee,
    'credit_value', gift.credit_cost
  );
end;
$$;

-- 5) Space-gift settlement RPC (identical shape, keyed on live_spaces).
create or replace function public.send_live_space_gift(
  p_gift_type text,
  p_space_id uuid,
  p_receiver_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  gift public.live_gift_types;
  space public.live_spaces;
  existing public.live_space_gifts;
  recipient uuid;
  sender_balance bigint;
  sender_balance_after bigint;
  recipient_balance_after bigint;
  recipient_value integer;
  platform_fee integer;
  gift_record_id uuid := gen_random_uuid();
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_gift_type is null or p_space_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'GIFT_ARGUMENT_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor::text || ':' || p_idempotency_key::text, 0)
  );

  select * into existing
  from public.live_space_gifts g
  where g.sender_id = actor and g.idempotency_key = p_idempotency_key;
  if existing.id is not null then
    return jsonb_build_object(
      'gift_record_id', existing.id,
      'balance_after', coalesce(existing.sender_balance_after, 0),
      'recipient_balance_after', coalesce(existing.recipient_balance_after, 0),
      'recipient_credit_value', existing.recipient_credit_value,
      'platform_fee_credits', existing.platform_fee_credits,
      'credit_value', existing.credit_value
    );
  end if;

  select * into gift
  from public.live_gift_types t
  where t.gift_type = p_gift_type and t.is_active;
  if gift.gift_type is null then
    raise exception using errcode = '22023', message = 'GIFT_NOT_AVAILABLE';
  end if;

  select * into space
  from public.live_spaces s
  where s.id = p_space_id
  for share;
  if space.id is null then
    raise exception using errcode = '42501', message = 'SPACE_NOT_FOUND';
  end if;

  recipient := space.user_id;
  if p_receiver_id is not null and p_receiver_id <> recipient then
    raise exception using errcode = '22023', message = 'INVALID_RECIPIENT';
  end if;
  if recipient = actor then
    raise exception using errcode = '22023', message = 'SELF_GIFT_NOT_ALLOWED';
  end if;

  insert into public.user_credits(user_id, balance, lifetime_earned, lifetime_spent)
  values (actor, 0, 0, 0)
  on conflict (user_id) do nothing;
  select balance into sender_balance
  from public.user_credits where user_id = actor for update;
  if coalesce(sender_balance, 0) < gift.credit_cost then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  recipient_value := floor(
    gift.credit_cost::numeric * gift.recipient_percent::numeric / 100
  )::integer;
  platform_fee := gift.credit_cost - recipient_value;
  sender_balance_after := sender_balance - gift.credit_cost;

  update public.user_credits
  set balance = sender_balance_after,
      lifetime_spent = lifetime_spent + gift.credit_cost,
      updated_at = now()
  where user_id = actor;

  insert into public.credit_transactions(
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    actor, -gift.credit_cost, sender_balance_after, 'live_space_gift_sent',
    'Sent ' || gift.label || ' in an audio space', p_idempotency_key::text,
    jsonb_build_object('space_id', p_space_id, 'recipient_id', recipient,
      'gift_record_id', gift_record_id, 'gift_type', gift.gift_type)
  );

  insert into public.user_credits(user_id, balance, lifetime_earned, lifetime_spent)
  values (recipient, recipient_value, recipient_value, 0)
  on conflict (user_id) do update set
    balance = public.user_credits.balance + excluded.balance,
    lifetime_earned = public.user_credits.lifetime_earned + excluded.lifetime_earned,
    updated_at = now()
  returning balance into recipient_balance_after;

  insert into public.credit_transactions(
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    recipient, recipient_value, recipient_balance_after, 'live_space_gift_received',
    'Received ' || gift.label || ' in an audio space', p_idempotency_key::text,
    jsonb_build_object('space_id', p_space_id, 'sender_id', actor,
      'gift_record_id', gift_record_id, 'gift_type', gift.gift_type)
  );

  insert into public.platform_wallet(id, balance)
  values (1, platform_fee)
  on conflict (id) do update set
    balance = public.platform_wallet.balance + excluded.balance,
    updated_at = now();

  insert into public.live_space_gifts(
    id, space_id, sender_id, receiver_id, gift_type, credit_value,
    idempotency_key, recipient_credit_value, platform_fee_credits,
    sender_balance_after, recipient_balance_after
  ) values (
    gift_record_id, p_space_id, actor, recipient, gift.gift_type, gift.credit_cost,
    p_idempotency_key, recipient_value, platform_fee,
    sender_balance_after, recipient_balance_after
  );

  return jsonb_build_object(
    'gift_record_id', gift_record_id,
    'balance_after', sender_balance_after,
    'recipient_balance_after', recipient_balance_after,
    'recipient_credit_value', recipient_value,
    'platform_fee_credits', platform_fee,
    'credit_value', gift.credit_cost
  );
end;
$$;

revoke all on function public.send_live_stream_gift(text, uuid, uuid, uuid) from public, anon;
revoke all on function public.send_live_space_gift(text, uuid, uuid, uuid) from public, anon;
grant execute on function public.send_live_stream_gift(text, uuid, uuid, uuid) to authenticated;
grant execute on function public.send_live_space_gift(text, uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
