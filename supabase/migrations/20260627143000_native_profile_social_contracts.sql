-- feedIn native parity: profile social graph, social links, and view history.

alter table public.profiles
add column if not exists instagram_url text,
add column if not exists twitter_url text,
add column if not exists linkedin_url text,
add column if not exists facebook_url text,
add column if not exists tiktok_url text,
add column if not exists youtube_url text,
add column if not exists role text,
add column if not exists plan_tier text;

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_follower_idx
on public.follows(follower_id, created_at desc);

create index if not exists follows_following_idx
on public.follows(following_id, created_at desc);

alter table public.follows enable row level security;

drop policy if exists "Follows are publicly readable" on public.follows;
create policy "Follows are publicly readable"
on public.follows for select
using (true);

drop policy if exists "Users can follow as self" on public.follows;
create policy "Users can follow as self"
on public.follows for insert
with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow as self" on public.follows;
create policy "Users can unfollow as self"
on public.follows for delete
using (auth.uid() = follower_id);

create or replace function public.update_profile_follow_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set following_count = greatest(0, following_count + 1)
    where id = new.follower_id;

    update public.profiles
    set followers_count = greatest(0, followers_count + 1)
    where id = new.following_id;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set following_count = greatest(0, following_count - 1)
    where id = old.follower_id;

    update public.profiles
    set followers_count = greatest(0, followers_count - 1)
    where id = old.following_id;
  end if;

  return null;
end;
$$;

drop trigger if exists update_profile_follow_counts_trigger on public.follows;
create trigger update_profile_follow_counts_trigger
after insert or delete on public.follows
for each row execute function public.update_profile_follow_counts();

create table if not exists public.post_view_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  view_count integer not null default 1,
  unique (user_id, post_id)
);

create index if not exists post_view_history_user_viewed_idx
on public.post_view_history(user_id, viewed_at desc);

create index if not exists post_view_history_post_idx
on public.post_view_history(post_id);

alter table public.post_view_history enable row level security;

drop policy if exists "Users can read own post view history" on public.post_view_history;
create policy "Users can read own post view history"
on public.post_view_history for select
using (auth.uid() = user_id);

drop policy if exists "Users can record own post views" on public.post_view_history;
create policy "Users can record own post views"
on public.post_view_history for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own post views" on public.post_view_history;
create policy "Users can update own post views"
on public.post_view_history for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can clear own post view history" on public.post_view_history;
create policy "Users can clear own post view history"
on public.post_view_history for delete
using (auth.uid() = user_id);

create or replace function public.record_post_view(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.post_view_history (user_id, post_id, viewed_at, view_count)
  values (viewer_id, p_post_id, now(), 1)
  on conflict (user_id, post_id)
  do update set
    viewed_at = excluded.viewed_at,
    view_count = public.post_view_history.view_count + 1;

  update public.posts
  set views_count = views_count + 1
  where id = p_post_id;
end;
$$;

create or replace function public.clear_post_view_history()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.post_view_history
  where user_id = auth.uid();
$$;

create or replace function public.get_view_history(p_limit integer default 50)
returns table (
  post_id uuid,
  content text,
  media_url text,
  author_id uuid,
  author_name text,
  author_username text,
  author_avatar_url text,
  viewed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    p.id as post_id,
    p.content,
    coalesce(p.media_url, p.media_urls[1]) as media_url,
    prof.id as author_id,
    prof.display_name as author_name,
    prof.username as author_username,
    prof.avatar_url as author_avatar_url,
    pvh.viewed_at
  from public.post_view_history pvh
  join public.posts p on p.id = pvh.post_id
  join public.profiles prof on prof.id = p.user_id
  where pvh.user_id = auth.uid()
    and pvh.viewed_at >= now() - interval '48 hours'
  order by pvh.viewed_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace view public.public_profiles as
select
  id,
  username,
  display_name,
  avatar_url,
  bio,
  followers_count,
  following_count,
  is_premium,
  total_views,
  website_url,
  instagram_url,
  twitter_url,
  linkedin_url,
  facebook_url,
  tiktok_url,
  youtube_url,
  role,
  plan_tier
from public.profiles;

drop policy if exists "Followers privacy active posts are readable" on public.posts;
drop policy if exists "Privacy-aware active posts are readable" on public.posts;

create policy "Followers privacy active posts are readable"
on public.posts for select
using (
  auth.uid() = user_id
  or (
    status = 'active'
    and (
      coalesce(privacy, 'everyone') = 'everyone'
      or (
        coalesce(privacy, 'everyone') = 'followers'
        and exists (
          select 1
          from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = posts.user_id
        )
      )
      or (
        coalesce(privacy, 'everyone') = 'friends'
        and exists (
          select 1
          from public.follows f1
          join public.follows f2
            on f2.follower_id = posts.user_id
           and f2.following_id = auth.uid()
          where f1.follower_id = auth.uid()
            and f1.following_id = posts.user_id
        )
      )
    )
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'follows'
    ) then
      alter publication supabase_realtime add table public.follows;
    end if;
  end if;
end $$;
