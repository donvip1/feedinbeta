-- Complete Telegram-style channels inside group conversations.

alter table public.channels
  add column if not exists group_conversation_id uuid
    references public.conversations(id) on delete cascade;

create index if not exists channels_group_conversation_idx
  on public.channels(group_conversation_id, updated_at desc)
  where group_conversation_id is not null;

create unique index if not exists channels_group_name_uidx
  on public.channels(group_conversation_id, lower(name))
  where group_conversation_id is not null;

drop policy if exists "Channels are publicly readable" on public.channels;
create policy "Channels are readable by their audience"
on public.channels for select
using (
  group_conversation_id is null
  or public.is_conversation_participant(group_conversation_id)
);

drop policy if exists "Users can create own channels" on public.channels;
create policy "Users can create eligible channels"
on public.channels for insert
with check (
  auth.uid() = owner_id
  and (
    group_conversation_id is null
    or public.is_conversation_participant(group_conversation_id)
  )
);

drop policy if exists "Users can subscribe themselves" on public.channel_subscribers;
create policy "Users can subscribe to eligible channels"
on public.channel_subscribers for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.channels c
    where c.id = channel_subscribers.channel_id
      and (
        c.group_conversation_id is null
        or public.is_conversation_participant(c.group_conversation_id)
      )
  )
);

drop policy if exists "Channel posts are publicly readable" on public.channel_posts;
create policy "Channel posts are readable by their audience"
on public.channel_posts for select
using (
  exists (
    select 1
    from public.channels c
    where c.id = channel_posts.channel_id
      and (
        c.group_conversation_id is null
        or public.is_conversation_participant(c.group_conversation_id)
      )
  )
);

create or replace function public.create_group_channel(
  p_group_conversation_id uuid,
  p_name text,
  p_description text default null
)
returns public.channels
language plpgsql
security invoker
set search_path = public
as $$
declare
  created_channel public.channels;
  normalized_name text;
  normalized_slug text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create a channel';
  end if;
  if p_group_conversation_id is null then
    raise exception 'A group conversation is required';
  end if;
  if not public.is_conversation_participant(p_group_conversation_id) then
    raise exception 'You must be a group member to create a channel';
  end if;
  if (
    select count(*) from public.conversation_participants
    where conversation_id = p_group_conversation_id
  ) < 3 then
    raise exception 'Channels require a group conversation';
  end if;

  normalized_name := left(nullif(btrim(p_name), ''), 80);
  if normalized_name is null then
    raise exception 'A channel name is required';
  end if;
  normalized_slug := lower(regexp_replace(normalized_name, '[^a-zA-Z0-9]+', '-', 'g'));
  normalized_slug := trim(both '-' from normalized_slug);
  if normalized_slug = '' then
    normalized_slug := 'channel-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  insert into public.channels (
    owner_id, name, slug, description, group_conversation_id
  ) values (
    auth.uid(), normalized_name, normalized_slug,
    nullif(btrim(coalesce(p_description, '')), ''),
    p_group_conversation_id
  ) returning * into created_channel;

  insert into public.channel_subscribers(channel_id, user_id, role)
  values (created_channel.id, auth.uid(), 'owner');

  return created_channel;
end;
$$;

revoke all on function public.create_group_channel(uuid, text, text) from public;
grant execute on function public.create_group_channel(uuid, text, text) to authenticated;
