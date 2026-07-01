-- Telegram-style broadcast Channels (plan.md §F + §B) — MISSING ENTIRELY before.
--
-- One-to-many broadcast: owners/admins post, subscribers read. Modeled to match
-- the native `channels` feature module's data source
-- (features/channels/data/channels_remote_data_source.dart), which reads:
--   channels(id, owner_id, name, slug, description, avatar_url, is_verified,
--            subscriber_count, created_at)
--   channel_subscribers(channel_id, user_id, role, created_at)
--   channel_posts(id, channel_id, author_id, content, media_url, media_type,
--                 view_count, created_at) + profiles!channel_posts_author_id_fkey
--
-- subscriber_count is denormalized on channels and maintained by a trigger on
-- channel_subscribers (same pattern as follows -> profiles.followers_count); the
-- client never writes the count directly.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique,
  description text,
  avatar_url text,
  is_verified boolean not null default false,
  subscriber_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_subscribers (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'subscriber'
    check (role in ('owner', 'admin', 'subscriber')),
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table if not exists public.channel_posts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '',
  media_url text,
  media_type text,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists channels_subscriber_count_idx
  on public.channels(subscriber_count desc);
create index if not exists channel_subscribers_user_idx
  on public.channel_subscribers(user_id);
create index if not exists channel_posts_channel_created_idx
  on public.channel_posts(channel_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger on channels (reuses public.set_updated_at)
-- ---------------------------------------------------------------------------

drop trigger if exists set_channels_updated_at on public.channels;
create trigger set_channels_updated_at
  before update on public.channels
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subscriber_count maintenance (mirrors update_profile_follow_counts)
-- ---------------------------------------------------------------------------

create or replace function public.update_channel_subscriber_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.channels
      set subscriber_count = greatest(0, subscriber_count + 1)
      where id = new.channel_id;
  elsif tg_op = 'DELETE' then
    update public.channels
      set subscriber_count = greatest(0, subscriber_count - 1)
      where id = old.channel_id;
  end if;
  return null;
end;
$$;

drop trigger if exists update_channel_subscriber_count_trigger
  on public.channel_subscribers;
create trigger update_channel_subscriber_count_trigger
  after insert or delete on public.channel_subscribers
  for each row execute function public.update_channel_subscriber_count();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.channels enable row level security;
alter table public.channel_subscribers enable row level security;
alter table public.channel_posts enable row level security;

-- channels: publicly discoverable; only the owner may create / mutate.
drop policy if exists "Channels are publicly readable" on public.channels;
create policy "Channels are publicly readable"
on public.channels for select
using (true);

drop policy if exists "Users can create own channels" on public.channels;
create policy "Users can create own channels"
on public.channels for insert
with check (auth.uid() = owner_id);

drop policy if exists "Owners can update own channels" on public.channels;
create policy "Owners can update own channels"
on public.channels for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Owners can delete own channels" on public.channels;
create policy "Owners can delete own channels"
on public.channels for delete
using (auth.uid() = owner_id);

-- channel_subscribers: a user manages only their OWN membership row.
drop policy if exists "Users can read own subscriptions" on public.channel_subscribers;
create policy "Users can read own subscriptions"
on public.channel_subscribers for select
using (auth.uid() = user_id);

drop policy if exists "Users can subscribe themselves" on public.channel_subscribers;
create policy "Users can subscribe themselves"
on public.channel_subscribers for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can unsubscribe themselves" on public.channel_subscribers;
create policy "Users can unsubscribe themselves"
on public.channel_subscribers for delete
using (auth.uid() = user_id);

-- channel_posts: readable by anyone (channels are public); only an owner/admin
-- of the channel may broadcast a post.
drop policy if exists "Channel posts are publicly readable" on public.channel_posts;
create policy "Channel posts are publicly readable"
on public.channel_posts for select
using (true);

drop policy if exists "Owners and admins can post" on public.channel_posts;
create policy "Owners and admins can post"
on public.channel_posts for insert
with check (
  auth.uid() = author_id
  and exists (
    select 1
    from public.channel_subscribers cs
    where cs.channel_id = channel_posts.channel_id
      and cs.user_id = auth.uid()
      and cs.role in ('owner', 'admin')
  )
);

drop policy if exists "Authors can delete own channel posts" on public.channel_posts;
create policy "Authors can delete own channel posts"
on public.channel_posts for delete
using (auth.uid() = author_id);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'channels'
    ) then
      alter publication supabase_realtime add table public.channels;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'channel_posts'
    ) then
      alter publication supabase_realtime add table public.channel_posts;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'channel_subscribers'
    ) then
      alter publication supabase_realtime add table public.channel_subscribers;
    end if;
  end if;
end
$$;
