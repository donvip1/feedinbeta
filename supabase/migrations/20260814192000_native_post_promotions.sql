create table if not exists public.promotion_plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  credit_cost integer not null check (credit_cost > 0),
  duration_hours integer not null check (duration_hours > 0),
  estimated_reach_min integer not null,
  estimated_reach_max integer not null,
  targeting_capabilities jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.promotion_plans(
  key, name, credit_cost, duration_hours, estimated_reach_min,
  estimated_reach_max, targeting_capabilities, metadata, display_order
)
values
  ('starter', 'Starter Boost', 25, 12, 500, 750,
   '{"automatic":true,"global":true}'::jsonb,
   '{"label":"500+ reach"}'::jsonb, 10),
  ('basic', 'Basic Boost', 50, 24, 1500, 2250,
   '{"automatic":true,"global":true}'::jsonb,
   '{"label":"1,500+ reach"}'::jsonb, 20),
  ('pro', 'Pro Boost', 100, 72, 5000, 7500,
   '{"automatic":true,"global":true,"age":true,"interests":true}'::jsonb,
   '{"label":"5,000+ reach"}'::jsonb, 30),
  ('premium', 'Premium Boost', 200, 168, 15000, 22500,
   '{"automatic":true,"global":true,"age":true,"interests":true,"location":true}'::jsonb,
   '{"label":"15,000+ reach"}'::jsonb, 40),
  ('elite', 'Elite Campaign', 500, 336, 50000, 75000,
   '{"automatic":true,"global":true,"age":true,"interests":true,"location":true}'::jsonb,
   '{"label":"50,000+ reach"}'::jsonb, 50)
on conflict (key) do update set
  name = excluded.name,
  credit_cost = excluded.credit_cost,
  duration_hours = excluded.duration_hours,
  estimated_reach_min = excluded.estimated_reach_min,
  estimated_reach_max = excluded.estimated_reach_max,
  targeting_capabilities = excluded.targeting_capabilities,
  metadata = excluded.metadata,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

create table if not exists public.post_promotion_campaigns (
  id uuid primary key default gen_random_uuid(),
  promoter_id uuid not null references public.profiles(id) on delete restrict,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  post_id uuid not null references public.posts(id) on delete cascade,
  plan_id uuid not null references public.promotion_plans(id) on delete restrict,
  plan_key text not null,
  plan_name text not null,
  plan_version integer not null,
  credit_cost integer not null,
  creator_credit_value integer not null default 0,
  platform_credit_value integer not null default 0,
  targeting_snapshot jsonb not null default '{}'::jsonb,
  estimate_min integer not null,
  estimate_max integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state text not null default 'active'
    check (state in ('active', 'paused', 'completed', 'rejected', 'refunded')),
  remaining_budget integer not null,
  impressions_count bigint not null default 0,
  reach_count bigint not null default 0,
  engagement_count bigint not null default 0,
  idempotency_key uuid not null,
  ledger_transaction_id uuid references public.credit_transactions(id) on delete set null,
  moderation_reason text,
  terminal_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promoter_id, idempotency_key)
);

create index if not exists promotion_campaign_active_idx
  on public.post_promotion_campaigns(state, starts_at, ends_at);
create index if not exists promotion_campaign_post_idx
  on public.post_promotion_campaigns(post_id, state);

create table if not exists public.post_promotion_delivery_events (
  campaign_id uuid not null references public.post_promotion_campaigns(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null,
  delivered_at timestamptz not null default now(),
  primary key (campaign_id, viewer_id, session_id)
);

create index if not exists promotion_delivery_viewer_idx
  on public.post_promotion_delivery_events(viewer_id, delivered_at desc);

alter table public.promotion_plans enable row level security;
alter table public.post_promotion_campaigns enable row level security;
alter table public.post_promotion_delivery_events enable row level security;

drop policy if exists "Authenticated users can read promotion plans" on public.promotion_plans;
create policy "Authenticated users can read promotion plans"
on public.promotion_plans for select to authenticated using (is_active);

drop policy if exists "Promotion participants can read campaigns" on public.post_promotion_campaigns;
create policy "Promotion participants can read campaigns"
on public.post_promotion_campaigns for select to authenticated
using (auth.uid() in (promoter_id, creator_id));

revoke insert, update, delete on public.post_promotion_campaigns from authenticated;
revoke all on public.post_promotion_delivery_events from anon, authenticated;

create or replace function public.record_post_promotion_delivery(
  p_campaign_id uuid,
  p_viewer_id uuid,
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
  viewer_was_reached boolean;
begin
  if p_campaign_id is null or p_viewer_id is null or p_session_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_campaign_id::text || ':' || p_viewer_id::text, 0)
  );

  select exists(
    select 1
    from public.post_promotion_delivery_events delivery
    where delivery.campaign_id = p_campaign_id
      and delivery.viewer_id = p_viewer_id
  ) into viewer_was_reached;

  insert into public.post_promotion_delivery_events(
    campaign_id, viewer_id, session_id
  )
  select campaign.id, p_viewer_id, p_session_id
  from public.post_promotion_campaigns campaign
  where campaign.id = p_campaign_id
    and campaign.state = 'active'
    and campaign.starts_at <= now()
    and campaign.ends_at > now()
    and campaign.remaining_budget > 0
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return false;
  end if;

  update public.post_promotion_campaigns campaign
  set impressions_count = campaign.impressions_count + 1,
      reach_count = campaign.reach_count + case when viewer_was_reached then 0 else 1 end,
      remaining_budget = greatest(0, campaign.remaining_budget - 1),
      state = case
        when campaign.remaining_budget <= 1 then 'completed'
        else campaign.state
      end,
      terminal_reason = case
        when campaign.remaining_budget <= 1 then 'budget_exhausted'
        else campaign.terminal_reason
      end,
      updated_at = now()
  where campaign.id = p_campaign_id;

  return true;
end;
$$;

revoke all on function public.record_post_promotion_delivery(uuid, uuid, uuid) from public;
revoke all on function public.record_post_promotion_delivery(uuid, uuid, uuid) from anon, authenticated;
grant execute on function public.record_post_promotion_delivery(uuid, uuid, uuid) to service_role;

create or replace function public.promote_post(
  p_post_id uuid,
  p_plan_id uuid,
  p_plan_version integer,
  p_targeting jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  selected_plan public.promotion_plans;
  target_post public.posts;
  existing public.post_promotion_campaigns;
  current_balance bigint;
  balance_after bigint;
  creator_balance bigint;
  creator_credit integer;
  platform_credit integer;
  ledger_id uuid;
  campaign_id uuid := gen_random_uuid();
  start_time timestamptz := now();
begin
  if actor is null then
    raise exception using errcode='P0001', message='NOT_AUTHENTICATED';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode='22023', message='IDEMPOTENCY_KEY_REQUIRED';
  end if;

  select * into existing from public.post_promotion_campaigns campaign
  where campaign.promoter_id = actor and campaign.idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.post_id <> p_post_id or existing.plan_id <> p_plan_id then
      raise exception using errcode='23505', message='IDEMPOTENCY_KEY_CONFLICT';
    end if;
    return to_jsonb(existing);
  end if;

  select * into selected_plan from public.promotion_plans plan
  where plan.id = p_plan_id and plan.is_active for share;
  if selected_plan.id is null then
    raise exception using errcode='22023', message='PLAN_NOT_AVAILABLE';
  end if;
  if selected_plan.version <> p_plan_version then
    raise exception using errcode='22023', message='PLAN_VERSION_STALE';
  end if;

  select * into target_post from public.posts post
  where post.id = p_post_id for update;
  if target_post.id is null or target_post.status <> 'active'
     or coalesce(target_post.privacy, 'everyone') <> 'everyone' then
    raise exception using errcode='42501', message='POST_NOT_PROMOTABLE';
  end if;

  if jsonb_typeof(coalesce(p_targeting, '{}'::jsonb)) <> 'object' then
    raise exception using errcode='22023', message='INVALID_TARGETING';
  end if;
  if coalesce(p_targeting, '{}'::jsonb) ? 'location'
     and not coalesce((selected_plan.targeting_capabilities->>'location')::boolean, false) then
    raise exception using errcode='22023', message='TARGETING_NOT_SUPPORTED';
  end if;

  insert into public.user_credits(user_id, balance, lifetime_earned, lifetime_spent)
  values(actor, 0, 0, 0) on conflict(user_id) do nothing;
  select balance into current_balance from public.user_credits
  where user_id = actor for update;
  if coalesce(current_balance, 0) < selected_plan.credit_cost then
    raise exception using errcode='P0001', message='INSUFFICIENT_CREDITS';
  end if;

  creator_credit := floor(selected_plan.credit_cost::numeric * 0.20)::integer;
  platform_credit := selected_plan.credit_cost - creator_credit;
  balance_after := current_balance - selected_plan.credit_cost;
  if target_post.user_id = actor then
    balance_after := balance_after + creator_credit;
    update public.user_credits set
      balance = balance_after,
      lifetime_spent = lifetime_spent + selected_plan.credit_cost,
      lifetime_earned = lifetime_earned + creator_credit,
      updated_at = now()
    where user_id = actor;
  else
    update public.user_credits set
      balance = balance_after,
      lifetime_spent = lifetime_spent + selected_plan.credit_cost,
      updated_at = now()
    where user_id = actor;
    insert into public.user_credits(user_id, balance, lifetime_earned, lifetime_spent)
    values(target_post.user_id, creator_credit, creator_credit, 0)
    on conflict(user_id) do update set
      balance = public.user_credits.balance + excluded.balance,
      lifetime_earned = public.user_credits.lifetime_earned + excluded.lifetime_earned,
      updated_at = now()
    returning balance into creator_balance;
  end if;

  insert into public.credit_transactions(
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    actor, -selected_plan.credit_cost, balance_after, 'post_promotion',
    'Funded ' || selected_plan.name, p_idempotency_key::text,
    jsonb_build_object('post_id', p_post_id, 'plan_key', selected_plan.key,
      'creator_credit', creator_credit, 'platform_credit', platform_credit)
  ) returning id into ledger_id;

  update public.platform_wallet set
    balance = balance + platform_credit, updated_at = now() where id = 1;

  insert into public.post_promotion_campaigns(
    id, promoter_id, creator_id, post_id, plan_id, plan_key, plan_name,
    plan_version, credit_cost, creator_credit_value, platform_credit_value,
    targeting_snapshot, estimate_min, estimate_max, starts_at, ends_at,
    remaining_budget, idempotency_key, ledger_transaction_id
  ) values (
    campaign_id, actor, target_post.user_id, p_post_id, selected_plan.id,
    selected_plan.key, selected_plan.name, selected_plan.version,
    selected_plan.credit_cost, creator_credit, platform_credit,
    coalesce(p_targeting, '{}'::jsonb), selected_plan.estimated_reach_min,
    selected_plan.estimated_reach_max, start_time,
    start_time + make_interval(hours => selected_plan.duration_hours),
    platform_credit, p_idempotency_key, ledger_id
  ) returning * into existing;

  insert into public.notifications(
    user_id, from_user_id, type, title, message, related_id, related_type,
    route, data
  ) values (
    target_post.user_id, actor, 'post_promoted', 'Post promoted',
    'Your post received a ' || selected_plan.name || ' campaign.',
    p_post_id, 'post', '/posts/' || p_post_id::text,
    jsonb_build_object('campaign_id', campaign_id, 'creator_credit', creator_credit)
  );

  return to_jsonb(existing) || jsonb_build_object('balance_after', balance_after);
end;
$$;

revoke all on function public.promote_post(uuid, uuid, integer, jsonb, uuid) from public;
revoke all on function public.promote_post(uuid, uuid, integer, jsonb, uuid) from anon;
grant execute on function public.promote_post(uuid, uuid, integer, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
