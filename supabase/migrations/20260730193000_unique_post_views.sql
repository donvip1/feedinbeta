-- feedIn native: count authenticated users and anonymous app installations once
-- per post. Historical posts.views_count values are preserved as a floor.

create table if not exists public.anonymous_post_views (
  post_id uuid not null references public.posts(id) on delete cascade,
  device_hash text not null,
  viewed_at timestamptz not null default now(),
  primary key (post_id, device_hash),
  constraint anonymous_post_views_device_hash_format
    check (device_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists anonymous_post_views_viewed_idx
  on public.anonymous_post_views(viewed_at desc);

alter table public.anonymous_post_views enable row level security;

-- No policies are intentionally created. Clients cannot read or mutate this
-- table directly; the narrowly scoped security-definer RPC is the only path.
revoke all on table public.anonymous_post_views from anon, authenticated;

create or replace function public.record_post_view(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer_id uuid := auth.uid();
  inserted_rows integer := 0;
begin
  if viewer_id is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.status = 'active'
      and (
        coalesce(p.privacy, 'everyone') = 'everyone'
        or p.user_id = viewer_id
        or (
          p.privacy = 'followers'
          and exists (
            select 1 from public.follows f
            where f.follower_id = viewer_id
              and f.following_id = p.user_id
          )
        )
        or (
          p.privacy = 'friends'
          and exists (
            select 1 from public.follows f1
            join public.follows f2
              on f2.follower_id = p.user_id
             and f2.following_id = viewer_id
            where f1.follower_id = viewer_id
              and f1.following_id = p.user_id
          )
        )
      )
  ) then
    raise exception 'post is not visible';
  end if;

  insert into public.post_view_history (user_id, post_id, viewed_at, view_count)
  values (viewer_id, p_post_id, now(), 1)
  on conflict (user_id, post_id) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows > 0 then
    update public.posts
    set views_count = views_count + 1
    where id = p_post_id;
  end if;
  return;
end;
$$;

create or replace function public.record_anonymous_post_view(
  p_post_id uuid,
  p_device_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_hash text := lower(trim(p_device_hash));
  inserted_rows integer := 0;
begin
  if auth.uid() is not null then
    raise exception 'anonymous view RPC is only for signed-out viewers';
  end if;

  if normalized_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid anonymous device token';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.status = 'active'
      and coalesce(p.privacy, 'everyone') = 'everyone'
  ) then
    raise exception 'post is not visible';
  end if;

  insert into public.anonymous_post_views (post_id, device_hash)
  values (p_post_id, normalized_hash)
  on conflict (post_id, device_hash) do nothing;

  get diagnostics inserted_rows = row_count;
  if inserted_rows > 0 then
    update public.posts
    set views_count = views_count + 1
    where id = p_post_id;
    return true;
  end if;
  return false;
end;
$$;

grant execute on function public.record_post_view(uuid) to authenticated;
revoke execute on function public.record_post_view(uuid) from anon;
grant execute on function public.record_anonymous_post_view(uuid, text) to anon;
revoke execute on function public.record_anonymous_post_view(uuid, text)
  from authenticated;
