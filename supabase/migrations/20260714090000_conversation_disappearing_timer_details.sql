-- Expose the per-conversation disappearing-message timer through the native
-- conversation-list RPC so Flutter can restore the saved timer when a thread
-- opens. The underlying column was added by 20260706000000_message_ephemeral.sql.
--
-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION to change OUT columns,
-- so the existing signature must be dropped before it is recreated. Supabase
-- applies each migration atomically, keeping the replacement all-or-nothing.

drop function if exists public.get_conversations_with_details(uuid);

create or replace function public.get_conversations_with_details(p_user_id uuid)
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_user_username text,
  other_user_display_name text,
  other_user_avatar_url text,
  other_user_presence text,
  other_user_last_seen_at timestamptz,
  disappearing_seconds integer,
  last_message_content text,
  last_message_created_at timestamptz,
  updated_at timestamptz,
  unread_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with user_conversations as (
    select
      c.id,
      c.updated_at,
      c.disappearing_seconds,
      cp.last_read_at
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
      up.status as presence_status,
      up.last_seen_at,
      uc.disappearing_seconds,
      uc.updated_at,
      uc.last_read_at
    from user_conversations uc
    join public.conversation_participants cp
      on cp.conversation_id = uc.id
     and cp.user_id <> p_user_id
    join public.profiles p
      on p.id = cp.user_id
    left join public.user_presence up
      on up.user_id = p.id
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
    coalesce(op.presence_status, 'offline') as other_user_presence,
    op.last_seen_at as other_user_last_seen_at,
    coalesce(op.disappearing_seconds, 0) as disappearing_seconds,
    lm.content as last_message_content,
    lm.created_at as last_message_created_at,
    coalesce(lm.created_at, op.updated_at) as updated_at,
    (
      select count(*)::integer
      from public.messages m
      where m.conversation_id = op.conversation_id
        and m.sender_id <> p_user_id
        and (
          op.last_read_at is null
          or m.created_at > op.last_read_at
        )
    ) as unread_count
  from other_participants op
  left join last_messages lm on lm.conversation_id = op.conversation_id
  order by coalesce(lm.created_at, op.updated_at) desc;
$$;

comment on function public.get_conversations_with_details(uuid) is
  'Returns the authenticated user''s conversation summaries, including the disappearing-message timer.';

-- Functions are executable by PUBLIC by default. Keep this security-definer
-- RPC unavailable to unauthenticated callers even though it also checks
-- p_user_id against auth.uid().
revoke all on function public.get_conversations_with_details(uuid) from public;
revoke all on function public.get_conversations_with_details(uuid) from anon;
grant execute on function public.get_conversations_with_details(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';
