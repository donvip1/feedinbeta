-- feedIn native stories schema for 24-hour story publishing.

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null,
  caption text,
  music_url text,
  music_title text,
  music_artist text,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.stories
add column if not exists caption text;

alter table public.stories
add column if not exists music_url text;

alter table public.stories
add column if not exists music_title text;

alter table public.stories
add column if not exists music_artist text;

alter table public.stories
alter column views_count set default 0;

update public.stories
set views_count = 0
where views_count is null;

alter table public.stories
alter column views_count set not null;

create table if not exists public.story_views (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint story_views_user_story_unique unique (story_id, user_id)
);

create table if not exists public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  constraint story_reactions_user_story_unique unique (story_id, user_id)
);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_reactions enable row level security;

create index if not exists stories_user_created_idx
on public.stories(user_id, created_at desc);

create index if not exists stories_expires_idx
on public.stories(expires_at);

create index if not exists story_views_story_created_idx
on public.story_views(story_id, created_at desc);

create index if not exists story_views_user_created_idx
on public.story_views(user_id, created_at desc);

create index if not exists story_reactions_story_created_idx
on public.story_reactions(story_id, created_at desc);

drop policy if exists "Authenticated users can read active stories" on public.stories;
drop policy if exists "Users can create own stories" on public.stories;
drop policy if exists "Users can update own stories" on public.stories;
drop policy if exists "Users can delete own stories" on public.stories;

create policy "Authenticated users can read active stories"
on public.stories for select
using (
  auth.uid() = user_id
  or (
    auth.uid() is not null
    and expires_at > now()
  )
);

create policy "Users can create own stories"
on public.stories for insert
with check (auth.uid() = user_id);

create policy "Users can update own stories"
on public.stories for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own stories"
on public.stories for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own story views" on public.story_views;
drop policy if exists "Story owners can read story views" on public.story_views;
drop policy if exists "Users can add own story views" on public.story_views;
drop policy if exists "Users can delete own story views" on public.story_views;

create policy "Users can read own story views"
on public.story_views for select
using (auth.uid() = user_id);

create policy "Story owners can read story views"
on public.story_views for select
using (
  exists (
    select 1
    from public.stories
    where stories.id = story_views.story_id
      and stories.user_id = auth.uid()
  )
);

create policy "Users can add own story views"
on public.story_views for insert
with check (auth.uid() = user_id);

create policy "Users can delete own story views"
on public.story_views for delete
using (auth.uid() = user_id);

drop policy if exists "Users can read own story reactions" on public.story_reactions;
drop policy if exists "Story owners can read story reactions" on public.story_reactions;
drop policy if exists "Users can add own story reactions" on public.story_reactions;
drop policy if exists "Users can update own story reactions" on public.story_reactions;
drop policy if exists "Users can delete own story reactions" on public.story_reactions;

create policy "Users can read own story reactions"
on public.story_reactions for select
using (auth.uid() = user_id);

create policy "Story owners can read story reactions"
on public.story_reactions for select
using (
  exists (
    select 1
    from public.stories
    where stories.id = story_reactions.story_id
      and stories.user_id = auth.uid()
  )
);

create policy "Users can add own story reactions"
on public.story_reactions for insert
with check (auth.uid() = user_id);

create policy "Users can update own story reactions"
on public.story_reactions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own story reactions"
on public.story_reactions for delete
using (auth.uid() = user_id);

create or replace function public.update_story_views_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stories
  set views_count = views_count + 1
  where id = new.story_id;
  return new;
end;
$$;

drop trigger if exists update_story_views_on_insert on public.story_views;
create trigger update_story_views_on_insert
after insert on public.story_views
for each row execute function public.update_story_views_count();

create or replace function public.delete_expired_stories()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.stories
  where expires_at <= now();
end;
$$;

create or replace view public.active_stories
with (security_invoker = true)
as
select
  stories.id,
  stories.user_id,
  stories.media_url,
  stories.media_type,
  stories.caption,
  stories.music_url,
  stories.music_title,
  stories.music_artist,
  stories.views_count,
  stories.created_at,
  stories.expires_at
from public.stories
where stories.expires_at > now();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'stories'
    ) then
      alter publication supabase_realtime add table public.stories;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'story_views'
    ) then
      alter publication supabase_realtime add table public.story_views;
    end if;
  end if;
end $$;
