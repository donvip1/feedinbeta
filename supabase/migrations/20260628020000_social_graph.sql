-- feedIn native: social graph (follow/followers) + profile social links.
--
-- Idempotent and additive. The `follows` table, the social-link columns, and
-- the follow-count trigger already ship in
-- `20260627143000_native_profile_social_contracts.sql`; this migration restates
-- them defensively (create/add ... if not exists) so the social-graph feature
-- is self-contained and survives out-of-order application. Table/column names
-- match the original web schema in `migrations_archive_lovable`
-- (`20251101123737_*.sql`): `follows(id, follower_id, following_id,
-- created_at)` with `unique(follower_id, following_id)` and
-- `check (follower_id <> following_id)`, plus the `*_url` social columns from
-- `20251113130046_*.sql`.

-- 1. Profile social-link columns (archive names, verbatim).
alter table public.profiles
  add column if not exists instagram_url text,
  add column if not exists twitter_url text,
  add column if not exists linkedin_url text,
  add column if not exists facebook_url text,
  add column if not exists tiktok_url text,
  add column if not exists youtube_url text;

-- 2. Follow graph. References public.profiles(id) (which itself references
--    auth.users) so PostgREST can embed the profile in follower/following reads.
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

-- 3. RLS policies (archive pattern: public read, self-scoped write/delete).
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

-- 4. Maintain profiles.followers_count / following_count on insert/delete,
--    clamped at zero. Mirrors the archive `update_follow_counts` trigger.
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

-- 5. Add the follow graph to the realtime publication (guarded).
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
end;
$$;

notify pgrst, 'reload schema';
