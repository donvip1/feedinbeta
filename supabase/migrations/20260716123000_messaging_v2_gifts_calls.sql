-- FEEDIN Messaging V2: atomic chat gifting and canonical LiveKit call cards.

-- ---------------------------------------------------------------------------
-- Server-owned gift catalog and financial records
-- ---------------------------------------------------------------------------

create table if not exists public.gift_catalog (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  asset_key text not null,
  credit_cost integer not null check (credit_cost > 0),
  recipient_percent integer not null default 90
    check (recipient_percent between 0 and 100),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.gift_catalog (
  key, name, asset_key, credit_cost, recipient_percent, display_order
)
values
  ('heart', 'Heart', 'heart', 5, 90, 10),
  ('star', 'Star', 'star', 10, 90, 20),
  ('fire', 'Fire', 'fire', 15, 90, 30),
  ('clap', 'Clap', 'clap', 20, 90, 40),
  ('rose', 'Rose', 'rose', 25, 90, 50),
  ('rocket', 'Rocket', 'rocket', 50, 90, 60),
  ('gift', 'Gift Box', 'gift', 75, 90, 70),
  ('diamond', 'Diamond', 'diamond', 100, 90, 80),
  ('crown', 'Crown', 'crown', 200, 90, 90),
  ('money', 'Money Bag', 'money', 500, 90, 100)
on conflict (key) do update set
  name = excluded.name,
  asset_key = excluded.asset_key,
  credit_cost = excluded.credit_cost,
  recipient_percent = excluded.recipient_percent,
  display_order = excluded.display_order,
  updated_at = now();

create table if not exists public.chat_gifts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  message_id uuid not null unique references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  catalog_item_id uuid not null references public.gift_catalog(id) on delete restrict,
  gift_key text not null,
  gift_name text not null,
  asset_key text not null,
  credit_cost integer not null check (credit_cost > 0),
  recipient_credit_value integer not null check (recipient_credit_value >= 0),
  platform_fee_credits integer not null check (platform_fee_credits >= 0),
  state text not null default 'sent'
    check (state in ('sent', 'converted', 'refunded')),
  sender_transaction_id uuid references public.credit_transactions(id) on delete set null,
  recipient_transaction_id uuid references public.credit_transactions(id) on delete set null,
  converted_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists chat_gifts_conversation_idx
  on public.chat_gifts(conversation_id, created_at desc);
create index if not exists chat_gifts_recipient_state_idx
  on public.chat_gifts(recipient_id, state, created_at desc);

alter table public.gift_catalog enable row level security;
alter table public.chat_gifts enable row level security;

drop policy if exists "Authenticated users can read active gifts" on public.gift_catalog;
create policy "Authenticated users can read active gifts"
on public.gift_catalog for select to authenticated
using (is_active);

drop policy if exists "Gift participants can read chat gifts" on public.chat_gifts;
create policy "Gift participants can read chat gifts"
on public.chat_gifts for select to authenticated
using (
  auth.uid() in (sender_id, recipient_id)
  or public.is_conversation_participant(conversation_id)
);

create or replace function public.send_chat_gift(
  p_conversation_id uuid,
  p_catalog_key text,
  p_message_id uuid,
  p_idempotency_key uuid,
  p_recipient_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_type text;
  target_owner uuid;
  recipient uuid;
  catalog public.gift_catalog;
  existing public.chat_gifts;
  gift_id uuid := gen_random_uuid();
  current_balance bigint;
  next_balance bigint;
  recipient_value integer;
  platform_fee integer;
  sender_ledger uuid;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_message_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  select * into existing
  from public.chat_gifts gift
  where gift.idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.sender_id <> actor
       or existing.conversation_id <> p_conversation_id
       or existing.message_id <> p_message_id then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_CONFLICT';
    end if;
    return public.get_message_envelope(existing.message_id);
  end if;

  select c.type, c.owner_id into target_type, target_owner
  from public.conversations c where c.id = p_conversation_id
  for update;

  recipient := p_recipient_id;
  if recipient is null and target_type = 'channel' then recipient := target_owner; end if;
  if recipient is null and target_type = 'dm' then
    select cp.user_id into recipient
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id <> actor
      and cp.state = 'active'
    limit 1;
  end if;
  if recipient is null or recipient = actor then
    raise exception using errcode = '22023', message = 'INVALID_GIFT_RECIPIENT';
  end if;
  if not exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = recipient
      and cp.state = 'active'
  ) then
    raise exception using errcode = '42501', message = 'RECIPIENT_NOT_IN_CONVERSATION';
  end if;

  select * into catalog
  from public.gift_catalog item
  where item.key = lower(btrim(p_catalog_key)) and item.is_active
  for share;
  if catalog.id is null then
    raise exception using errcode = '22023', message = 'GIFT_NOT_AVAILABLE';
  end if;

  select credits.balance into current_balance
  from public.user_credits credits
  where credits.user_id = actor
  for update;
  current_balance := coalesce(current_balance, 0);
  if current_balance < catalog.credit_cost then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  recipient_value := floor(
    catalog.credit_cost::numeric * catalog.recipient_percent::numeric / 100
  )::integer;
  platform_fee := catalog.credit_cost - recipient_value;
  next_balance := current_balance - catalog.credit_cost;

  update public.user_credits
  set balance = next_balance,
      lifetime_spent = lifetime_spent + catalog.credit_cost,
      updated_at = now()
  where user_id = actor;

  insert into public.credit_transactions (
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    actor,
    -catalog.credit_cost,
    next_balance,
    'chat_gift_sent',
    'Sent ' || catalog.name || ' gift',
    p_idempotency_key::text,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'recipient_id', recipient,
      'catalog_key', catalog.key,
      'platform_fee_credits', platform_fee
    )
  ) returning id into sender_ledger;

  -- The platform fee returns to the project pool; recipient value remains in
  -- the gift until conversion.
  update public.platform_wallet
  set balance = balance + platform_fee,
      updated_at = now()
  where id = 1;

  insert into public.messages (
    id,
    conversation_id,
    sender_id,
    content,
    message_type,
    content_type,
    payload,
    status,
    metadata
  ) values (
    p_message_id,
    p_conversation_id,
    actor,
    'Sent a ' || catalog.name || ' gift',
    'gift',
    'gift',
    jsonb_build_object(
      'gift_id', gift_id,
      'catalog_item_id', catalog.id,
      'name', catalog.name,
      'asset_key', catalog.asset_key,
      'credit_cost', catalog.credit_cost,
      'recipient_credit_value', recipient_value,
      'platform_fee_credits', platform_fee,
      'recipient_id', recipient,
      'state', 'sent'
    ),
    'sent',
    jsonb_build_object('schema_version', 1)
  );

  insert into public.chat_gifts (
    id,
    idempotency_key,
    message_id,
    conversation_id,
    sender_id,
    recipient_id,
    catalog_item_id,
    gift_key,
    gift_name,
    asset_key,
    credit_cost,
    recipient_credit_value,
    platform_fee_credits,
    sender_transaction_id
  ) values (
    gift_id,
    p_idempotency_key,
    p_message_id,
    p_conversation_id,
    actor,
    recipient,
    catalog.id,
    catalog.key,
    catalog.name,
    catalog.asset_key,
    catalog.credit_cost,
    recipient_value,
    platform_fee,
    sender_ledger
  );

  insert into public.gift_analytics (
    id, sender_id, receiver_id, gift_type, credit_value, source_type, source_id
  ) values (
    gift_id,
    actor,
    recipient,
    catalog.key,
    catalog.credit_cost,
    'conversation',
    p_conversation_id
  ) on conflict (id) do nothing;

  return public.get_message_envelope(p_message_id);
end;
$$;

create or replace function public.convert_chat_gift(p_gift_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  gift public.chat_gifts;
  next_balance bigint;
  ledger_id uuid;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select * into gift
  from public.chat_gifts existing
  where existing.id = p_gift_id
  for update;
  if gift.id is null or gift.recipient_id <> actor then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if gift.state = 'converted' then
    select balance into next_balance
    from public.user_credits where user_id = actor;
    return jsonb_build_object(
      'gift_id', gift.id,
      'state', gift.state,
      'credits_added', gift.recipient_credit_value,
      'balance_after', next_balance
    );
  end if;
  if gift.state <> 'sent' then
    raise exception using errcode = 'P0001', message = 'GIFT_NOT_CONVERTIBLE';
  end if;

  insert into public.user_credits (user_id, balance, lifetime_earned)
  values (actor, gift.recipient_credit_value, gift.recipient_credit_value)
  on conflict (user_id) do update set
    balance = public.user_credits.balance + excluded.balance,
    lifetime_earned = public.user_credits.lifetime_earned + excluded.lifetime_earned,
    updated_at = now()
  returning balance into next_balance;

  insert into public.credit_transactions (
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    actor,
    gift.recipient_credit_value,
    next_balance,
    'chat_gift_converted',
    'Converted ' || gift.gift_name || ' gift',
    gift.id::text,
    jsonb_build_object('conversation_id', gift.conversation_id, 'gift_id', gift.id)
  ) returning id into ledger_id;

  update public.chat_gifts
  set state = 'converted',
      converted_at = now(),
      recipient_transaction_id = ledger_id
  where id = gift.id;

  update public.messages
  set payload = jsonb_set(payload, '{state}', '"converted"'::jsonb, true)
  where id = gift.message_id;

  return jsonb_build_object(
    'gift_id', gift.id,
    'state', 'converted',
    'credits_added', gift.recipient_credit_value,
    'balance_after', next_balance
  );
end;
$$;

-- Gift state changes invalidate only the linked canonical message.
drop trigger if exists touch_message_from_chat_gift on public.chat_gifts;
create trigger touch_message_from_chat_gift
after insert or update or delete on public.chat_gifts
for each row execute function public.touch_parent_message();

-- ---------------------------------------------------------------------------
-- Canonical conversation calls and LiveKit role authorization
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_calls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  host_id uuid not null references public.profiles(id) on delete restrict,
  call_kind text not null check (call_kind in ('audio', 'video')),
  room_name text not null unique,
  state text not null default 'active'
    check (state in ('scheduled', 'ringing', 'active', 'ended', 'cancelled')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_calls_conversation_idx
  on public.conversation_calls(conversation_id, created_at desc);
create unique index if not exists conversation_calls_one_active_uidx
  on public.conversation_calls(conversation_id)
  where state in ('scheduled', 'ringing', 'active');

alter table public.conversation_calls enable row level security;

drop policy if exists "Participants can read conversation calls"
  on public.conversation_calls;
create policy "Participants can read conversation calls"
on public.conversation_calls for select to authenticated
using (public.is_conversation_participant(conversation_id));

create or replace function public.can_start_conversation_call(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.conversation_participants cp
      on cp.conversation_id = c.id
     and cp.user_id = p_user_id
     and cp.state = 'active'
    where c.id = p_conversation_id
      and case c.type
        when 'dm' then true
        when 'group' then
          cp.role in ('owner', 'admin')
          or coalesce((c.settings ->> 'members_can_start_calls')::boolean, false)
        when 'channel' then cp.role in ('owner', 'admin')
        else coalesce((c.settings ->> 'members_can_start_calls')::boolean, false)
      end
  );
$$;

create or replace function public.start_conversation_call(
  p_conversation_id uuid,
  p_call_kind text,
  p_message_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  call_id uuid := gen_random_uuid();
  room_name text := 'conversation-call-' || call_id::text;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_call_kind not in ('audio', 'video') then
    raise exception using errcode = '22023', message = 'INVALID_CALL_KIND';
  end if;
  if not public.can_start_conversation_call(p_conversation_id, actor) then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if exists (
    select 1 from public.conversation_calls active_call
    where active_call.conversation_id = p_conversation_id
      and active_call.state in ('scheduled', 'ringing', 'active')
  ) then
    raise exception using errcode = 'P0001', message = 'CALL_ALREADY_ACTIVE';
  end if;

  insert into public.messages (
    id,
    conversation_id,
    sender_id,
    content,
    message_type,
    content_type,
    payload,
    status,
    metadata
  ) values (
    p_message_id,
    p_conversation_id,
    actor,
    case p_call_kind when 'video' then 'Started a video call' else 'Started an audio call' end,
    'call',
    'call',
    jsonb_build_object(
      'call_id', call_id,
      'call_kind', p_call_kind,
      'room_name', room_name,
      'state', 'active',
      'host_id', actor,
      'started_at', now(),
      'ended_at', null,
      'participant_count', 1,
      'joinable', true
    ),
    'sent',
    jsonb_build_object('schema_version', 1)
  );

  insert into public.conversation_calls (
    id,
    message_id,
    conversation_id,
    host_id,
    call_kind,
    room_name,
    state,
    started_at
  ) values (
    call_id,
    p_message_id,
    p_conversation_id,
    actor,
    p_call_kind,
    room_name,
    'active',
    now()
  );

  return public.get_message_envelope(p_message_id);
end;
$$;

create or replace function public.end_conversation_call(p_call_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target public.conversation_calls;
begin
  select * into target
  from public.conversation_calls call
  where call.id = p_call_id
  for update;
  if target.id is null then
    raise exception using errcode = 'P0001', message = 'CALL_NOT_FOUND';
  end if;
  if actor <> target.host_id
     and public.conversation_role(target.conversation_id, actor) not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  update public.conversation_calls
  set state = 'ended', ended_at = now(), updated_at = now()
  where id = target.id;

  update public.messages
  set payload = payload || jsonb_build_object(
    'state', 'ended',
    'ended_at', now(),
    'joinable', false
  )
  where id = target.message_id;

  return public.get_message_envelope(target.message_id);
end;
$$;

drop trigger if exists touch_message_from_conversation_call on public.conversation_calls;
create trigger touch_message_from_conversation_call
after insert or update or delete on public.conversation_calls
for each row execute function public.touch_parent_message();

revoke all on function public.send_chat_gift(uuid, text, uuid, uuid, uuid)
  from public, anon;
revoke all on function public.convert_chat_gift(uuid) from public, anon;
revoke all on function public.can_start_conversation_call(uuid, uuid) from public, anon;
revoke all on function public.start_conversation_call(uuid, text, uuid) from public, anon;
revoke all on function public.end_conversation_call(uuid) from public, anon;

grant execute on function public.send_chat_gift(uuid, text, uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function public.convert_chat_gift(uuid)
  to authenticated, service_role;
grant execute on function public.can_start_conversation_call(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.start_conversation_call(uuid, text, uuid)
  to authenticated, service_role;
grant execute on function public.end_conversation_call(uuid)
  to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['chat_gifts', 'conversation_calls'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = table_name
       ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
