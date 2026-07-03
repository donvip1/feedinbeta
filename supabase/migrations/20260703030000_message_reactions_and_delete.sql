-- Message reactions + soft delete for 1:1 and group chat (Module 5 polish).
--
-- Reactions: one row per (message, user, emoji). A toggle RPC adds/removes the
-- current user's reaction. Both are scoped to conversation participants via the
-- existing public.is_conversation_participant() helper.
-- Soft delete: messages.deleted_at + a delete_message RPC (author only) so a
-- deleted message can render as "This message was deleted" without a hard wipe.

-- ---------------------------------------------------------------------------
-- Reactions
-- ---------------------------------------------------------------------------
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "Participants can read reactions" on public.message_reactions;
create policy "Participants can read reactions"
  on public.message_reactions for select
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "Users can add own reactions" on public.message_reactions;
create policy "Users can add own reactions"
  on public.message_reactions for insert
  with check (
    auth.uid() = user_id
    and public.is_conversation_participant(conversation_id)
  );

drop policy if exists "Users can remove own reactions" on public.message_reactions;
create policy "Users can remove own reactions"
  on public.message_reactions for delete
  using (auth.uid() = user_id);

-- Toggle: removes the reaction if it already exists, otherwise adds it. Returns
-- true when the reaction is now present, false when it was removed.
create or replace function public.toggle_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  conv uuid;
  existing uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select conversation_id into conv from public.messages where id = p_message_id;
  if conv is null then raise exception 'message not found'; end if;
  if not public.is_conversation_participant(conv) then
    raise exception 'not a participant';
  end if;

  select id into existing from public.message_reactions
    where message_id = p_message_id and user_id = uid and emoji = p_emoji;

  if existing is not null then
    delete from public.message_reactions where id = existing;
    return false;
  else
    insert into public.message_reactions (message_id, conversation_id, user_id, emoji)
      values (p_message_id, conv, uid, p_emoji);
    return true;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Soft delete
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists deleted_at timestamptz;

create or replace function public.delete_message(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  sender uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select sender_id into sender from public.messages where id = p_message_id;
  if sender is null then raise exception 'message not found'; end if;
  if sender <> uid then raise exception 'only the author can delete this message'; end if;

  update public.messages
    set deleted_at = now(),
        content = '',
        updated_at = now()
    where id = p_message_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime + grants
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = 'message_reactions'
    ) then
      alter publication supabase_realtime add table public.message_reactions;
    end if;
  end if;
end
$$;

grant execute on function public.toggle_message_reaction(uuid, text) to authenticated, service_role;
grant execute on function public.delete_message(uuid) to authenticated, service_role;
