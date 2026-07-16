-- FEEDIN Messaging V2: canonical conversation/message contract.
--
-- This migration is deliberately non-destructive. Legacy content columns and
-- feature tables remain available while Flutter and React move to the shared
-- JSON envelope in contracts/messaging/message.schema.json.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Unified conversations and participant RBAC
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column if not exists type text not null default 'dm',
  add column if not exists owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists avatar_bucket text,
  add column if not exists avatar_path text,
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists external_context jsonb not null default '{}'::jsonb,
  add column if not exists legacy_source_type text,
  add column if not exists legacy_source_id uuid;

update public.conversations
set settings = jsonb_build_object(
  'members_can_send', true,
  'members_can_start_calls', false,
  'disappearing_seconds', coalesce(disappearing_seconds, 0),
  'is_private', false
) || coalesce(settings, '{}'::jsonb)
where not (
  settings ? 'members_can_send'
  and settings ? 'members_can_start_calls'
  and settings ? 'disappearing_seconds'
  and settings ? 'is_private'
);

alter table public.conversations
  drop constraint if exists conversations_type_check;
alter table public.conversations
  add constraint conversations_type_check
  check (type in ('dm', 'group', 'channel', 'external'));

create index if not exists conversations_type_updated_idx
  on public.conversations(type, updated_at desc);
create index if not exists conversations_owner_idx
  on public.conversations(owner_id) where owner_id is not null;
create unique index if not exists conversations_legacy_source_uidx
  on public.conversations(legacy_source_type, legacy_source_id)
  where legacy_source_type is not null and legacy_source_id is not null;

alter table public.conversation_participants
  add column if not exists role text not null default 'member',
  add column if not exists state text not null default 'active',
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists muted_until timestamptz,
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists left_at timestamptz,
  add column if not exists added_by uuid references public.profiles(id) on delete set null;

alter table public.conversation_participants
  drop constraint if exists conversation_participants_role_check;
alter table public.conversation_participants
  add constraint conversation_participants_role_check
  check (role in ('owner', 'admin', 'moderator', 'member', 'subscriber'));

alter table public.conversation_participants
  drop constraint if exists conversation_participants_state_check;
alter table public.conversation_participants
  add constraint conversation_participants_state_check
  check (state in ('active', 'invited', 'left', 'removed', 'banned'));

create index if not exists conversation_participants_user_state_idx
  on public.conversation_participants(user_id, state, joined_at desc);
create index if not exists conversation_participants_role_idx
  on public.conversation_participants(conversation_id, role)
  where state = 'active';

create or replace function public.is_conversation_participant(
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
      and cp.state = 'active'
  );
$$;

create or replace function public.conversation_role(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cp.role
  from public.conversation_participants cp
  where cp.conversation_id = p_conversation_id
    and cp.user_id = p_user_id
    and cp.state = 'active'
  limit 1;
$$;

create or replace function public.can_send_conversation_message(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.conversation_participants cp
      on cp.conversation_id = c.id
     and cp.user_id = p_user_id
     and cp.state = 'active'
    where c.id = p_conversation_id
      and (cp.muted_until is null or cp.muted_until <= now())
      and coalesce((cp.permissions ->> 'can_send')::boolean, true)
      and case c.type
        when 'channel' then cp.role in ('owner', 'admin')
        when 'group' then
          coalesce((c.settings ->> 'members_can_send')::boolean, true)
          or cp.role in ('owner', 'admin', 'moderator')
        else true
      end
  );
$$;

revoke all on function public.is_conversation_participant(uuid) from public;
revoke all on function public.conversation_role(uuid, uuid) from public;
revoke all on function public.can_send_conversation_message(uuid, uuid) from public;
grant execute on function public.is_conversation_participant(uuid) to authenticated, service_role;
grant execute on function public.conversation_role(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_send_conversation_message(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical message columns and legacy backfill
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists content_type text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists metadata jsonb not null default '{"schema_version":1}'::jsonb,
  add column if not exists revision bigint not null default 1;

update public.messages
set content_type = case lower(coalesce(message_type, 'text'))
  when 'image' then 'image'
  when 'video' then 'video'
  when 'audio' then 'voice'
  when 'voice' then 'voice'
  when 'music' then 'file'
  when 'file' then 'file'
  when 'sticker' then 'sticker'
  when 'gift' then 'gift'
  when 'call' then 'call'
  when 'call_log' then 'call'
  when 'system' then 'system'
  else 'text'
end
where content_type is null;

update public.messages
set payload = case content_type
  when 'text' then jsonb_build_object('text', coalesce(content, ''))
  when 'system' then jsonb_build_object(
    'event', 'legacy_message',
    'text', coalesce(nullif(content, ''), 'System message')
  )
  else jsonb_build_object(
    'caption', nullif(content, ''),
    'legacy_requires_media_migration', true
  )
end
where payload = '{}'::jsonb;

with first_attachment as (
  select distinct on (ma.message_id) ma.*
  from public.message_attachments ma
  where ma.deleted_at is null
    and nullif(ma.storage_path, '') is not null
  order by ma.message_id, ma.created_at, ma.id
)
update public.messages m
set payload = case m.content_type
  when 'voice' then jsonb_build_object(
    'media', jsonb_strip_nulls(jsonb_build_object(
      'bucket', a.storage_bucket,
      'path', a.storage_path,
      'mime_type', coalesce(a.mime_type, 'audio/mp4'),
      'size_bytes', coalesce(a.file_size_bytes, 0),
      'duration_ms', a.duration_ms,
      'thumbnail_path', a.thumbnail_url,
      'file_name', a.file_name
    )),
    'waveform', '[]'::jsonb
  )
  else jsonb_strip_nulls(jsonb_build_object(
    'caption', nullif(m.content, ''),
    'media', jsonb_strip_nulls(jsonb_build_object(
      'bucket', a.storage_bucket,
      'path', a.storage_path,
      'mime_type', coalesce(a.mime_type, 'application/octet-stream'),
      'size_bytes', coalesce(a.file_size_bytes, 0),
      'duration_ms', a.duration_ms,
      'thumbnail_path', a.thumbnail_url,
      'file_name', a.file_name
    ))
  ))
end
from first_attachment a
where m.content_type in ('image', 'video', 'voice', 'file')
  and a.message_id = m.id
  and (m.payload ->> 'legacy_requires_media_migration')::boolean is true;

update public.messages
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'schema_version', 1,
  'forwarded', coalesce(metadata -> 'forwarded', jsonb_build_object(
    'original_message_id', null,
    'original_sender_id', null,
    'original_sender_name', null,
    'original_created_at', null
  )),
  'ephemeral', jsonb_build_object(
    'view_once', coalesce(view_once, false),
    'viewed_at', view_once_seen_at,
    'expires_at', expires_at
  )
);

alter table public.messages alter column content_type set default 'text';
alter table public.messages alter column content_type set not null;
alter table public.messages drop constraint if exists messages_content_type_check;
alter table public.messages add constraint messages_content_type_check
  check (content_type in (
    'text', 'image', 'video', 'voice', 'file', 'sticker', 'gift', 'call', 'system'
  ));

create index if not exists messages_conversation_revision_idx
  on public.messages(conversation_id, revision, updated_at);
create index if not exists messages_conversation_page_idx
  on public.messages(conversation_id, created_at desc, id desc);
create index if not exists messages_reply_idx
  on public.messages(reply_to_id) where reply_to_id is not null;

create or replace function public.enforce_message_reply_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_conversation uuid;
begin
  if new.reply_to_id is null then return new; end if;
  select m.conversation_id into parent_conversation
  from public.messages m where m.id = new.reply_to_id;
  if parent_conversation is null or parent_conversation <> new.conversation_id then
    raise exception using errcode = '23514', message = 'INVALID_REPLY_TARGET';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_message_reply_conversation_trigger on public.messages;
create trigger enforce_message_reply_conversation_trigger
before insert or update of reply_to_id, conversation_id on public.messages
for each row execute function public.enforce_message_reply_conversation();

create or replace function public.bump_message_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists bump_message_revision_trigger on public.messages;
create trigger bump_message_revision_trigger
before update on public.messages
for each row execute function public.bump_message_revision();

-- Conversation-scoped pins are distinct from private per-user stars.
create table if not exists public.message_pins (
  message_id uuid primary key references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id) on delete cascade,
  pinned_at timestamptz not null default now()
);

alter table public.message_pins enable row level security;

drop policy if exists "Participants can read message pins" on public.message_pins;
create policy "Participants can read message pins"
on public.message_pins for select to authenticated
using (public.is_conversation_participant(conversation_id));

-- Dependent changes touch one parent row. Flutter then materializes that one
-- canonical envelope rather than reloading the whole conversation.
create or replace function public.touch_parent_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_message_id uuid;
begin
  target_message_id := case
    when tg_op = 'DELETE' then old.message_id
    else new.message_id
  end;
  update public.messages
  set updated_at = now()
  where id = target_message_id;
  return null;
end;
$$;

drop trigger if exists touch_message_from_reaction on public.message_reactions;
create trigger touch_message_from_reaction
after insert or update or delete on public.message_reactions
for each row execute function public.touch_parent_message();

drop trigger if exists touch_message_from_receipt on public.message_read_receipts;
create trigger touch_message_from_receipt
after insert or update or delete on public.message_read_receipts
for each row execute function public.touch_parent_message();

drop trigger if exists touch_message_from_star on public.message_stars;
create trigger touch_message_from_star
after insert or update or delete on public.message_stars
for each row execute function public.touch_parent_message();

drop trigger if exists touch_message_from_pin on public.message_pins;
create trigger touch_message_from_pin
after insert or update or delete on public.message_pins
for each row execute function public.touch_parent_message();

-- ---------------------------------------------------------------------------
-- Canonical message projection and idempotent send API
-- ---------------------------------------------------------------------------

create or replace function public.get_message_envelope(p_message_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_conversation_participant(m.conversation_id) then null
    else jsonb_build_object(
      'id', m.id,
      'conversation_id', m.conversation_id,
      'sender_id', m.sender_id,
      'content_type', m.content_type,
      'payload', case
        when m.deleted_at is not null then jsonb_build_object(
          'event', 'message_deleted',
          'text', 'This message was deleted'
        )
        else m.payload
      end,
      'reply_to_id', m.reply_to_id,
      'status', case
        when m.status in ('sent', 'delivered', 'read') then m.status
        else 'sent'
      end,
      'metadata', coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object(
        'schema_version', 1,
        'revision', m.revision,
        'forwarded', coalesce(m.metadata -> 'forwarded', jsonb_build_object(
          'original_message_id', null,
          'original_sender_id', null,
          'original_sender_name', null,
          'original_created_at', null
        )),
        'reactions', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'emoji', grouped.emoji,
              'count', grouped.reaction_count,
              'reacted_by_me', grouped.reacted_by_me
            ) order by grouped.emoji
          )
          from (
            select
              mr.emoji,
              count(*)::integer as reaction_count,
              bool_or(mr.user_id = auth.uid()) as reacted_by_me
            from public.message_reactions mr
            where mr.message_id = m.id
            group by mr.emoji
          ) grouped
        ), '[]'::jsonb),
        'pin', coalesce((
          select jsonb_build_object(
            'is_pinned', true,
            'pinned_by', mp.pinned_by,
            'pinned_at', mp.pinned_at
          )
          from public.message_pins mp where mp.message_id = m.id
        ), jsonb_build_object(
          'is_pinned', false,
          'pinned_by', null,
          'pinned_at', null
        )),
        'is_starred_by_me', exists (
          select 1 from public.message_stars ms
          where ms.message_id = m.id and ms.user_id = auth.uid()
        ),
        'receipts', jsonb_build_object(
          'delivered_count', (
            select count(*)::integer
            from public.message_read_receipts rr where rr.message_id = m.id
          ),
          'read_count', (
            select count(*)::integer
            from public.message_read_receipts rr where rr.message_id = m.id
          ),
          'read_by_me_at', (
            select rr.read_at
            from public.message_read_receipts rr
            where rr.message_id = m.id and rr.user_id = auth.uid()
          )
        ),
        'ephemeral', jsonb_build_object(
          'view_once', coalesce(m.view_once, false),
          'viewed_at', m.view_once_seen_at,
          'expires_at', m.expires_at
        ),
        'edited_at', m.metadata -> 'edited_at',
        'deleted_at', m.deleted_at
      ),
      'created_at', m.created_at,
      'updated_at', m.updated_at
    )
  end
  from public.messages m
  where m.id = p_message_id;
$$;

create or replace function public.get_message_page(
  p_conversation_id uuid,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_message_envelope(m.id)
  from public.messages m
  where m.conversation_id = p_conversation_id
    and public.is_conversation_participant(p_conversation_id)
    and (
      p_before_created_at is null
      or (m.created_at, m.id) < (p_before_created_at, coalesce(p_before_id, m.id))
    )
  order by m.created_at desc, m.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

create or replace function public.get_changed_message_envelopes(
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 100
)
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_message_envelope(m.id)
  from public.messages m
  join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id
   and cp.user_id = auth.uid()
   and cp.state = 'active'
  where p_after_updated_at is null
     or (m.updated_at, m.id) > (
       p_after_updated_at,
       coalesce(p_after_id, '00000000-0000-0000-0000-000000000000'::uuid)
     )
  order by m.updated_at, m.id
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

create or replace function public.send_message(p_message jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  target_id uuid;
  target_conversation uuid;
  target_sender uuid;
  target_type text;
  target_payload jsonb;
  target_reply uuid;
  compatibility_content text;
  compatibility_type text;
  existing public.messages;
begin
  if actor is null then
    raise exception using errcode = 'P0001', message = 'NOT_AUTHENTICATED';
  end if;

  begin
    target_id := (p_message ->> 'id')::uuid;
    target_conversation := (p_message ->> 'conversation_id')::uuid;
    target_sender := coalesce((p_message ->> 'sender_id')::uuid, actor);
    target_reply := nullif(p_message ->> 'reply_to_id', '')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'INVALID_MESSAGE_IDENTITY';
  end;

  target_type := lower(coalesce(p_message ->> 'content_type', 'text'));
  target_payload := coalesce(p_message -> 'payload', '{}'::jsonb);

  if target_sender <> actor then
    raise exception using errcode = '42501', message = 'INVALID_SENDER';
  end if;
  if target_type not in (
    'text', 'image', 'video', 'voice', 'file', 'sticker', 'gift', 'call', 'system'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_CONTENT_TYPE';
  end if;
  if target_type in ('gift', 'call', 'system') then
    raise exception using errcode = '42501', message = 'SERVER_OWNED_CONTENT_TYPE';
  end if;
  if not public.can_send_conversation_message(target_conversation, actor) then
    raise exception using errcode = '42501', message = 'NOT_AUTHORIZED';
  end if;
  if target_type = 'text' and nullif(btrim(target_payload ->> 'text'), '') is null then
    raise exception using errcode = '22023', message = 'EMPTY_MESSAGE';
  end if;
  if target_type in ('image', 'video', 'voice', 'file')
     and nullif(target_payload #>> '{media,path}', '') is null then
    raise exception using errcode = '22023', message = 'INVALID_MEDIA_PAYLOAD';
  end if;
  if target_reply is not null and not exists (
    select 1 from public.messages parent
    where parent.id = target_reply
      and parent.conversation_id = target_conversation
  ) then
    raise exception using errcode = '22023', message = 'INVALID_REPLY_TARGET';
  end if;

  select * into existing from public.messages where id = target_id;
  if existing.id is not null then
    if existing.sender_id <> actor
       or existing.conversation_id <> target_conversation then
      raise exception using errcode = '23505', message = 'MESSAGE_ID_CONFLICT';
    end if;
    return public.get_message_envelope(existing.id);
  end if;

  compatibility_content := case target_type
    when 'text' then target_payload ->> 'text'
    else coalesce(target_payload ->> 'caption', '')
  end;
  compatibility_type := case target_type
    when 'voice' then 'audio'
    else target_type
  end;

  insert into public.messages (
    id,
    conversation_id,
    sender_id,
    content,
    message_type,
    content_type,
    payload,
    reply_to_id,
    status,
    metadata,
    created_at
  ) values (
    target_id,
    target_conversation,
    actor,
    compatibility_content,
    compatibility_type,
    target_type,
    target_payload,
    target_reply,
    'sent',
    jsonb_build_object(
      'schema_version', 1,
      'forwarded', coalesce(p_message #> '{metadata,forwarded}', jsonb_build_object(
        'original_message_id', null,
        'original_sender_id', null,
        'original_sender_name', null,
        'original_created_at', null
      ))
    ),
    coalesce((p_message ->> 'created_at')::timestamptz, now())
  );

  return public.get_message_envelope(target_id);
end;
$$;

-- Replace permissive direct writes with role-aware checks. RPCs remain the
-- preferred write path and bypass RLS only after performing stricter checks.
drop policy if exists "Participants can send messages" on public.messages;
create policy "Authorized participants can send messages"
on public.messages for insert to authenticated
with check (
  auth.uid() = sender_id
  and public.can_send_conversation_message(conversation_id, auth.uid())
);

-- Keep the legacy DM RPC, but make the new type/role fields explicit.
create or replace function public.create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  existing_id uuid;
  created_id uuid;
begin
  if actor is null then raise exception 'not authenticated'; end if;
  if other_user_id is null or other_user_id = actor then
    raise exception 'invalid conversation participant';
  end if;

  select c.id into existing_id
  from public.conversations c
  join public.conversation_participants mine
    on mine.conversation_id = c.id and mine.user_id = actor and mine.state = 'active'
  join public.conversation_participants theirs
    on theirs.conversation_id = c.id and theirs.user_id = other_user_id and theirs.state = 'active'
  where c.type = 'dm'
  order by c.created_at
  limit 1;

  if existing_id is not null then return existing_id; end if;

  insert into public.conversations (type, settings)
  values ('dm', jsonb_build_object(
    'members_can_send', true,
    'members_can_start_calls', true,
    'disappearing_seconds', 0,
    'is_private', true
  ))
  returning id into created_id;

  insert into public.conversation_participants (
    conversation_id, user_id, role, state, added_by
  ) values
    (created_id, actor, 'member', 'active', actor),
    (created_id, other_user_id, 'member', 'active', actor);

  return created_id;
end;
$$;

revoke all on function public.get_message_envelope(uuid) from public, anon;
revoke all on function public.get_message_page(uuid, timestamptz, uuid, integer) from public, anon;
revoke all on function public.get_changed_message_envelopes(timestamptz, uuid, integer)
  from public, anon;
revoke all on function public.send_message(jsonb) from public, anon;
grant execute on function public.get_message_envelope(uuid) to authenticated, service_role;
grant execute on function public.get_message_page(uuid, timestamptz, uuid, integer) to authenticated, service_role;
grant execute on function public.get_changed_message_envelopes(timestamptz, uuid, integer)
  to authenticated, service_role;
grant execute on function public.send_message(jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
