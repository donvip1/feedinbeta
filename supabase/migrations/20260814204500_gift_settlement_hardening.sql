-- Forward-only hardening for the live post-gift settlement contract.
-- This migration replaces the legacy wrapper installed by
-- 20260814203000 without editing an already-applied migration.

alter table public.post_gifts
  add column if not exists notification_id uuid
    references public.notifications(id) on delete set null,
  add column if not exists sender_balance_after bigint,
  add column if not exists recipient_balance_after bigint;

-- Preserve the immutable balances for receipts created by the earlier RPC.
update public.post_gifts gift
set sender_balance_after = ledger.balance_after
from public.credit_transactions ledger
where gift.sender_transaction_id = ledger.id
  and gift.sender_balance_after is null;

update public.post_gifts gift
set recipient_balance_after = ledger.balance_after
from public.credit_transactions ledger
where gift.recipient_transaction_id = ledger.id
  and gift.recipient_balance_after is null;

-- Gift notifications are server-owned. Users may create ordinary self
-- notifications, but cannot forge a financial receipt that enters the push
-- delivery pipeline.
drop policy if exists "Authenticated users can create notifications" on public.notifications;
drop policy if exists "Users can create notifications for self" on public.notifications;
drop policy if exists "Users can create non-gift notifications for self" on public.notifications;
create policy "Users can create non-gift notifications for self"
on public.notifications for insert to authenticated
with check (auth.uid() = user_id and type <> 'gift');

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
  receipt_notification_id uuid;
  asset_manifest jsonb;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;
  if p_gift_id is null or p_post_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'GIFT_ARGUMENT_REQUIRED';
  end if;

  -- All retries for one sender/key share one transaction lock. This makes a
  -- concurrent retry wait for the first receipt and then replay it.
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
    jsonb_build_object('post_id', p_post_id, 'recipient_id', target_post.user_id,
      'gift_record_id', gift_record_id)
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
    jsonb_build_object('post_id', p_post_id, 'sender_id', actor,
      'gift_record_id', gift_record_id)
  ) returning id into recipient_ledger;

  insert into public.platform_wallet(id, balance)
  values (1, platform_fee)
  on conflict (id) do update set
    balance = public.platform_wallet.balance + excluded.balance,
    updated_at = now();

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
  ) returning id into receipt_notification_id;

  insert into public.notification_delivery_outbox(
    notification_id, user_id, event_type, route, payload
  ) values (
    receipt_notification_id,
    target_post.user_id,
    'gift',
    '/posts/' || p_post_id::text,
    jsonb_build_object(
      'type', 'gift',
      'route', 'post:' || p_post_id::text,
      'gift_record_id', gift_record_id,
      'gift_key', catalog.key,
      'gross_credits', catalog.credit_cost::text,
      'recipient_credits', recipient_value::text
    )
  ) on conflict (notification_id) do nothing;

  update public.post_gifts
  set notification_id = receipt_notification_id
  where id = gift_record_id;

  return jsonb_build_object(
    'gift_record_id', gift_record_id,
    'balance_after', sender_balance_after,
    'recipient_balance_after', recipient_balance_after,
    'notification_id', receipt_notification_id,
    'recipient_credit_value', recipient_value,
    'platform_fee_credits', platform_fee,
    'assets', asset_manifest
  );
end;
$$;

revoke all on function public.send_post_gift(uuid, uuid, uuid) from public, anon;
grant execute on function public.send_post_gift(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
