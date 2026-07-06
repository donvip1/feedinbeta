-- View-once & disappearing (timer) messages (Module 7 / W4 data foundation).
--
-- This migration is the SCHEMA foundation only: it adds the columns and RPCs
-- that view-once and WhatsApp-style disappearing messages need. No send-side
-- toggle or UI is wired here — later steps consume these fields.
--
-- View-once: messages.view_once marks a message that self-destructs the first
-- time the recipient opens it. mark_view_once_seen() stamps view_once_seen_at
-- and blanks the payload (content + any attachment url/path) so it can never be
-- re-fetched, mirroring how delete_message() in
-- 20260703030000_message_reactions_and_delete.sql blanks a soft-deleted body.
--
-- Disappearing: conversations.disappearing_seconds is a per-chat default timer
-- (0 = off). The send flow (added later) will stamp messages.expires_at =
-- now() + disappearing_seconds. purge_expired_messages() removes messages whose
-- expires_at has passed; it is intended to be driven by a scheduled job (see the
-- comment on that function).
--
-- Everything here is additive and idempotent (`if not exists`, `or replace`) so
-- it is safe to re-apply.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
-- messages.view_once: this message self-destructs on first recipient view.
alter table public.messages
  add column if not exists view_once boolean not null default false;

-- messages.expires_at: absolute expiry for disappearing messages (null = never).
alter table public.messages
  add column if not exists expires_at timestamptz;

-- messages.view_once_seen_at: when the recipient opened a view-once message.
alter table public.messages
  add column if not exists view_once_seen_at timestamptz;

-- conversations.disappearing_seconds: per-chat default timer, WhatsApp-style
-- (0 = off). The send flow stamps messages.expires_at from this value.
alter table public.conversations
  add column if not exists disappearing_seconds integer not null default 0;

-- Partial index: purge_expired_messages() scans by expires_at, and only rows
-- that actually carry an expiry are relevant.
create index if not exists messages_expires_at_idx
  on public.messages(expires_at)
  where expires_at is not null;

-- ---------------------------------------------------------------------------
-- mark_view_once_seen(): recipient-only. Stamp view_once_seen_at and blank the
-- payload so the one-time content can never be re-fetched. Caller must be a
-- conversation participant AND not the sender (the sender viewing their own
-- outbox must never burn the message for the recipient).
-- ---------------------------------------------------------------------------
create or replace function public.mark_view_once_seen(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  conv uuid;
  sender uuid;
  is_vo boolean;
  seen_at timestamptz;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  select conversation_id, sender_id, view_once, view_once_seen_at
    into conv, sender, is_vo, seen_at
    from public.messages
    where id = p_message_id;

  if conv is null then raise exception 'message not found'; end if;
  if not public.is_conversation_participant(conv) then
    raise exception 'not a participant';
  end if;
  if sender = uid then
    raise exception 'the sender cannot mark their own view-once message seen';
  end if;
  if not coalesce(is_vo, false) then
    raise exception 'message is not view-once';
  end if;

  -- Idempotent: if already seen, do not re-stamp or re-blank.
  if seen_at is not null then
    return;
  end if;

  -- Blank the message payload (content is NOT NULL on messages, so use '').
  update public.messages
    set view_once_seen_at = now(),
        content = '',
        updated_at = now()
    where id = p_message_id;

  -- Blank any attachment payload so the media can't be re-fetched either.
  update public.message_attachments
    set public_url = null,
        storage_path = '',
        deleted_at = coalesce(deleted_at, now())
    where message_id = p_message_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_disappearing_timer(): participant-only. Set the per-chat default timer
-- (seconds; 0 = off). Negative values are clamped to 0.
-- ---------------------------------------------------------------------------
create or replace function public.set_disappearing_timer(
  p_conversation_id uuid,
  p_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'not a participant';
  end if;

  update public.conversations
    set disappearing_seconds = greatest(coalesce(p_seconds, 0), 0),
        updated_at = now()
    where id = p_conversation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- purge_expired_messages(): soft-delete every message whose expires_at has
-- passed, reusing the existing messages.deleted_at tombstone + content blanking
-- (same shape as delete_message()). Returns the number of rows purged.
--
-- SCHEDULING: this is NOT self-triggering. It is intended to be invoked by a
-- scheduled job — either pg_cron (e.g. `select cron.schedule('purge-expired',
-- '* * * * *', $$select public.purge_expired_messages()$$);`) or an
-- edge-function cron. The cron is intentionally NOT set up in this migration.
-- Runs as service_role only; not granted to authenticated.
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged integer;
begin
  update public.messages
    set deleted_at = coalesce(deleted_at, now()),
        content = '',
        updated_at = now()
    where expires_at is not null
      and expires_at < now()
      and deleted_at is null;
  get diagnostics purged = row_count;

  -- Blank attachments for the messages we just purged.
  update public.message_attachments a
    set public_url = null,
        storage_path = '',
        deleted_at = coalesce(a.deleted_at, now())
    from public.messages m
    where a.message_id = m.id
      and m.expires_at is not null
      and m.expires_at < now();

  return purged;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.mark_view_once_seen(uuid) to authenticated, service_role;
grant execute on function public.set_disappearing_timer(uuid, integer) to authenticated, service_role;
-- purge is a maintenance job, not a client call.
grant execute on function public.purge_expired_messages() to service_role;

notify pgrst, 'reload schema';
