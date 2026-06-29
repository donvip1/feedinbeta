-- feedIn native messaging: fill the gaps between the live core schema
-- (20260624000100 / 000200 / 000300) and what the Flutter messaging client
-- needs at runtime. Everything here is additive and idempotent so it is safe to
-- apply whether or not the optional parity migration (20260627143100) was run.
--
-- The client reads read-state from conversation_participants.last_read_at,
-- message_read_receipts, and messages.is_read/read_at/status; it calls the RPCs
-- mark_conversation_read() and update_presence(). This migration guarantees
-- those contracts without exposing direct client UPDATE access to messages.

-- 1. Presence backing table (idempotent). update_presence() upserts into this.
create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'offline'
    check (status in ('online', 'active_now', 'away', 'offline')),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;

drop policy if exists "Presence is readable to authenticated users" on public.user_presence;
create policy "Presence is readable to authenticated users"
on public.user_presence for select
using (auth.uid() is not null);

drop policy if exists "Users can insert own presence" on public.user_presence;
create policy "Users can insert own presence"
on public.user_presence for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own presence" on public.user_presence;
create policy "Users can update own presence"
on public.user_presence for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 2. mark_conversation_read(): the client calls this when a conversation is
-- opened. It advances participant read position, records per-message receipts,
-- and marks incoming messages read through this security-definer path.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
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

  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'not a conversation participant';
  end if;

  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id
    and user_id = viewer_id;

  insert into public.message_read_receipts (message_id, user_id, conversation_id, read_at)
  select id, viewer_id, conversation_id, now()
  from public.messages
  where conversation_id = p_conversation_id
    and sender_id <> viewer_id
  on conflict (message_id, user_id)
  do update set read_at = excluded.read_at;

  update public.messages
  set is_read = true,
      read_at = coalesce(read_at, now()),
      status = 'read'
  where conversation_id = p_conversation_id
    and sender_id <> viewer_id
    and is_read = false;
end;
$$;

-- 3. update_presence(): the client pings this to publish online/away state.
create or replace function public.update_presence(p_status text default 'online')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_presence (user_id, status, last_seen_at, updated_at)
  values (
    auth.uid(),
    case
      when p_status in ('online', 'active_now', 'away', 'offline') then p_status
      else 'online'
    end,
    now(),
    now()
  )
  on conflict (user_id)
  do update set
    status = excluded.status,
    last_seen_at = excluded.last_seen_at,
    updated_at = excluded.updated_at;
$$;

-- 4. Recipients must be able to advance their own last_read_at via the RPC's
-- security-definer path; the base UPDATE policy on conversation_participants
-- already covers user_id = auth.uid(), so no extra message UPDATE policy is
-- needed here (read state never mutates the messages table).

grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.update_presence(text) to authenticated;

notify pgrst, 'reload schema';
