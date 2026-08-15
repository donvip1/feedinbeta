-- Durable server-owned delivery queue for gift receipt notifications.

create table if not exists public.notification_delivery_outbox (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  route text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_delivery_outbox_pending_idx
  on public.notification_delivery_outbox(status, available_at, created_at)
  where status in ('pending', 'failed');

alter table public.notification_delivery_outbox enable row level security;
revoke all on public.notification_delivery_outbox from anon, authenticated;

alter table public.post_gifts
  add column if not exists notification_id uuid
    references public.notifications(id) on delete set null,
  add column if not exists sender_balance_after bigint,
  add column if not exists recipient_balance_after bigint;

do $$
begin
  if to_regprocedure('public.send_post_gift_legacy(uuid,uuid,uuid)') is null then
    alter function public.send_post_gift(uuid, uuid, uuid)
      rename to send_post_gift_legacy;
  end if;
end;
$$;

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
  existing public.post_gifts;
  result jsonb;
  sender_snapshot bigint;
  recipient_snapshot bigint;
  receipt_notification_id uuid;
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

  result := public.send_post_gift_legacy(
    p_gift_id, p_post_id, p_idempotency_key
  );

  select * into existing
  from public.post_gifts gift
  where gift.id = (result->>'gift_record_id')::uuid
  for update;
  select balance into sender_snapshot
  from public.user_credits where user_id = actor;
  select balance into recipient_snapshot
  from public.user_credits where user_id = existing.recipient_id;
  receipt_notification_id := existing.notification_id;

  if receipt_notification_id is null then
    delete from public.notifications notification
    where notification.id = (
      select candidate.id
      from public.notifications candidate
      where candidate.user_id = existing.recipient_id
        and candidate.from_user_id = actor
        and candidate.type = 'gift'
        and candidate.related_id = existing.post_id
        and candidate.created_at >= existing.created_at
      order by candidate.created_at desc
      limit 1
    );

    insert into public.notifications(
      user_id, from_user_id, type, title, message, related_id, related_type,
      route, data
    ) values (
      existing.recipient_id, actor, 'gift', 'New post gift',
      'Someone sent ' || existing.gift_name || ' on your post.',
      existing.post_id, 'post', '/posts/' || existing.post_id::text,
      jsonb_build_object(
        'gift_record_id', existing.id,
        'gift_key', existing.gift_key,
        'credits', existing.credit_cost,
        'recipient_credits', existing.recipient_credit_value,
        'platform_fee_credits', existing.platform_fee_credits
      )
    ) returning id into receipt_notification_id;
  end if;

  update public.post_gifts
  set notification_id = receipt_notification_id,
      sender_balance_after = sender_snapshot,
      recipient_balance_after = recipient_snapshot
  where id = existing.id;

  return result || jsonb_build_object(
    'balance_after', sender_snapshot,
    'recipient_balance_after', recipient_snapshot,
    'notification_id', receipt_notification_id
  );
end;
$$;

revoke all on function public.send_post_gift_legacy(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.send_post_gift(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.send_post_gift(uuid, uuid, uuid)
  to authenticated;

create or replace function public.queue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  gift_receipt public.post_gifts;
begin
  if new.type = 'gift' then
    select * into gift_receipt
    from public.post_gifts gift
    where gift.id = nullif(new.data->>'gift_record_id', '')::uuid
      and gift.sender_id = new.from_user_id
      and gift.recipient_id = new.user_id
      and gift.post_id = new.related_id;
    if gift_receipt.id is null then
      return new;
    end if;
    insert into public.notification_delivery_outbox(
      notification_id, user_id, event_type, route, payload
    ) values (
      new.id,
      new.user_id,
      'gift',
      coalesce(new.route, '/posts/' || new.related_id::text),
      jsonb_build_object(
        'type', 'gift',
        'route', 'post:' || new.related_id::text,
        'gift_record_id', gift_receipt.id,
        'gift_key', gift_receipt.gift_key,
        'gross_credits', gift_receipt.credit_cost::text,
        'recipient_credits', gift_receipt.recipient_credit_value::text
      )
    )
    on conflict (notification_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_notification_delivery_after_insert
  on public.notifications;
create trigger queue_notification_delivery_after_insert
after insert on public.notifications
for each row execute function public.queue_notification_delivery();

notify pgrst, 'reload schema';
