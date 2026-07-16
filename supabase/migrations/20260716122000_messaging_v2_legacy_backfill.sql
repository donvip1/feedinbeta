-- FEEDIN Messaging V2: non-destructive group/channel backfill.
-- Existing feature tables remain live during the dual-write rollout.

-- Preserve IDs so existing group/channel routes can open the canonical
-- conversation directly. UUID collisions with an existing DM are skipped and
-- surfaced by the verification query at the end rather than overwritten.
insert into public.conversations (
  id,
  type,
  owner_id,
  title,
  description,
  avatar_path,
  settings,
  legacy_source_type,
  legacy_source_id,
  created_at,
  updated_at
)
select
  g.id,
  'group',
  g.created_by,
  g.name,
  nullif(g.description, ''),
  g.avatar_url,
  jsonb_build_object(
    'members_can_send', true,
    'members_can_start_calls', false,
    'disappearing_seconds', 0,
    'is_private', g.is_private
  ),
  'group',
  g.id,
  g.created_at,
  g.updated_at
from public.groups g
where not exists (select 1 from public.conversations c where c.id = g.id)
on conflict do nothing;

insert into public.conversations (
  id,
  type,
  owner_id,
  title,
  description,
  avatar_path,
  settings,
  legacy_source_type,
  legacy_source_id,
  created_at,
  updated_at
)
select
  channel.id,
  'channel',
  channel.owner_id,
  channel.name,
  nullif(channel.description, ''),
  channel.avatar_url,
  jsonb_build_object(
    'members_can_send', false,
    'members_can_start_calls', false,
    'disappearing_seconds', 0,
    'is_private', false
  ),
  'channel',
  channel.id,
  channel.created_at,
  channel.updated_at
from public.channels channel
where not exists (select 1 from public.conversations c where c.id = channel.id)
on conflict do nothing;

-- Existing memberships become canonical participant roles.
insert into public.conversation_participants (
  conversation_id,
  user_id,
  role,
  state,
  muted_until,
  joined_at,
  added_by
)
select
  gm.group_id,
  gm.user_id,
  case
    when gm.role in ('owner', 'admin', 'moderator', 'member') then gm.role
    else 'member'
  end,
  'active',
  gm.muted_until,
  gm.joined_at,
  gm.added_by
from public.group_members gm
join public.conversations c on c.id = gm.group_id and c.type = 'group'
on conflict (conversation_id, user_id) do update set
  role = excluded.role,
  state = 'active',
  muted_until = excluded.muted_until,
  joined_at = excluded.joined_at,
  added_by = excluded.added_by;

insert into public.conversation_participants (
  conversation_id,
  user_id,
  role,
  state,
  joined_at,
  added_by
)
select
  subscriber.channel_id,
  subscriber.user_id,
  case subscriber.role
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    else 'subscriber'
  end,
  'active',
  subscriber.created_at,
  channel.owner_id
from public.channel_subscribers subscriber
join public.channels channel on channel.id = subscriber.channel_id
join public.conversations c on c.id = subscriber.channel_id and c.type = 'channel'
on conflict (conversation_id, user_id) do update set
  role = excluded.role,
  state = 'active',
  joined_at = excluded.joined_at,
  added_by = excluded.added_by;

-- Defensive owner rows for legacy data that did not contain one.
insert into public.conversation_participants (
  conversation_id, user_id, role, state, joined_at, added_by
)
select c.id, c.owner_id, 'owner', 'active', c.created_at, c.owner_id
from public.conversations c
where c.type in ('group', 'channel')
  and c.owner_id is not null
on conflict (conversation_id, user_id) do update set
  role = 'owner',
  state = 'active';

-- Group messages become canonical messages. Legacy URLs are retained under a
-- `legacy-url` bucket marker until media is copied into `message-media`.
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
  created_at,
  updated_at,
  deleted_at
)
select
  gm.id,
  gm.group_id,
  gm.sender_id,
  gm.content,
  coalesce(gm.media_type, 'text'),
  case
    when gm.media_url is null and gm.storage_path is null then 'text'
    when lower(coalesce(gm.media_type, '')) like 'image%' then 'image'
    when lower(coalesce(gm.media_type, '')) like 'video%' then 'video'
    when lower(coalesce(gm.media_type, '')) like 'audio%' then 'voice'
    else 'file'
  end,
  case
    when gm.media_url is null and gm.storage_path is null then
      jsonb_build_object('text', coalesce(nullif(gm.content, ''), 'Message'))
    when lower(coalesce(gm.media_type, '')) like 'audio%' then
      jsonb_build_object(
        'media', jsonb_build_object(
          'bucket', coalesce(gm.storage_bucket, 'legacy-url'),
          'path', coalesce(gm.storage_path, gm.media_url),
          'mime_type', coalesce(nullif(gm.media_type, ''), 'audio/mp4'),
          'size_bytes', coalesce(gm.file_size, 0),
          'file_name', gm.file_name
        ),
        'waveform', '[]'::jsonb
      )
    else jsonb_strip_nulls(jsonb_build_object(
      'caption', nullif(gm.content, ''),
      'media', jsonb_build_object(
        'bucket', coalesce(gm.storage_bucket, 'legacy-url'),
        'path', coalesce(gm.storage_path, gm.media_url),
        'mime_type', coalesce(nullif(gm.media_type, ''), 'application/octet-stream'),
        'size_bytes', coalesce(gm.file_size, 0),
        'file_name', gm.file_name
      )
    ))
  end,
  gm.reply_to_id,
  'sent',
  jsonb_build_object(
    'schema_version', 1,
    'edited_at', gm.edited_at,
    'legacy_source', jsonb_build_object('type', 'group_message', 'id', gm.id)
  ),
  gm.created_at,
  gm.updated_at,
  gm.deleted_at
from public.group_messages gm
join public.conversations c on c.id = gm.group_id and c.type = 'group'
where not exists (select 1 from public.messages m where m.id = gm.id)
on conflict do nothing;

insert into public.message_pins (message_id, conversation_id, pinned_by, pinned_at)
select gm.id, gm.group_id, gm.sender_id, coalesce(gm.edited_at, gm.created_at)
from public.group_messages gm
join public.messages m on m.id = gm.id and m.conversation_id = gm.group_id
where gm.is_pinned
on conflict (message_id) do nothing;

-- Channel broadcasts are canonical read-only conversation messages.
insert into public.messages (
  id,
  conversation_id,
  sender_id,
  content,
  message_type,
  content_type,
  payload,
  status,
  metadata,
  created_at,
  updated_at
)
select
  post.id,
  post.channel_id,
  post.author_id,
  post.content,
  coalesce(post.media_type, 'text'),
  case
    when post.media_url is null then 'text'
    when lower(coalesce(post.media_type, '')) like 'image%' then 'image'
    when lower(coalesce(post.media_type, '')) like 'video%' then 'video'
    when lower(coalesce(post.media_type, '')) like 'audio%' then 'voice'
    else 'file'
  end,
  case
    when post.media_url is null then
      jsonb_build_object('text', coalesce(nullif(post.content, ''), 'Broadcast'))
    when lower(coalesce(post.media_type, '')) like 'audio%' then
      jsonb_build_object(
        'media', jsonb_build_object(
          'bucket', 'legacy-url',
          'path', post.media_url,
          'mime_type', coalesce(nullif(post.media_type, ''), 'audio/mp4'),
          'size_bytes', 0
        ),
        'waveform', '[]'::jsonb
      )
    else jsonb_strip_nulls(jsonb_build_object(
      'caption', nullif(post.content, ''),
      'media', jsonb_build_object(
        'bucket', 'legacy-url',
        'path', post.media_url,
        'mime_type', coalesce(nullif(post.media_type, ''), 'application/octet-stream'),
        'size_bytes', 0
      )
    ))
  end,
  'sent',
  jsonb_build_object(
    'schema_version', 1,
    'legacy_source', jsonb_build_object('type', 'channel_post', 'id', post.id),
    'view_count', post.view_count
  ),
  post.created_at,
  post.created_at
from public.channel_posts post
join public.conversations c on c.id = post.channel_id and c.type = 'channel'
where not exists (select 1 from public.messages m where m.id = post.id)
on conflict do nothing;

-- Pending legacy private-group requests now follow the approved paid workflow.
insert into public.conversation_join_requests (
  id,
  conversation_id,
  requester_id,
  source,
  status,
  estimated_cost,
  reviewed_at,
  created_at,
  updated_at
)
select
  request.id,
  request.group_id,
  request.user_id,
  'discovery',
  case request.status
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    else 'pending'
  end,
  50,
  case when request.status = 'pending' then null else request.updated_at end,
  request.created_at,
  request.updated_at
from public.group_join_requests request
join public.conversations c on c.id = request.group_id and c.type = 'group'
on conflict (conversation_id, requester_id) do nothing;

-- Make data migration gaps observable without blocking deployment. A non-zero
-- count indicates an improbable UUID collision requiring manual mapping.
create or replace view public.messaging_v2_backfill_gaps as
select 'group'::text as source_type, g.id as source_id
from public.groups g
left join public.conversations c on c.id = g.id and c.type = 'group'
where c.id is null
union all
select 'channel'::text, channel.id
from public.channels channel
left join public.conversations c on c.id = channel.id and c.type = 'channel'
where c.id is null;

revoke all on public.messaging_v2_backfill_gaps from public, anon, authenticated;
grant select on public.messaging_v2_backfill_gaps to service_role;

notify pgrst, 'reload schema';
