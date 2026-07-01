-- feedIn native parity hardening: fix realtime DO block syntax and tighten
-- profile/message/notification authorization added by the parity contracts.

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

  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and (
        p.user_id = viewer_id
        or (
          p.status = 'active'
          and (
            coalesce(p.privacy, 'everyone') = 'everyone'
            or (
              coalesce(p.privacy, 'everyone') = 'followers'
              and exists (
                select 1
                from public.follows f
                where f.follower_id = viewer_id
                  and f.following_id = p.user_id
              )
            )
            or (
              coalesce(p.privacy, 'everyone') = 'friends'
              and exists (
                select 1
                from public.follows f1
                join public.follows f2
                  on f2.follower_id = p.user_id
                 and f2.following_id = viewer_id
                where f1.follower_id = viewer_id
                  and f1.following_id = p.user_id
              )
            )
          )
        )
      )
  ) then
    raise exception 'post is not visible';
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
    and (
      p.user_id = auth.uid()
      or (
        p.status = 'active'
        and (
          coalesce(p.privacy, 'everyone') = 'everyone'
          or (
            coalesce(p.privacy, 'everyone') = 'followers'
            and exists (
              select 1
              from public.follows f
              where f.follower_id = auth.uid()
                and f.following_id = p.user_id
            )
          )
          or (
            coalesce(p.privacy, 'everyone') = 'friends'
            and exists (
              select 1
              from public.follows f1
              join public.follows f2
                on f2.follower_id = p.user_id
               and f2.following_id = auth.uid()
              where f1.follower_id = auth.uid()
                and f1.following_id = p.user_id
            )
          )
        )
      )
    )
  order by pvh.viewed_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

drop policy if exists "Recipients can mark received messages read" on public.messages;
drop policy if exists "Participants can update message read state" on public.messages;

drop policy if exists "Participants can update message attachment download state" on public.message_attachments;

create or replace function public.set_typing_indicator(
  p_conversation_id uuid,
  p_activity text default 'typing'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'not a conversation participant';
  end if;

  insert into public.typing_indicators (conversation_id, user_id, activity, updated_at)
  values (p_conversation_id, auth.uid(), coalesce(nullif(p_activity, ''), 'typing'), now())
  on conflict (conversation_id, user_id)
  do update set activity = excluded.activity, updated_at = excluded.updated_at;
end;
$$;

drop policy if exists "Authenticated users can create notifications" on public.notifications;
drop policy if exists "Users can create notifications for self" on public.notifications;
create policy "Users can create notifications for self"
on public.notifications for insert
with check (auth.uid() = user_id);

-- Re-run publication additions with valid PL/pgSQL block termination. These are
-- idempotent and repair environments where the earlier DO blocks failed.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'follows'
    ) then
      alter publication supabase_realtime add table public.follows;
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_attachments'
    ) then
      alter publication supabase_realtime add table public.message_attachments;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'message_read_receipts'
    ) then
      alter publication supabase_realtime add table public.message_read_receipts;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'typing_indicators'
    ) then
      alter publication supabase_realtime add table public.typing_indicators;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'user_presence'
    ) then
      alter publication supabase_realtime add table public.user_presence;
    end if;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
      alter publication supabase_realtime add table public.notifications;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'push_subscriptions'
    ) then
      alter publication supabase_realtime add table public.push_subscriptions;
    end if;
  end if;
end;
$$;
