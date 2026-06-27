-- feedIn native baseline: public profile search and chat helper RPCs.

create or replace view public.public_profiles as
select
  id,
  username,
  display_name,
  avatar_url,
  bio,
  followers_count,
  following_count,
  is_premium
from public.profiles;

create or replace function public.create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if other_user_id is null or other_user_id = current_user_id then
    raise exception 'invalid conversation participant';
  end if;

  select cp1.conversation_id
  into existing_conversation_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp2.conversation_id = cp1.conversation_id
  where cp1.user_id = current_user_id
    and cp2.user_id = other_user_id
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  insert into public.conversations default values
  returning id into new_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (new_conversation_id, current_user_id),
    (new_conversation_id, other_user_id);

  return new_conversation_id;
end;
$$;

create or replace function public.get_conversations_with_details(p_user_id uuid)
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_user_username text,
  other_user_display_name text,
  other_user_avatar_url text,
  last_message_content text,
  last_message_created_at timestamptz,
  updated_at timestamptz,
  unread_count integer
)
language sql
security definer
set search_path = public
as $$
  with user_conversations as (
    select c.id, c.updated_at
    from public.conversations c
    join public.conversation_participants cp
      on cp.conversation_id = c.id
    where cp.user_id = p_user_id
      and p_user_id = auth.uid()
  ),
  other_participants as (
    select
      uc.id as conversation_id,
      p.id as other_user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      uc.updated_at
    from user_conversations uc
    join public.conversation_participants cp
      on cp.conversation_id = uc.id
     and cp.user_id <> p_user_id
    join public.profiles p
      on p.id = cp.user_id
  ),
  last_messages as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.content,
      m.created_at
    from public.messages m
    join user_conversations uc on uc.id = m.conversation_id
    order by m.conversation_id, m.created_at desc
  )
  select
    op.conversation_id,
    op.other_user_id,
    op.username as other_user_username,
    op.display_name as other_user_display_name,
    op.avatar_url as other_user_avatar_url,
    lm.content as last_message_content,
    lm.created_at as last_message_created_at,
    coalesce(lm.created_at, op.updated_at) as updated_at,
    0::integer as unread_count
  from other_participants op
  left join last_messages lm on lm.conversation_id = op.conversation_id
  order by coalesce(lm.created_at, op.updated_at) desc;
$$;
