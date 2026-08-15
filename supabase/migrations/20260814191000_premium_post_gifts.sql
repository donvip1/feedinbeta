-- Remotely managed post-gift catalog and atomic 80/20 settlement.

alter table public.gift_catalog
  add column if not exists tier text not null default 'basic',
  add column if not exists supported_sources text[] not null default array['chat'],
  add column if not exists poster_url text,
  add column if not exists idle_url text,
  add column if not exists preview_url text,
  add column if not exists send_url text,
  add column if not exists sound_url text,
  add column if not exists asset_version integer not null default 1,
  add column if not exists asset_hashes jsonb not null default '{}'::jsonb,
  add column if not exists fallback_asset_key text,
  add column if not exists minimum_client_version integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.gift_catalog'::regclass
      and conname = 'gift_catalog_tier_check'
  ) then
    alter table public.gift_catalog add constraint gift_catalog_tier_check
      check (tier in ('basic', 'premium', 'exclusive'));
  end if;
end;
$$;

insert into public.gift_catalog (
  key, name, asset_key, tier, credit_cost, recipient_percent,
  supported_sources, poster_url, idle_url, preview_url, send_url,
  asset_version, fallback_asset_key, display_order, is_active
)
select
  seed.key,
  seed.name,
  seed.key,
  seed.tier,
  seed.credit_cost,
  80,
  array['post']::text[],
  'procedural://' || seed.key || '/poster',
  'procedural://' || seed.key || '/idle',
  'procedural://' || seed.key || '/preview',
  'procedural://' || seed.key || '/send',
  1,
  seed.key,
  seed.display_order,
  true
from (
  values
    ('pulse-heart', 'Pulse Heart', 'basic', 10, 10),
    ('ice-cream', 'Ice Cream', 'basic', 12, 20),
    ('golden-star', 'Golden Star', 'basic', 30, 30),
    ('coffee-break', 'Coffee Break', 'basic', 35, 40),
    ('pizza-slice', 'Pizza Slice', 'basic', 40, 50),
    ('dream-moon', 'Dream Moon', 'basic', 50, 60),
    ('lightning', 'Lightning', 'premium', 75, 70),
    ('champion-trophy', 'Champion Trophy', 'premium', 100, 80),
    ('blazing-fire', 'Blazing Fire', 'premium', 120, 90),
    ('party-blast', 'Party Blast', 'premium', 150, 100),
    ('celebration-cake', 'Celebration Cake', 'premium', 175, 110),
    ('rainbow-vibes', 'Rainbow Vibes', 'premium', 200, 120),
    ('galaxy-rocket', 'Galaxy Rocket', 'exclusive', 300, 130),
    ('royal-crown', 'Royal Crown', 'exclusive', 500, 140),
    ('legendary-diamond', 'Legendary Diamond', 'exclusive', 750, 150),
    ('the-universe', 'The Universe', 'exclusive', 1000, 160)
) as seed(key, name, tier, credit_cost, display_order)
on conflict (key) do update set
  name = excluded.name,
  asset_key = excluded.asset_key,
  tier = excluded.tier,
  credit_cost = excluded.credit_cost,
  recipient_percent = excluded.recipient_percent,
  supported_sources = excluded.supported_sources,
  poster_url = excluded.poster_url,
  idle_url = excluded.idle_url,
  preview_url = excluded.preview_url,
  send_url = excluded.send_url,
  asset_version = excluded.asset_version,
  fallback_asset_key = excluded.fallback_asset_key,
  display_order = excluded.display_order,
  is_active = true,
  updated_at = now();

alter table public.posts
  add column if not exists gifts_count integer not null default 0,
  add column if not exists gift_credits_count bigint not null default 0;

create table if not exists public.post_gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  post_id uuid not null references public.posts(id) on delete cascade,
  catalog_item_id uuid not null references public.gift_catalog(id) on delete restrict,
  idempotency_key uuid not null,
  gift_key text not null,
  gift_name text not null,
  tier text not null,
  credit_cost integer not null check (credit_cost > 0),
  recipient_credit_value integer not null check (recipient_credit_value >= 0),
  platform_fee_credits integer not null check (platform_fee_credits >= 0),
  asset_snapshot jsonb not null default '{}'::jsonb,
  sender_transaction_id uuid references public.credit_transactions(id) on delete set null,
  recipient_transaction_id uuid references public.credit_transactions(id) on delete set null,
  notification_id uuid references public.notifications(id) on delete set null,
  sender_balance_after bigint,
  recipient_balance_after bigint,
  state text not null default 'sent' check (state in ('sent', 'refunded')),
  created_at timestamptz not null default now(),
  unique (sender_id, idempotency_key)
);

create index if not exists post_gifts_post_created_idx
  on public.post_gifts(post_id, created_at desc);
create index if not exists post_gifts_recipient_created_idx
  on public.post_gifts(recipient_id, created_at desc);

alter table public.post_gifts enable row level security;
drop policy if exists "Post gift participants can read gifts" on public.post_gifts;
create policy "Post gift participants can read gifts"
on public.post_gifts for select to authenticated
using (auth.uid() in (sender_id, recipient_id));

drop policy if exists "Users can create gift analytics as sender"
  on public.gift_analytics;
revoke insert, update, delete on public.gift_analytics from authenticated;
revoke insert, update, delete on public.post_gifts from authenticated;

create or replace function public.send_post_gift(
  p_gift_id uuid,
  p_post_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  catalog public.gift_catalog;
  target_post public.posts;
  existing public.post_gifts;
  sender_balance bigint;
  sender_balance_after bigint;
  recipient_balance_after bigint;
  recipient_value integer;
  platform_fee integer;
  sender_ledger uuid;
  recipient_ledger uuid;
  gift_record_id uuid := gen_random_uuid();
  gift_notification_id uuid;
  asset_manifest jsonb;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_gift_id is null or p_post_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'GIFT_ARGUMENT_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor::text || ':' || p_idempotency_key::text, 0)
  );

  select * into existing
  from public.post_gifts gift
  where gift.sender_id = actor
    and gift.idempotency_key = p_idempotency_key;
  if existing.id is not null then
    if existing.post_id <> p_post_id or existing.catalog_item_id <> p_gift_id then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_CONFLICT';
    end if;
    return jsonb_build_object(
      'gift_record_id', existing.id,
      'balance_after', coalesce(existing.sender_balance_after, 0),
      'recipient_balance_after', coalesce(existing.recipient_balance_after, 0),
      'notification_id', existing.notification_id,
      'recipient_credit_value', existing.recipient_credit_value,
      'platform_fee_credits', existing.platform_fee_credits,
      'assets', existing.asset_snapshot
    );
  end if;

  select * into catalog
  from public.gift_catalog item
  where item.id = p_gift_id
    and item.is_active
    and 'post' = any(item.supported_sources)
  for share;
  if catalog.id is null then
    raise exception using errcode = '22023', message = 'GIFT_NOT_AVAILABLE';
  end if;

  select * into target_post
  from public.posts post
  where post.id = p_post_id
  for update;
  if target_post.id is null
     or target_post.status <> 'active'
     or coalesce(target_post.privacy, 'everyone') <> 'everyone' then
    raise exception using errcode = '42501', message = 'POST_NOT_GIFT_ELIGIBLE';
  end if;
  if target_post.user_id = actor then
    raise exception using errcode = '22023', message = 'SELF_GIFT_NOT_ALLOWED';
  end if;

  insert into public.user_credits(user_id, balance, lifetime_earned, lifetime_spent)
  values (actor, 0, 0, 0)
  on conflict (user_id) do nothing;
  select balance into sender_balance
  from public.user_credits where user_id = actor for update;
  if coalesce(sender_balance, 0) < catalog.credit_cost then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_CREDITS';
  end if;

  recipient_value := floor(catalog.credit_cost::numeric * 0.80)::integer;
  platform_fee := catalog.credit_cost - recipient_value;
  sender_balance_after := sender_balance - catalog.credit_cost;
  asset_manifest := jsonb_build_object(
    'key', catalog.key,
    'tier', catalog.tier,
    'poster_url', catalog.poster_url,
    'idle_url', catalog.idle_url,
    'preview_url', catalog.preview_url,
    'send_url', catalog.send_url,
    'sound_url', catalog.sound_url,
    'version', catalog.asset_version,
    'hashes', catalog.asset_hashes,
    'fallback_asset_key', catalog.fallback_asset_key
  );

  update public.user_credits
  set balance = sender_balance_after,
      lifetime_spent = lifetime_spent + catalog.credit_cost,
      updated_at = now()
  where user_id = actor;

  insert into public.credit_transactions(
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    actor, -catalog.credit_cost, sender_balance_after, 'post_gift_sent',
    'Sent ' || catalog.name || ' on a post', p_idempotency_key::text,
    jsonb_build_object('post_id', p_post_id, 'recipient_id', target_post.user_id)
  ) returning id into sender_ledger;

  insert into public.user_credits(user_id, balance, lifetime_earned, lifetime_spent)
  values (target_post.user_id, recipient_value, recipient_value, 0)
  on conflict (user_id) do update set
    balance = public.user_credits.balance + excluded.balance,
    lifetime_earned = public.user_credits.lifetime_earned + excluded.lifetime_earned,
    updated_at = now()
  returning balance into recipient_balance_after;

  insert into public.credit_transactions(
    user_id, amount, balance_after, type, description, payment_reference, metadata
  ) values (
    target_post.user_id, recipient_value, recipient_balance_after,
    'post_gift_received', 'Received ' || catalog.name || ' on a post',
    p_idempotency_key::text,
    jsonb_build_object('post_id', p_post_id, 'sender_id', actor)
  ) returning id into recipient_ledger;

  update public.platform_wallet
  set balance = balance + platform_fee, updated_at = now()
  where id = 1;

  insert into public.post_gifts(
    id, sender_id, recipient_id, post_id, catalog_item_id, idempotency_key,
    gift_key, gift_name, tier, credit_cost, recipient_credit_value,
    platform_fee_credits, asset_snapshot, sender_transaction_id,
    recipient_transaction_id, sender_balance_after, recipient_balance_after
  ) values (
    gift_record_id, actor, target_post.user_id, p_post_id, catalog.id,
    p_idempotency_key, catalog.key, catalog.name, catalog.tier,
    catalog.credit_cost, recipient_value, platform_fee, asset_manifest,
    sender_ledger, recipient_ledger, sender_balance_after, recipient_balance_after
  );

  update public.posts
  set gifts_count = gifts_count + 1,
      gift_credits_count = gift_credits_count + catalog.credit_cost
  where id = p_post_id;

  insert into public.gift_analytics(
    id, sender_id, receiver_id, gift_type, credit_value, source_type, source_id
  ) values (
    gift_record_id, actor, target_post.user_id, catalog.key,
    catalog.credit_cost, 'post', p_post_id
  );

  insert into public.notifications(
    user_id, from_user_id, type, title, message, related_id, related_type,
    route, data
  ) values (
    target_post.user_id, actor, 'gift', 'New post gift',
    'Someone sent ' || catalog.name || ' on your post.', p_post_id, 'post',
    '/posts/' || p_post_id::text,
    jsonb_build_object(
      'gift_record_id', gift_record_id,
      'gift_key', catalog.key,
      'credits', catalog.credit_cost,
      'recipient_credits', recipient_value,
      'platform_fee_credits', platform_fee
    )
  ) returning id into gift_notification_id;

  update public.post_gifts
  set notification_id = gift_notification_id
  where id = gift_record_id;

  return jsonb_build_object(
    'gift_record_id', gift_record_id,
    'balance_after', sender_balance_after,
    'recipient_balance_after', recipient_balance_after,
    'notification_id', gift_notification_id,
    'recipient_credit_value', recipient_value,
    'platform_fee_credits', platform_fee,
    'assets', asset_manifest
  );
end;
$$;

revoke all on function public.send_post_gift(uuid, uuid, uuid) from public;
revoke all on function public.send_post_gift(uuid, uuid, uuid) from anon;
grant execute on function public.send_post_gift(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
