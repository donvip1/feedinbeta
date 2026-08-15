-- Durable native push dispatch for gift and social notification receipts.

alter table public.notification_preferences
  add column if not exists gifts_enabled boolean not null default true;

create or replace function public.queue_notification_delivery()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_route text;
  delivery_payload jsonb;
begin
  if new.type not in ('gift', 'comment', 'reply', 'mention', 'tag', 'follow') then
    return new;
  end if;

  if new.type = 'gift' and not exists (
    select 1
    from public.post_gifts gift
    where gift.id = case
      when new.data->>'gift_record_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (new.data->>'gift_record_id')::uuid
      else null
    end
      and gift.sender_id = new.from_user_id
      and gift.recipient_id = new.user_id
      and gift.post_id = new.related_id
  ) then
    return new;
  end if;

  delivery_route := case
    when new.type = 'follow' then
      'profile:' || coalesce(
        nullif(new.data->>'profile_id', ''),
        new.related_id::text
      )
    else
      'post:' || coalesce(
        nullif(new.data->>'post_id', ''),
        new.related_id::text
      )
  end;

  if delivery_route is null or delivery_route ~ ':$' then
    return new;
  end if;

  delivery_payload := coalesce(new.data, '{}'::jsonb)
    || coalesce(new.fcm_payload, '{}'::jsonb)
    || jsonb_build_object('type', new.type, 'route', delivery_route);

  insert into public.notification_delivery_outbox(
    notification_id, user_id, event_type, route, payload
  ) values (
    new.id,
    new.user_id,
    new.type,
    delivery_route,
    delivery_payload
  )
  on conflict (notification_id) do nothing;

  return new;
end;
$$;

create or replace function public.claim_notification_delivery_outbox(
  p_notification_id uuid default null,
  p_limit integer default 20
)
returns setof public.notification_delivery_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select queue.notification_id
    from public.notification_delivery_outbox queue
    where (
        (queue.status in ('pending', 'failed') and queue.available_at <= now())
        or (queue.status = 'processing' and queue.updated_at <= now() - interval '5 minutes')
      )
      and (p_notification_id is null or queue.notification_id = p_notification_id)
    order by queue.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.notification_delivery_outbox queue
  set status = 'processing',
      attempt_count = queue.attempt_count + 1,
      last_error = null,
      updated_at = now()
  from candidates
  where queue.notification_id = candidates.notification_id
  returning queue.*;
end;
$$;

revoke all on function public.claim_notification_delivery_outbox(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_notification_delivery_outbox(uuid, integer)
  to service_role;

create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_notification_delivery_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://jnegupfltkfybhwpodrr.supabase.co/functions/v1/dispatch-notification-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('outbox_id', new.notification_id)
  );
  return new;
end;
$$;

drop trigger if exists dispatch_notification_delivery_after_insert
  on public.notification_delivery_outbox;
create trigger dispatch_notification_delivery_after_insert
after insert on public.notification_delivery_outbox
for each row execute function public.invoke_notification_delivery_dispatch();

create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'dispatch-notification-push-every-minute';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'dispatch-notification-push-every-minute',
    '* * * * *',
    $schedule$
      select net.http_post(
        url := 'https://jnegupfltkfybhwpodrr.supabase.co/functions/v1/dispatch-notification-push',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    $schedule$
  );
end;
$$;

notify pgrst, 'reload schema';
