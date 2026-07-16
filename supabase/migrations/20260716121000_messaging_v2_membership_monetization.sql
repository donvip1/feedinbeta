-- FEEDIN Messaging V2: premium group creation, paid membership, approvals,
-- invitations, and canonical conversation RBAC.

-- ---------------------------------------------------------------------------
-- Authoritative premium status and server-owned pricing
-- ---------------------------------------------------------------------------

create or replace function public.active_premium_subscription_id(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select us.id
  from public.user_subscriptions us
  join public.subscription_tiers tier on tier.id = us.tier_id
  where us.user_id = p_user_id
    and us.status = 'active'
    and us.current_period_start is not null
    and us.current_period_start <= p_at
    and us.current_period_end is not null
    and us.current_period_end > p_at
    and tier.is_active
  order by us.current_period_end desc
  limit 1;
$$;

create or replace function public.has_active_premium(
  p_user_id uuid,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.active_premium_subscription_id(p_user_id, p_at) is not null;
$$;

create table if not exists public.monetization_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.monetization_settings (key, value, description)
values (
  'group_member_add_cost',
  '{"credits":50}'::jsonb,
  'Credits charged for a direct group addition or an approved discovered join.'
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

alter table public.monetization_settings enable row level security;

drop policy if exists "Authenticated users can read monetization settings"
  on public.monetization_settings;
create policy "Authenticated users can read monetization settings"
on public.monetization_settings for select to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- Membership requests, explicit invitations, and auditable charges
-- ---------------------------------------------------------------------------

create table if not exists public.conversation_join_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'discovery'
    check (source in ('discovery', 'public_link')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  estimated_cost integer not null default 50 check (estimated_cost >= 0),
  charge_idempotency_key uuid not null default gen_random_uuid(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, requester_id),
  unique (charge_idempotency_key)
);

create table if not exists public.conversation_invitations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member'
    check (role in ('admin', 'moderator', 'member', 'subscriber')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  token uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, invitee_id),
  unique (token)
);

create table if not exists public.conversation_member_charges (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  payer_id uuid not null references public.profiles(id) on delete restrict,
  member_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (reason in ('direct_add', 'discovered_join')),
  base_cost integer not null check (base_cost >= 0),
  charged_credits integer not null check (charged_credits >= 0),
  waiver_reason text check (waiver_reason in ('active_premium')),
  subscription_id uuid references public.user_subscriptions(id) on delete set null,
  balance_before bigint,
  balance_after bigint,
  credit_transaction_id uuid references public.credit_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (charged_credits = 0 and waiver_reason = 'active_premium' and subscription_id is not null)
    or (charged_credits = base_cost and waiver_reason is null)
  )
);

create index if not exists conversation_join_requests_admin_idx
  on public.conversation_join_requests(conversation_id, status, created_at);
create index if not exists conversation_invitations_invitee_idx
  on public.conversation_invitations(invitee_id, status, created_at desc);
create index if not exists conversation_member_charges_conversation_idx
  on public.conversation_member_charges(conversation_id, created_at desc);
create index if not exists conversation_member_charges_payer_idx
  on public.conversation_member_charges(payer_id, created_at desc);

alter table public.conversation_join_requests enable row level security;
alter table public.conversation_invitations enable row level security;
alter table public.conversation_member_charges enable row level security;

drop policy if exists "Requesters and admins can read join requests"
  on public.conversation_join_requests;
create policy "Requesters and admins can read join requests"
on public.conversation_join_requests for select to authenticated
using (
  auth.uid() = requester_id
  or public.conversation_role(conversation_id) in ('owner', 'admin')
);

drop policy if exists "Invitation participants can read invitations"
  on public.conversation_invitations;
create policy "Invitation participants can read invitations"
on public.conversation_invitations for select to authenticated
using (
  auth.uid() in (inviter_id, invitee_id)
  or public.conversation_role(conversation_id) in ('owner', 'admin')
);

drop policy if exists "Charge participants can read membership charges"
  on public.conversation_member_charges;
create policy "Charge participants can read membership charges"
on public.conversation_member_charges for select to authenticated
using (
  auth.uid() in (actor_id, payer_id, member_id)
  or public.conversation_role(conversation_id) in ('owner', 'admin')
);

-- These tables are mutated only by the transactional RPCs below.

drop trigger if exists set_conversation_join_requests_updated_at
  on public.conversation_join_requests;
create trigger set_conversation_join_requests_updated_at
before update on public.conversation_join_requests
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Internal atomic charge helper
-- ---------------------------------------------------------------------------

create or replace function public.charge_group_member_addition(
  p_idempotency_key uuid,
  p_conversation_id uuid,
  p_actor_id uuid,
  p_payer_id uuid,
  p_member_id uuid,
  p_reason text
)
returns public.conversation_member_charges
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.conversation_member_charges;
  result public.conversation_member_charges;
  premium_subscription uuid;
  configured_cost integer;
  current_balance bigint;
  next_balance bigint;
  ledger_id uuid;
begin
  select * into existing
  from public.conversation_member_charges charge
  where charge.idempotency_key = p_idempotency_key;
  if existing.id is not null then return existing; end if;

  if p_reason not in ('direct_add', 'discovered_join') then
    raise exception using errcode = '22023', message = 'INVALID_CHARGE_REASON';
  end if;

  select greatest(0, coalesce((setting.value ->> 'credits')::integer, 50))
  into configured_cost
  from public.monetization_settings setting
  where setting.key = 'group_member_add_cost';
  configured_cost := coalesce(configured_cost, 50);

  premium_subscription := public.active_premium_subscription_id(p_payer_id, now());

  if premium_subscription is not null then
    insert into public.conversation_member_charges (
      idempotency_key,
      conversation_id,
      actor_id,
      payer_id,
      member_id,
      reason,
      base_cost,
      charged_credits,
      waiver_reason,
      subscription_id
    ) values (
      p_idempotency_key,
      p_conversation_id,
      p_actor_id,
      p_payer_id,
      p_member_id,
      p_reason,
      configured_cost,
      0,
      'active_premium',
      premium_subscription
    ) returning * into result;
    return result;
  end if;

  select credits.balance into current_balance
  from public.user_credits credits
  where credits.user_id = p_payer_id
  for update;

  current_balance := coalesce(current_balance, 0);
  if current_balance < configured_cost then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  next_balance := current_balance - configured_cost;
  update public.user_credits
  set balance = next_balance,
      lifetime_spent = lifetime_spent + configured_cost,
      updated_at = now()
  where user_id = p_payer_id;

  insert into public.credit_transactions (
    user_id,
    amount,
    balance_after,
    type,
    description,
    payment_reference,
    metadata
  ) values (
    p_payer_id,
    -configured_cost,
    next_balance,
    'group_member_add',
    case p_reason
      when 'discovered_join' then 'Approved group join'
      else 'Group member addition'
    end,
    p_idempotency_key::text,
    jsonb_build_object(
      'conversation_id', p_conversation_id,
      'actor_id', p_actor_id,
      'member_id', p_member_id,
      'reason', p_reason
    )
  ) returning id into ledger_id;

  insert into public.conversation_member_charges (
    idempotency_key,
    conversation_id,
    actor_id,
    payer_id,
    member_id,
    reason,
    base_cost,
    charged_credits,
    balance_before,
    balance_after,
    credit_transaction_id
  ) values (
    p_idempotency_key,
    p_conversation_id,
    p_actor_id,
    p_payer_id,
    p_member_id,
    p_reason,
    configured_cost,
    configured_cost,
    current_balance,
    next_balance,
    ledger_id
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.charge_group_member_addition(
  uuid, uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.charge_group_member_addition(
  uuid, uuid, uuid, uuid, uuid, text
) to service_role;

-- ---------------------------------------------------------------------------
-- Premium group creation and direct admin additions
-- ---------------------------------------------------------------------------

create or replace function public.create_group_conversation(
  p_title text,
  p_description text default null,
  p_is_private boolean default false,
  p_avatar_bucket text default null,
  p_avatar_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  created public.conversations;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if not public.has_active_premium(actor, now()) then
    raise exception using errcode = 'P0001', message = 'PREMIUM_REQUIRED';
  end if;
  if nullif(btrim(p_title), '') is null then
    raise exception using errcode = '22023', message = 'GROUP_TITLE_REQUIRED';
  end if;

  insert into public.conversations (
    type,
    owner_id,
    title,
    description,
    avatar_bucket,
    avatar_path,
    settings
  ) values (
    'group',
    actor,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_avatar_bucket, '')), ''),
    nullif(btrim(coalesce(p_avatar_path, '')), ''),
    jsonb_build_object(
      'members_can_send', true,
      'members_can_start_calls', false,
      'disappearing_seconds', 0,
      'is_private', coalesce(p_is_private, false)
    )
  ) returning * into created;

  -- Transitional shadow write: current group screens still read `groups` and
  -- `group_members`. This is removed after both clients use conversations.
  insert into public.groups (
    id,
    name,
    description,
    created_by,
    is_private,
    is_premium,
    requires_subscription
  ) values (
    created.id,
    created.title,
    coalesce(created.description, ''),
    actor,
    coalesce(p_is_private, false),
    false,
    false
  ) on conflict (id) do nothing;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role,
    state,
    added_by
  ) values (created.id, actor, 'owner', 'active', actor);

  return jsonb_build_object(
    'id', created.id,
    'type', created.type,
    'owner_id', created.owner_id,
    'title', created.title,
    'description', created.description,
    'avatar', case
      when created.avatar_bucket is null or created.avatar_path is null then null
      else jsonb_build_object('bucket', created.avatar_bucket, 'path', created.avatar_path)
    end,
    'settings', created.settings,
    'external_context', created.external_context,
    'created_at', created.created_at,
    'updated_at', created.updated_at
  );
end;
$$;

create or replace function public.add_conversation_member(
  p_conversation_id uuid,
  p_member_id uuid,
  p_idempotency_key uuid,
  p_role text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  conversation_type text;
  actor_role text;
  charge public.conversation_member_charges;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_member_id is null or p_member_id = actor then
    raise exception using errcode = '22023', message = 'INVALID_MEMBER';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select c.type into conversation_type
  from public.conversations c where c.id = p_conversation_id
  for update;
  actor_role := public.conversation_role(p_conversation_id, actor);

  if conversation_type <> 'group' or actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if p_role not in ('admin', 'moderator', 'member') then
    raise exception using errcode = '22023', message = 'INVALID_MEMBER_ROLE';
  end if;
  if p_role = 'admin' and actor_role <> 'owner' then
    raise exception using errcode = '42501', message = 'OWNER_REQUIRED_FOR_ADMIN';
  end if;

  select * into charge
  from public.conversation_member_charges existing_charge
  where existing_charge.idempotency_key = p_idempotency_key;
  if charge.id is not null then
    if charge.conversation_id <> p_conversation_id
       or charge.actor_id <> actor
       or charge.member_id <> p_member_id
       or charge.reason <> 'direct_add' then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_CONFLICT';
    end if;
    return jsonb_build_object(
      'conversation_id', p_conversation_id,
      'user_id', p_member_id,
      'role', p_role,
      'charged_credits', charge.charged_credits,
      'waiver_reason', charge.waiver_reason,
      'balance_after', charge.balance_after
    );
  end if;

  if exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_member_id
      and cp.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_MEMBER';
  end if;

  charge := public.charge_group_member_addition(
    p_idempotency_key,
    p_conversation_id,
    actor,
    actor,
    p_member_id,
    'direct_add'
  );

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role,
    state,
    joined_at,
    left_at,
    added_by
  ) values (
    p_conversation_id,
    p_member_id,
    p_role,
    'active',
    now(),
    null,
    actor
  )
  on conflict (conversation_id, user_id) do update set
    role = excluded.role,
    state = 'active',
    joined_at = now(),
    left_at = null,
    added_by = actor;

  if exists (select 1 from public.groups g where g.id = p_conversation_id) then
    insert into public.group_members (group_id, user_id, role, added_by)
    values (p_conversation_id, p_member_id, p_role, actor)
    on conflict (group_id, user_id) do update set
      role = excluded.role,
      added_by = actor;
  end if;

  return jsonb_build_object(
    'conversation_id', p_conversation_id,
    'user_id', p_member_id,
    'role', p_role,
    'charged_credits', charge.charged_credits,
    'waiver_reason', charge.waiver_reason,
    'balance_after', charge.balance_after
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Canonical group RBAC mutations
-- ---------------------------------------------------------------------------

create or replace function public.set_conversation_member_role(
  p_conversation_id uuid,
  p_member_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.conversation_role(p_conversation_id, auth.uid());
  current_role text;
begin
  if actor is null or actor_role <> 'owner' then
    raise exception using errcode = '42501', message = 'OWNER_REQUIRED_FOR_ADMIN';
  end if;
  if p_role not in ('admin', 'moderator', 'member') then
    raise exception using errcode = '22023', message = 'INVALID_MEMBER_ROLE';
  end if;

  select cp.role into current_role
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id
    and cp.user_id = p_member_id
    and cp.state = 'active'
  for update;

  if current_role is null then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;
  if current_role = 'owner' then
    raise exception using errcode = '42501', message = 'OWNER_ROLE_IMMUTABLE';
  end if;

  update public.conversation_participants
  set role = p_role
  where conversation_id = p_conversation_id
    and user_id = p_member_id;

  update public.group_members
  set role = p_role
  where group_id = p_conversation_id
    and user_id = p_member_id;

  return jsonb_build_object(
    'conversation_id', p_conversation_id,
    'user_id', p_member_id,
    'role', p_role
  );
end;
$$;

create or replace function public.remove_conversation_member(
  p_conversation_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.conversation_role(p_conversation_id, auth.uid());
  target_role text;
begin
  if actor is null or actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  select cp.role into target_role
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id
    and cp.user_id = p_member_id
    and cp.state = 'active'
  for update;

  if target_role is null then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;
  if target_role = 'owner' then
    raise exception using errcode = '42501', message = 'OWNER_CANNOT_BE_REMOVED';
  end if;
  if actor_role = 'admin' and target_role = 'admin' then
    raise exception using errcode = '42501', message = 'OWNER_REQUIRED_FOR_ADMIN';
  end if;

  update public.conversation_participants
  set state = 'removed', left_at = now()
  where conversation_id = p_conversation_id
    and user_id = p_member_id;

  delete from public.group_members
  where group_id = p_conversation_id
    and user_id = p_member_id;
end;
$$;

create or replace function public.update_conversation_settings(
  p_conversation_id uuid,
  p_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text := public.conversation_role(p_conversation_id, auth.uid());
  allowed_patch jsonb := '{}'::jsonb;
  updated_settings jsonb;
begin
  if actor is null or actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;

  if p_settings ? 'members_can_send' then
    allowed_patch := allowed_patch || jsonb_build_object(
      'members_can_send', (p_settings ->> 'members_can_send')::boolean
    );
  end if;
  if p_settings ? 'members_can_start_calls' then
    allowed_patch := allowed_patch || jsonb_build_object(
      'members_can_start_calls', (p_settings ->> 'members_can_start_calls')::boolean
    );
  end if;
  if p_settings ? 'is_private' then
    allowed_patch := allowed_patch || jsonb_build_object(
      'is_private', (p_settings ->> 'is_private')::boolean
    );
  end if;
  if p_settings ? 'disappearing_seconds' then
    allowed_patch := allowed_patch || jsonb_build_object(
      'disappearing_seconds', greatest(
        0,
        (p_settings ->> 'disappearing_seconds')::integer
      )
    );
  end if;

  update public.conversations
  set settings = coalesce(settings, '{}'::jsonb) || allowed_patch,
      disappearing_seconds = coalesce(
        (allowed_patch ->> 'disappearing_seconds')::integer,
        disappearing_seconds
      )
  where id = p_conversation_id
  returning settings into updated_settings;

  if allowed_patch ? 'is_private' then
    update public.groups
    set is_private = (allowed_patch ->> 'is_private')::boolean
    where id = p_conversation_id;
  end if;

  return updated_settings;
exception when invalid_text_representation then
  raise exception using errcode = '22023', message = 'INVALID_CONVERSATION_SETTINGS';
end;
$$;

-- ---------------------------------------------------------------------------
-- Discovered/public-link join requests: approval first, applicant pays
-- ---------------------------------------------------------------------------

create or replace function public.request_group_join(
  p_conversation_id uuid,
  p_source text default 'discovery'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  conversation_type text;
  configured_cost integer;
  request_row public.conversation_join_requests;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_source not in ('discovery', 'public_link') then
    raise exception using errcode = '22023', message = 'INVALID_JOIN_SOURCE';
  end if;

  select c.type into conversation_type
  from public.conversations c where c.id = p_conversation_id;
  if conversation_type <> 'group' then
    raise exception using errcode = '22023', message = 'GROUP_REQUIRED';
  end if;
  if public.is_conversation_participant(p_conversation_id) then
    raise exception using errcode = 'P0001', message = 'ALREADY_MEMBER';
  end if;

  select greatest(0, coalesce((setting.value ->> 'credits')::integer, 50))
  into configured_cost
  from public.monetization_settings setting
  where setting.key = 'group_member_add_cost';
  configured_cost := coalesce(configured_cost, 50);

  insert into public.conversation_join_requests (
    conversation_id,
    requester_id,
    source,
    status,
    estimated_cost,
    reviewed_by,
    reviewed_at
  ) values (
    p_conversation_id,
    actor,
    p_source,
    'pending',
    configured_cost,
    null,
    null
  )
  on conflict (conversation_id, requester_id) do update set
    source = excluded.source,
    status = 'pending',
    estimated_cost = excluded.estimated_cost,
    charge_idempotency_key = gen_random_uuid(),
    reviewed_by = null,
    reviewed_at = null,
    updated_at = now()
  returning * into request_row;

  return jsonb_build_object(
    'request_id', request_row.id,
    'status', request_row.status,
    'estimated_cost', request_row.estimated_cost,
    'premium_waiver', public.has_active_premium(actor, now()),
    'requires_admin_approval', true
  );
end;
$$;

create or replace function public.review_group_join_request(
  p_request_id uuid,
  p_approve boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  request_row public.conversation_join_requests;
  actor_role text;
  charge public.conversation_member_charges;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select * into request_row
  from public.conversation_join_requests request
  where request.id = p_request_id
  for update;
  if request_row.id is null then
    raise exception using errcode = 'P0001', message = 'JOIN_REQUEST_NOT_FOUND';
  end if;

  actor_role := public.conversation_role(request_row.conversation_id, actor);
  if actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if request_row.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'JOIN_REQUEST_ALREADY_REVIEWED';
  end if;

  if not coalesce(p_approve, false) then
    update public.conversation_join_requests
    set status = 'rejected', reviewed_by = actor, reviewed_at = now()
    where id = request_row.id;
    return jsonb_build_object('request_id', request_row.id, 'status', 'rejected');
  end if;

  -- The requester accepted the fee when submitting the request. Approval
  -- charges the requester, not the approving administrator.
  charge := public.charge_group_member_addition(
    request_row.charge_idempotency_key,
    request_row.conversation_id,
    actor,
    request_row.requester_id,
    request_row.requester_id,
    'discovered_join'
  );

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role,
    state,
    joined_at,
    left_at,
    added_by
  ) values (
    request_row.conversation_id,
    request_row.requester_id,
    'member',
    'active',
    now(),
    null,
    actor
  )
  on conflict (conversation_id, user_id) do update set
    role = 'member',
    state = 'active',
    joined_at = now(),
    left_at = null,
    added_by = actor;

  if exists (
    select 1 from public.groups g where g.id = request_row.conversation_id
  ) then
    insert into public.group_members (group_id, user_id, role, added_by)
    values (
      request_row.conversation_id,
      request_row.requester_id,
      'member',
      actor
    )
    on conflict (group_id, user_id) do update set
      role = 'member',
      added_by = actor;
  end if;

  update public.conversation_join_requests
  set status = 'approved', reviewed_by = actor, reviewed_at = now()
  where id = request_row.id;

  return jsonb_build_object(
    'request_id', request_row.id,
    'status', 'approved',
    'charged_credits', charge.charged_credits,
    'waiver_reason', charge.waiver_reason,
    'payer_id', request_row.requester_id,
    'balance_after', charge.balance_after
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Explicit invitations are approved by an admin before sending and are free
-- for the invitee to accept.
-- ---------------------------------------------------------------------------

create or replace function public.invite_conversation_member(
  p_conversation_id uuid,
  p_invitee_id uuid,
  p_role text default 'member'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  invitation public.conversation_invitations;
begin
  actor_role := public.conversation_role(p_conversation_id, actor);
  if actor is null or actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if p_invitee_id is null or p_invitee_id = actor then
    raise exception using errcode = '22023', message = 'INVALID_MEMBER';
  end if;
  if p_role not in ('admin', 'moderator', 'member', 'subscriber') then
    raise exception using errcode = '22023', message = 'INVALID_MEMBER_ROLE';
  end if;
  if p_role = 'admin' and actor_role <> 'owner' then
    raise exception using errcode = '42501', message = 'OWNER_REQUIRED_FOR_ADMIN';
  end if;
  if exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_invitee_id
      and cp.state = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_MEMBER';
  end if;

  insert into public.conversation_invitations (
    conversation_id,
    inviter_id,
    invitee_id,
    role,
    status,
    token,
    expires_at,
    responded_at
  ) values (
    p_conversation_id,
    actor,
    p_invitee_id,
    p_role,
    'pending',
    gen_random_uuid(),
    now() + interval '14 days',
    null
  )
  on conflict (conversation_id, invitee_id) do update set
    inviter_id = actor,
    role = excluded.role,
    status = 'pending',
    token = gen_random_uuid(),
    expires_at = now() + interval '14 days',
    responded_at = null
  returning * into invitation;

  return jsonb_build_object(
    'invitation_id', invitation.id,
    'token', invitation.token,
    'status', invitation.status,
    'expires_at', invitation.expires_at,
    'credit_cost', 0
  );
end;
$$;

create or replace function public.accept_conversation_invitation(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  invitation public.conversation_invitations;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select * into invitation
  from public.conversation_invitations invite
  where invite.token = p_token
  for update;
  if invitation.id is null
     or invitation.invitee_id <> actor
     or invitation.status <> 'pending'
     or invitation.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'INVITATION_NOT_ACTIVE';
  end if;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role,
    state,
    joined_at,
    left_at,
    added_by
  ) values (
    invitation.conversation_id,
    actor,
    invitation.role,
    'active',
    now(),
    null,
    invitation.inviter_id
  )
  on conflict (conversation_id, user_id) do update set
    role = excluded.role,
    state = 'active',
    joined_at = now(),
    left_at = null,
    added_by = invitation.inviter_id;

  if exists (
    select 1 from public.groups g where g.id = invitation.conversation_id
  ) then
    insert into public.group_members (group_id, user_id, role, added_by)
    values (
      invitation.conversation_id,
      actor,
      invitation.role,
      invitation.inviter_id
    )
    on conflict (group_id, user_id) do update set
      role = invitation.role,
      added_by = invitation.inviter_id;
  end if;

  update public.conversation_invitations
  set status = 'accepted', responded_at = now()
  where id = invitation.id;

  return jsonb_build_object(
    'conversation_id', invitation.conversation_id,
    'status', 'accepted',
    'charged_credits', 0
  );
end;
$$;

-- Direct creation/member insertion is no longer an authorization boundary.
-- Security-definer RPCs above are the only group mutation path.
drop policy if exists "Authenticated users can create conversations" on public.conversations;
create policy "Users can create direct conversations only"
on public.conversations for insert to authenticated
with check (auth.uid() is not null and type = 'dm');

drop policy if exists "Users can add conversation participants"
  on public.conversation_participants;

-- Close the legacy community write paths as well. Older policies allowed a
-- caller to create a `groups` row or self-insert into `group_members`, which
-- would bypass premium creation, approval, and the 50-credit charge. The
-- security-definer RPCs in this migration still perform their transitional
-- shadow writes after the canonical checks succeed.
drop policy if exists "Users can create owned groups" on public.groups;
drop policy if exists "Public nonpremium groups allow self join"
  on public.group_members;

-- Keep older clients operational without preserving their free-join behavior.
-- Both legacy entry points now submit a paid, administrator-approved request.
create or replace function public.join_group(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_conversation_participant(p_group_id) then
    return 'joined';
  end if;

  perform public.request_group_join(p_group_id, 'discovery');
  return 'requested';
end;
$$;

create or replace function public.join_group_via_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  select g.id into target_group_id
  from public.groups g
  where g.invite_code = lower(btrim(p_invite_code));
  if target_group_id is null then
    raise exception using errcode = 'P0001', message = 'GROUP_LINK_INVALID';
  end if;
  if public.is_conversation_participant(target_group_id) then
    return target_group_id;
  end if;

  perform public.request_group_join(target_group_id, 'public_link');
  return target_group_id;
end;
$$;

revoke all on function public.join_group(uuid) from public, anon;
revoke all on function public.join_group_via_invite(text) from public, anon;
grant execute on function public.join_group(uuid) to authenticated, service_role;
grant execute on function public.join_group_via_invite(text)
  to authenticated, service_role;

revoke all on function public.active_premium_subscription_id(uuid, timestamptz) from public, anon;
revoke all on function public.has_active_premium(uuid, timestamptz) from public, anon;
grant execute on function public.active_premium_subscription_id(uuid, timestamptz)
  to service_role;
grant execute on function public.has_active_premium(uuid, timestamptz)
  to authenticated, service_role;

revoke all on function public.create_group_conversation(text, text, boolean, text, text)
  from public, anon;
revoke all on function public.add_conversation_member(uuid, uuid, uuid, text)
  from public, anon;
revoke all on function public.request_group_join(uuid, text) from public, anon;
revoke all on function public.review_group_join_request(uuid, boolean) from public, anon;
revoke all on function public.invite_conversation_member(uuid, uuid, text)
  from public, anon;
revoke all on function public.accept_conversation_invitation(uuid) from public, anon;
revoke all on function public.set_conversation_member_role(uuid, uuid, text)
  from public, anon;
revoke all on function public.remove_conversation_member(uuid, uuid)
  from public, anon;
revoke all on function public.update_conversation_settings(uuid, jsonb)
  from public, anon;

grant execute on function public.create_group_conversation(text, text, boolean, text, text)
  to authenticated, service_role;
grant execute on function public.add_conversation_member(uuid, uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.request_group_join(uuid, text)
  to authenticated, service_role;
grant execute on function public.review_group_join_request(uuid, boolean)
  to authenticated, service_role;
grant execute on function public.invite_conversation_member(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.accept_conversation_invitation(uuid)
  to authenticated, service_role;
grant execute on function public.set_conversation_member_role(uuid, uuid, text)
  to authenticated, service_role;
grant execute on function public.remove_conversation_member(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.update_conversation_settings(uuid, jsonb)
  to authenticated, service_role;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'conversation_join_requests',
    'conversation_invitations',
    'conversation_member_charges'
  ] loop
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
