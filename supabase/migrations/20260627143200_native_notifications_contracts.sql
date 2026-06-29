-- feedIn native parity: notifications table, typed actions, preferences, and FCM device tokens.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_user_id uuid references public.profiles(id) on delete set null,
  type text not null default 'system',
  title text not null,
  message text,
  related_id uuid,
  related_type text,
  action_type text,
  action_url text,
  route text,
  data jsonb not null default '{}'::jsonb,
  fcm_payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications
add column if not exists from_user_id uuid references public.profiles(id) on delete set null,
add column if not exists action_type text,
add column if not exists action_url text,
add column if not exists route text,
add column if not exists data jsonb not null default '{}'::jsonb,
add column if not exists fcm_payload jsonb not null default '{}'::jsonb,
add column if not exists read_at timestamptz;

create index if not exists notifications_user_created_idx
on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications(user_id, is_read, created_at desc);

create index if not exists notifications_type_idx
on public.notifications(type);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
on public.notifications for delete
using (auth.uid() = user_id);

drop policy if exists "Authenticated users can create notifications" on public.notifications;
create policy "Authenticated users can create notifications"
on public.notifications for insert
with check (auth.uid() is not null);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  likes_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  replies_enabled boolean not null default true,
  mentions_enabled boolean not null default true,
  follows_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  friend_requests_enabled boolean not null default true,
  stories_enabled boolean not null default true,
  badges_enabled boolean not null default true,
  email_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.notification_preferences
add column if not exists push_enabled boolean not null default true,
add column if not exists likes_enabled boolean not null default true,
add column if not exists comments_enabled boolean not null default true,
add column if not exists replies_enabled boolean not null default true,
add column if not exists mentions_enabled boolean not null default true,
add column if not exists follows_enabled boolean not null default true,
add column if not exists messages_enabled boolean not null default true,
add column if not exists friend_requests_enabled boolean not null default true,
add column if not exists stories_enabled boolean not null default true,
add column if not exists badges_enabled boolean not null default true,
add column if not exists email_enabled boolean not null default false;

alter table public.notification_preferences enable row level security;

drop policy if exists "Users can read own notification preferences" on public.notification_preferences;
create policy "Users can read own notification preferences"
on public.notification_preferences for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences" on public.notification_preferences;
create policy "Users can insert own notification preferences"
on public.notification_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences" on public.notification_preferences;
create policy "Users can update own notification preferences"
on public.notification_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'web'
    check (platform in ('web', 'android', 'ios')),
  endpoint text,
  p256dh text,
  auth text,
  device_token text,
  token_type text not null default 'fcm'
    check (token_type in ('web_push', 'fcm', 'apns')),
  app_version text,
  device_id text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions
add column if not exists platform text not null default 'web',
add column if not exists endpoint text,
add column if not exists p256dh text,
add column if not exists auth text,
add column if not exists device_token text,
add column if not exists token_type text not null default 'fcm',
add column if not exists app_version text,
add column if not exists device_id text,
add column if not exists is_active boolean not null default true,
add column if not exists last_seen_at timestamptz not null default now();

create index if not exists push_subscriptions_user_idx
on public.push_subscriptions(user_id, is_active);

create index if not exists push_subscriptions_device_token_idx
on public.push_subscriptions(device_token)
where device_token is not null;

create unique index if not exists push_subscriptions_user_platform_target_idx
on public.push_subscriptions(user_id, platform, (coalesce(device_id, device_token, endpoint)));

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can manage own push subscriptions" on public.push_subscriptions;
create policy "Users can manage own push subscriptions"
on public.push_subscriptions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set is_read = true,
      read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid();
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set is_read = true,
      read_at = coalesce(read_at, now())
  where user_id = auth.uid()
    and is_read = false;
$$;

create or replace function public.register_push_subscription(
  p_platform text,
  p_device_token text,
  p_device_id text default null,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.push_subscriptions (
    user_id,
    platform,
    device_token,
    device_id,
    app_version,
    token_type,
    is_active,
    last_seen_at,
    updated_at
  )
  values (
    auth.uid(),
    case when p_platform in ('web', 'android', 'ios') then p_platform else 'android' end,
    p_device_token,
    p_device_id,
    p_app_version,
    case when p_platform = 'ios' then 'apns' else 'fcm' end,
    true,
    now(),
    now()
  )
  on conflict (user_id, platform, (coalesce(device_id, device_token, endpoint)))
  do update set
    device_token = excluded.device_token,
    app_version = excluded.app_version,
    is_active = true,
    last_seen_at = now(),
    updated_at = now()
  returning id into subscription_id;

  return subscription_id;
end;
$$;

create or replace function public.create_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  follower_name text;
begin
  select coalesce(display_name, username, 'Someone')
  into follower_name
  from public.profiles
  where id = new.follower_id;

  insert into public.notifications (
    user_id,
    from_user_id,
    type,
    title,
    message,
    related_id,
    related_type,
    action_type,
    route,
    data
  )
  values (
    new.following_id,
    new.follower_id,
    'follow',
    'New follower',
    follower_name || ' started following you',
    new.follower_id,
    'profile',
    'open_profile',
    'feedin://profile/' || new.follower_id::text,
    jsonb_build_object('profile_id', new.follower_id)
  );

  return new;
end;
$$;

drop trigger if exists notify_on_follow on public.follows;
create trigger notify_on_follow
after insert on public.follows
for each row execute function public.create_follow_notification();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'push_subscriptions'
    ) then
      alter publication supabase_realtime add table public.push_subscriptions;
    end if;
  end if;
end $$;
