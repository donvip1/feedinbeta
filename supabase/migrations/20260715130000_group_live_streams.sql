-- Group-conversation-scoped livestreams.
--
-- A stream belonging to a group conversation is visible only to that
-- conversation's participants. The scope column was introduced by
-- 20260630130000_native_live_pulse_features.sql.

create index if not exists live_streams_group_conversation_live_idx
  on public.live_streams(group_conversation_id, status, started_at desc)
  where group_conversation_id is not null;

drop policy if exists "Live streams are publicly readable" on public.live_streams;
drop policy if exists "Live streams are readable by audience" on public.live_streams;
create policy "Live streams are readable by audience"
on public.live_streams for select
using (
  group_conversation_id is null
  or public.is_conversation_participant(group_conversation_id)
);

drop policy if exists "Users can create own live streams" on public.live_streams;
drop policy if exists "Users can create own eligible live streams" on public.live_streams;
create policy "Users can create own eligible live streams"
on public.live_streams for insert
with check (
  auth.uid() = user_id
  and (
    group_conversation_id is null
    or public.is_conversation_participant(group_conversation_id)
  )
);

drop policy if exists "Users can update own live streams" on public.live_streams;
drop policy if exists "Users can update own eligible live streams" on public.live_streams;
create policy "Users can update own eligible live streams"
on public.live_streams for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    group_conversation_id is null
    or public.is_conversation_participant(group_conversation_id)
  )
);

create or replace function public.start_group_live_stream(
  p_group_conversation_id uuid,
  p_title text,
  p_description text default null
)
returns public.live_streams
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_stream public.live_streams;
  normalized_title text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to start a group livestream';
  end if;

  if p_group_conversation_id is null then
    raise exception 'A group is required to start this livestream';
  end if;

  if not exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_group_conversation_id
      and user_id = auth.uid()
  ) then
    raise exception 'You must be a group member to start a livestream';
  end if;

  if (
    select count(*)
    from public.conversation_participants
    where conversation_id = p_group_conversation_id
  ) < 3 then
    raise exception 'Group livestreams require a group conversation';
  end if;

  normalized_title := left(
    coalesce(nullif(btrim(p_title), ''), 'Group livestream'),
    120
  );

  insert into public.live_streams (
    user_id,
    group_conversation_id,
    title,
    description,
    stream_key,
    status,
    started_at
  ) values (
    auth.uid(),
    p_group_conversation_id,
    normalized_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    'group_' || replace(gen_random_uuid()::text, '-', ''),
    'live',
    now()
  )
  returning * into created_stream;

  return created_stream;
end;
$$;

revoke all on function public.start_group_live_stream(uuid, text, text) from public;
grant execute on function public.start_group_live_stream(uuid, text, text) to authenticated;
