# FEEDIN Messaging V2 Architecture

Status: Foundation and database migrations deployed; client-renderer cutover
and remaining UX rollout are pending

Owners: Messaging, Mobile, Web, Platform, Wallet, and Realtime

## 0. Current Implementation Status

Implemented:

- canonical JSON schemas and matching React/Flutter models;
- additive Supabase migrations for conversations, messages, RBAC, paid group
  membership, approval requests, free explicit invitations, gifting, and call
  cards;
- the approved join rule: discovery and public-link requests require owner or
  administrator approval, and the applicant pays 50 credits on approval unless
  their premium subscription is active at that time;
- direct administrator additions, where the administrator pays 50 credits
  unless their premium subscription is active;
- a Flutter Hive projection, durable outbox, incremental message-ID realtime
  materialization, reconciliation cursor, and retry worker;
- canonical Flutter DM text rendering/offline sending plus canonical React DM
  page reads, message-ID realtime materialization, and idempotent text sends;
- a native-first Flutter DM interface with slate/sky inbox and thread surfaces,
  conversation/thread search, replies, mentions, emoji/sticker selection,
  canonical sticker sends, and a crop/rotate/filter/stamp/caption photo editor;
- premium-gated Flutter and React community creation, paid discovery/group-link
  request flows, join-request review UI, server-priced React chat gifting, and
  canonical LiveKit room authorization;
- legacy group creation and free self-join database paths are closed, while
  legacy join RPCs are compatibility-routed into canonical paid approval
  requests.

Pending rollout work:

- switch the remaining group, channel, external, and media-send paths from
  legacy message queries/writes to the canonical projection during the
  dual-read rollout;
- add canonical gift/call bubbles and gift controls to every Flutter composer;
- finish canonical media-descriptor uploads, bring crop/caption parity to
  React, and persist voice-waveform UX on both clients (Flutter's compatibility
  attachment path now includes the native photo editor and caption handling);
- remove legacy `message_attachments`, `group_messages`, and `channel_posts`
  reads only after production parity and backfill diagnostics are clean.

## 1. Objectives

Messaging V2 establishes one contract for React Web and Flutter. It replaces the
current split between `messages`, `message_attachments`, `group_messages`, and
`channel_posts` with a conversation-based model that supports DMs, groups,
channels, external/P2P contexts, gifts, and LiveKit call cards.

The implementation must provide:

- one canonical message envelope and one set of serialization rules;
- incremental, idempotent realtime updates rather than full-history reloads;
- durable offline sending with ordered retries;
- explicit identity checks using `sender_id == current_user.id`;
- server-enforced subscription, credit, membership, and role rules;
- the same message behavior and rendering on Flutter and React Web.

## 2. Non-Negotiable Design Decisions

1. Supabase is the remote source of truth. Hive is Flutter's durable local
   projection and outbox, not a competing message model.
2. The client generates the message UUID before local insertion. The same UUID
   is used remotely, making retries idempotent without a second client ID.
3. Clients may not insert paid gifts, add paid group members, create groups, or
   start calls by writing tables directly. Security-definer RPCs perform the
   authorization, wallet mutation, and record creation in one transaction.
4. Media metadata lives in `messages.payload`. `message_attachments` becomes a
   legacy migration source and is removed from active client logic.
5. Reactions and receipts remain relational write models because many users can
   update them concurrently. The canonical message JSON includes their
   server-computed projection in `metadata`; clients never overwrite the whole
   reaction or receipt collection.
6. `sending` is a user-facing delivery status. Flutter additionally stores a
   local-only `sync_state` (`pending`, `syncing`, `synced`, or `failed`) for the
   offline worker.
7. `user_subscriptions.current_period_end` is the subscription expiry source of
   truth. We will not introduce a duplicate `subscription_end_date` column.
8. `profiles.is_premium` is not authoritative for paid operations. It may remain
   a display cache, but group creation and fee waivers call the authoritative
   premium function.

## 3. Canonical Conversation Model

All chat-like products use `conversations` and `conversation_participants`.

### 3.1 Conversation

```json
{
  "id": "uuid",
  "type": "dm | group | channel | external",
  "owner_id": "uuid|null",
  "title": "string|null",
  "description": "string|null",
  "avatar": {
    "bucket": "conversation-media",
    "path": "conversation-id/avatar.webp"
  },
  "settings": {
    "members_can_send": true,
    "members_can_start_calls": false,
    "disappearing_seconds": 0,
    "is_private": false
  },
  "external_context": {
    "type": "p2p_trade|null",
    "id": "uuid|null"
  },
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

Behavior by type:

| Type | Membership | Send permission | Call start permission |
| --- | --- | --- | --- |
| `dm` | Exactly two active participants | Both participants | Both participants |
| `group` | Owner, admins, moderators, members | Active members unless muted | Owner/admin by default; optionally members via settings |
| `channel` | Owner, admins, subscribers | Owner/admin only | Owner/admin only; subscribers may join |
| `external` | Participants derived from the linked context | Context policy | Context policy, normally disabled |

### 3.2 Participant and RBAC

```json
{
  "conversation_id": "uuid",
  "user_id": "uuid",
  "role": "owner | admin | moderator | member | subscriber",
  "state": "active | invited | left | removed | banned",
  "permissions": {
    "can_send": null,
    "can_add_members": null,
    "can_remove_members": null,
    "can_manage_settings": null,
    "can_start_calls": null
  },
  "last_read_at": "ISO-8601|null",
  "muted_until": "ISO-8601|null",
  "joined_at": "ISO-8601"
}
```

Role defaults are evaluated server-side. Permission overrides are nullable:
`null` means use the role/type default, while `true` or `false` is an explicit
override.

| Action | Owner | Admin | Moderator | Member | Subscriber |
| --- | --- | --- | --- | --- | --- |
| Update group/channel settings | Yes | Yes | No | No | No |
| Assign/remove administrator | Yes | No | No | No | No |
| Add members | Yes | Yes | No | No | No |
| Remove members | Yes | Yes, except owner/admin | Yes, members only | No | No |
| Send in group | Yes | Yes | Yes | Yes | N/A |
| Broadcast in channel | Yes | Yes | No | No | No |
| Start group/channel call | Yes | Yes | No by default | No by default | No |
| Join active call | Yes | Yes | Yes | Yes | Yes |

## 4. Canonical Message Schema

Every API response, realtime materialization, Hive record, and React model uses
this envelope. Timestamps are UTC ISO-8601 strings on the wire and epoch
milliseconds only inside platform-specific indexes.

```json
{
  "id": "uuid",
  "conversation_id": "uuid",
  "sender_id": "uuid",
  "content_type": "text | image | video | voice | file | sticker | gift | call | system",
  "payload": {},
  "reply_to_id": "uuid|null",
  "status": "sending | sent | delivered | read",
  "metadata": {
    "schema_version": 1,
    "revision": 1,
    "reactions": [
      {
        "emoji": "heart",
        "count": 2,
        "reacted_by_me": true
      }
    ],
    "pin": {
      "is_pinned": false,
      "pinned_by": null,
      "pinned_at": null
    },
    "is_starred_by_me": false,
    "forwarded": {
      "original_message_id": "uuid|null",
      "original_sender_id": "uuid|null",
      "original_sender_name": "string|null",
      "original_created_at": "ISO-8601|null"
    },
    "receipts": {
      "delivered_count": 0,
      "read_count": 0,
      "read_by_me_at": null
    },
    "ephemeral": {
      "view_once": false,
      "viewed_at": null,
      "expires_at": null
    },
    "edited_at": null,
    "deleted_at": null
  },
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

### 4.1 Field Rules

- `id`: client-generated UUID. Supabase rejects a retry only when the same ID
  belongs to a different sender or conversation.
- `sender_id`: immutable and always compared directly to the authenticated user
  ID. Display names must never determine ownership or bubble alignment.
- `content_type`: controls payload validation and bubble dispatch.
- `payload`: content-specific JSON. Unknown keys must be preserved for forward
  compatibility, but each known type is validated by the send RPC.
- `reply_to_id`: references another message in the same conversation.
- `status`: `sending` exists locally; the server persists `sent`, `delivered`,
  or `read`. For groups/channels the returned value is derived for the current
  viewer from receipt counts, not changed to `read` after only one user reads.
- `metadata.revision`: monotonically increases whenever the message or any
  projected reaction, receipt, pin, gift, or call state changes.
- `metadata.reactions`, `pin`, `is_starred_by_me`, and `receipts` are
  server-computed. Clients mutate them through narrow RPCs.
- A deleted message remains as a tombstone with `metadata.deleted_at` set and a
  sanitized payload so replies and timeline order remain stable.

### 4.2 Payload Contracts

Text:

```json
{
  "text": "Hello"
}
```

Image:

```json
{
  "caption": "Optional caption",
  "media": {
    "bucket": "message-media",
    "path": "conversation-id/sender-id/message-id.webp",
    "mime_type": "image/webp",
    "width": 1080,
    "height": 1350,
    "size_bytes": 248321,
    "thumbnail_path": "conversation-id/sender-id/message-id-thumb.webp",
    "blur_hash": "string|null"
  }
}
```

Video:

```json
{
  "caption": "Optional caption",
  "media": {
    "bucket": "message-media",
    "path": "conversation-id/sender-id/message-id.mp4",
    "mime_type": "video/mp4",
    "width": 1080,
    "height": 1920,
    "duration_ms": 18400,
    "size_bytes": 8248321,
    "thumbnail_path": "conversation-id/sender-id/message-id-thumb.webp"
  }
}
```

Voice:

```json
{
  "media": {
    "bucket": "message-media",
    "path": "conversation-id/sender-id/message-id.m4a",
    "mime_type": "audio/mp4",
    "duration_ms": 9400,
    "size_bytes": 184321
  },
  "waveform": [0.08, 0.24, 0.71, 0.43]
}
```

Gift:

```json
{
  "gift_id": "uuid",
  "catalog_item_id": "uuid",
  "name": "Diamond",
  "asset_key": "diamond",
  "credit_cost": 100,
  "recipient_credit_value": 90,
  "platform_fee_credits": 10,
  "recipient_id": "uuid",
  "state": "sent | converted | refunded"
}
```

LiveKit call:

```json
{
  "call_id": "uuid",
  "call_kind": "audio | video",
  "room_name": "feedin-conversation-call-uuid",
  "state": "scheduled | ringing | active | ended | cancelled",
  "host_id": "uuid",
  "started_at": "ISO-8601|null",
  "ended_at": "ISO-8601|null",
  "participant_count": 0,
  "joinable": true
}
```

The LiveKit token and secrets are never stored in the message payload. The Join
Call action requests a short-lived token after the server rechecks membership
and role.

### 4.3 Local-Only Flutter Envelope

Flutter stores the canonical object plus private outbox fields. `_local` is
never sent to Supabase or React.

```json
{
  "message": { "canonical": "message envelope above" },
  "_local": {
    "sync_state": "pending | syncing | synced | failed",
    "local_asset_path": "string|null",
    "attempt_count": 0,
    "next_attempt_at": "ISO-8601|null",
    "last_error_code": "string|null"
  }
}
```

## 5. Canonical Server API

Clients use the same RPCs and generated types:

- `get_conversation_page(cursor, limit)` returns conversation envelopes.
- `get_message_page(conversation_id, before_cursor, limit)` returns canonical
  message envelopes.
- `get_message_envelope(message_id)` fetches one fully projected message.
- `send_message(message_json)` validates membership, type, reply, payload,
  status, storage ownership, and idempotency.
- `mark_messages_delivered(conversation_id, message_ids)` and
  `mark_conversation_read(conversation_id, through_message_id)` update receipts.
- `toggle_message_reaction(message_id, reaction_key)`,
  `set_message_pin(message_id, pinned)`, and `toggle_message_star(message_id)`
  mutate only their scoped state.
- `create_group_conversation(...)`, `add_conversation_member(...)`,
  `set_conversation_member_role(...)`, and `remove_conversation_member(...)`
  enforce premium, wallet, and RBAC rules.
- `send_chat_gift(...)` atomically creates the gift, wallet entries, and gift
  message.
- `start_conversation_call(...)` atomically creates the call and call message.

The TypeScript and Dart models will be generated from the same JSON Schema in
`contracts/messaging/message.schema.json`; hand-maintained duplicate interfaces
are prohibited after cutover.

## 6. Incremental Flutter Sync Service

### 6.1 Local Stores

Use separate Hive boxes/indexes for:

- canonical messages keyed by message UUID;
- conversations keyed by conversation UUID;
- outbox entries keyed by message UUID;
- sync cursors keyed by user/conversation;
- staged media keyed by message UUID.

Conversation lists query summary records. Opening a thread queries its local
message index and never waits for a network response.

### 6.2 Bootstrap Without Event Gaps

1. Authenticate and load cached conversations/messages immediately.
2. Subscribe to the user's authorized message-change stream.
3. Record the subscription start timestamp/revision.
4. Fetch changed conversations and messages after the stored cursor in pages.
5. Apply pages with idempotent upserts.
6. Apply realtime events buffered during catch-up.
7. Advance the cursor only after the Hive transaction commits.

Subscribing before catch-up prevents a message arriving between the initial
query and realtime connection from being missed.

### 6.3 Applying a Realtime Event

Every dependent reaction, receipt, pin, gift, or call mutation touches the
parent message and increments `metadata.revision`. This lets clients use the
message stream as the single invalidation stream.

For each INSERT/UPDATE:

1. Reject events for conversations not authorized to the current user.
2. Compare `(revision, updated_at)` with the cached message.
3. Ignore duplicates or stale events.
4. If the row contains a complete canonical envelope, use it directly;
   otherwise call `get_message_envelope(message_id)` once.
5. Upsert that message and its conversation summary in one Hive transaction.
6. Notify only the affected conversation and inbox row.
7. If the open thread is visible and the message is incoming, enqueue delivered
   and read receipt updates without reloading history.

For DELETE, remove the local record only for a genuine hard delete. Normal user
deletion is a tombstone UPDATE.

### 6.4 Offline Outbox

When the user sends while offline:

1. Generate the final message UUID.
2. Validate content locally and persist the canonical message with
   `status = sending` and `_local.sync_state = pending`.
3. Persist/stage media under the message UUID.
4. Update the local conversation preview and render the bubble immediately.
5. Trigger the outbox worker when connectivity returns, on app resume, after a
   successful authentication refresh, and through an OS background task.
6. For media, upload/transform the asset first, then replace the local media
   path with the canonical storage descriptor.
7. Call `send_message` with the client-generated UUID.
8. On success, apply the returned canonical envelope and remove the outbox row.
9. On transient failure, retry with exponential backoff plus jitter.
10. On permanent validation/permission failure, set the local sync state to
    `failed` and expose Retry/Delete actions.

The worker serializes messages within each conversation to preserve user order,
while allowing different conversations to sync concurrently. Android
WorkManager and iOS background processing are best-effort; connectivity and app
resume triggers provide the reliable foreground path.

### 6.5 Reconciliation

Realtime is a latency mechanism, not the only correctness mechanism. A small
cursor-based reconciliation runs on reconnect, app resume, and periodically
while active. It fetches only rows changed after the cursor. A manual diagnostic
may rebuild one conversation, but normal events must never call `refreshAll()`.

### 6.6 Incremental Sync Test Matrix

- duplicate INSERT and UPDATE events do not duplicate messages;
- out-of-order revisions do not overwrite newer data;
- offline text and media messages survive process death and send once;
- retry after a successful remote insert is idempotent;
- reaction/receipt/pin changes refresh one message only;
- reconnect catch-up fills events missed while disconnected;
- revoked membership removes access and stops further sync;
- 10,000-message threads open from local pagination without a full remote load;
- sender alignment always uses `sender_id == current_user.id`;
- DM, group, channel, gift, call, forwarded, reply, and tombstone payloads map
  identically in Dart and TypeScript fixtures.

## 7. Professional FEEDIN UX Plan

### 7.1 Inbox

- One inbox shell with filters for DMs, Groups, Channels, Unread, and Archived.
- Local-first search with server pagination for older results.
- Consistent unread, muted, pinned, typing, call, gift, and delivery previews.
- Premium gates appear before group creation, with a direct subscription CTA.

### 7.2 Composer

- WhatsApp-style attachment sheet backed by native gallery/camera/file pickers.
- Image flow: select, crop, resize/compress, preview, enter caption, confirm,
  then create the optimistic message and upload.
- Video flow: select, validate duration/size, generate thumbnail, preview and
  caption, then confirm.
- Persistent voice-note mode with elapsed time, live waveform, pause/resume,
  cancel, preview, and send.
- Gift button loads the server gift catalog and current wallet balance.
- Channel subscribers see a read-only composer; owners/admins see broadcast
  controls.

### 7.3 Message Bubble

One dispatcher renders modular text, image, video, voice, file, sticker, gift,
call, system, and deleted-message bodies. A common shell owns alignment,
reply/forward headers, reactions, timestamp, delivery state, selection, and
actions. The sole ownership expression is:

```text
isMine = message.sender_id == currentUser.id
```

### 7.4 Calls

- Starting a call uses `start_conversation_call`; it never directly inserts a
  client-authored call message.
- The RPC evaluates the conversation role/settings and creates both the call
  and `content_type = call` message atomically.
- Join Call requests a short-lived LiveKit token from the existing token edge
  function after membership is revalidated.
- Realtime call status touches the call message revision so both clients update
  the same bubble incrementally.

## 8. Database Schema Modification Plan

No migration should be applied until this section is approved.

### Phase DB-1: Add the Unified Conversation Contract

Extend `conversations` with:

- `type text not null` constrained to `dm`, `group`, `channel`, `external`;
- `owner_id uuid null`;
- `title`, `description`, `avatar_bucket`, and `avatar_path`;
- `settings jsonb not null default '{}'`;
- `external_context jsonb not null default '{}'`;
- indexes on `(type, updated_at desc)` and `owner_id`.

Extend `conversation_participants` with:

- `role`, `state`, and `permissions jsonb`;
- `muted_until`, `joined_at`, `left_at`, and `added_by`;
- constraints for valid roles/states and one active membership per user;
- indexes for inbox pagination and role checks.

Backfill existing DMs as `dm`. Create conversation rows for every existing
group and channel while preserving their current IDs where possible.

### Phase DB-2: Add the Canonical Message Columns

Extend `messages` with:

- `content_type text` with the canonical type constraint;
- `payload jsonb not null default '{}'`;
- `reply_to_id uuid null references messages(id)` with a trigger enforcing the
  same conversation;
- `metadata jsonb not null default '{"schema_version":1}'`;
- `revision bigint not null default 1`;
- `deleted_at timestamptz null` if not already present.

Keep the legacy `content`, `message_type`, and attachment fields during a
dual-read transition. New clients write only through `send_message`.

Backfill rules:

- text `content` -> `payload.text`;
- web `media_url/media_type` -> canonical media payload;
- `message_attachments` -> canonical media payload with bucket/path/metadata;
- `group_messages` -> `messages` under the group's conversation;
- `channel_posts` -> `messages` under the channel conversation;
- existing reply, pin, forward, ephemeral, edit, and delete state -> canonical
  columns/metadata.

After both clients pass parity tests, make legacy tables/views read-only, remove
active client dependencies, retain compatibility views for one release, and
only then schedule destructive cleanup.

### Phase DB-3: Canonical Projection and Realtime Revisioning

Create `get_message_envelope(uuid)` and paginated message/conversation RPCs.
Their JSON output is contract-tested against the shared schema.

Add triggers so changes to `message_reactions`, `message_read_receipts`, pins,
stars, gifts, and calls increment the parent `messages.revision` and
`updated_at`. Publish `messages` and membership changes through Supabase
Realtime with RLS. Clients receive a message ID/revision and materialize only
that message.

### Phase DB-4: Authoritative Premium Status

Retain `user_subscriptions.current_period_end`; it already represents the
requested subscription end date. Add/replace:

```text
has_active_premium(user_id, at_time = now()) =
  status = 'active'
  AND current_period_start <= at_time
  AND current_period_end > at_time
  AND tier is active
```

For new paid operations, a null `current_period_end` is not considered active.
Provider webhooks must update subscription status and period dates. Expiry
requires no scheduled downgrade: the function automatically stops returning
true after `current_period_end`.

### Phase DB-5: Premium Group Creation and Member Charges

Create `create_group_conversation(...)` as the only group creation path. It:

1. requires `has_active_premium(auth.uid())`;
2. creates the conversation and owner membership atomically;
3. returns a canonical conversation envelope;
4. returns a stable `PREMIUM_REQUIRED` error for subscription UI routing.

Create `conversation_member_charges`:

| Column | Purpose |
| --- | --- |
| `id` | Charge UUID |
| `idempotency_key` | Prevent duplicate charges on retry |
| `conversation_id` | Target group |
| `actor_id` | Admin adding the member and paying the fee |
| `member_id` | User being added |
| `base_cost` | Configured cost, initially 50 |
| `charged_credits` | 0 for premium, otherwise 50 |
| `waiver_reason` | `active_premium` or null |
| `subscription_id` | Premium subscription used for the waiver |
| `balance_before/after` | Audit values for charged additions |
| `created_at` | Audit timestamp |

Create a server-owned monetization setting `group_member_add_cost = 50`; do not
hard-code the fee in clients.

Create `add_conversation_member(...)` as the only admin-add path. In one
transaction it:

1. locks the conversation, membership target, and actor wallet;
2. verifies the actor is owner/admin and the target is not already active;
3. checks premium at transaction time;
4. charges 0 while premium or atomically deducts 50 credits after expiry;
5. writes a negative `credit_transactions` entry when charged;
6. writes `conversation_member_charges` even when waived;
7. inserts the membership and returns the participant envelope.

Direct participant inserts are revoked except server migration/service roles.
The paying user is the administrator who performs a direct addition. A user who
discovers a group or follows a public group link must submit a join request;
owner/admin approval atomically charges that joining user the configured fee
(or records their active-premium waiver) before membership is created. An
explicit owner/admin invitation can still be accepted without a credit charge.

### Phase DB-6: Group RBAC

Create role-aware RPCs and enforce the matrix in Section 3:

- `set_conversation_member_role` allows only owners to grant/revoke admin;
- `remove_conversation_member` prevents removing the owner and prevents admins
  from removing other admins;
- `update_conversation_settings` allows owner/admin;
- `transfer_conversation_ownership` requires explicit owner confirmation;
- channel send policies accept only owner/admin;
- group send policies require an active, unmuted membership.

RLS remains defense in depth, but sensitive changes go through RPCs to produce
consistent audit records.

### Phase DB-7: Integrated Chat Gifting

Create `gift_catalog` as the server-owned catalog with stable key, name, asset,
credit cost, recipient percentage/value, active flag, and display order. Remove
hard-coded prices from React and Flutter.

Create `chat_gifts` with sender, recipient, conversation, message, catalog item,
immutable price snapshot, platform fee, state, conversion/refund timestamps,
and idempotency key.

Create `send_chat_gift(...)`. It validates conversation participation and the
recipient, locks/deducts `user_credits`, writes credit ledger entries, creates
the gift record, and creates the canonical gift message in one transaction.
Insufficient balance rolls back everything. Existing gift conversion logic can
consume `chat_gifts`; `gift_analytics` becomes a reporting projection rather
than the financial source of truth.

DMs, groups, channels, and external conversations use this same RPC and bubble.
Channel gifting is allowed to the channel owner/creator unless a specific live
recipient is supplied by an authorized broadcast context.

### Phase DB-8: Conversation Calls and LiveKit Authorization

Create or adapt a canonical conversation-call record with `conversation_id`,
`host_id`, kind, state, LiveKit room name, timestamps, settings, and linked
message ID. Backfill current DM/group call logs where a conversation can be
resolved.

`start_conversation_call(...)` checks:

- DM: caller is an active participant;
- group: caller is owner/admin unless `members_can_start_calls` is enabled;
- channel: caller is owner/admin;
- external: linked context explicitly enables calls.

The existing `livekit-token` edge function must accept a call ID, derive the
conversation and role server-side, and issue publish grants only to authorized
speakers/hosts. Join-only members/subscribers receive subscribe grants. Call
state changes increment the linked call-message revision.

### Phase DB-9: Audit, RLS, Rollout, and Rollback

- Add audit records for group creation attempts, membership charges/waivers,
  role changes, removals, gifts, refunds, and call starts.
- Use stable machine error codes: `PREMIUM_REQUIRED`, `INSUFFICIENT_CREDITS`,
  `NOT_AUTHORIZED`, `ALREADY_MEMBER`, and `CALL_NOT_JOINABLE`.
- Generate TypeScript and Dart models from the shared schema in CI.
- Run backfill in batches with counts/checksums before switching reads.
- Dual-read old/new projections in shadow mode and compare envelopes.
- Enable new writes behind server-controlled feature flags.
- Roll Flutter and Web independently, then disable legacy writes.
- Preserve compatibility views and reversible columns until at least one stable
  production release confirms parity.

## 9. Implementation Sequence

1. Approve this contract and unresolved product decisions.
2. Add JSON Schema fixtures and generate Dart/TypeScript models.
3. Add non-destructive database columns, canonical RPCs, and backfills.
4. Build the incremental Flutter cache/realtime/outbox service.
5. Move React reads/writes to the canonical RPCs and generated model.
6. Build the shared modular bubbles and professional composer flows.
7. Migrate groups/channels/external chat into conversations.
8. Add premium creation, paid member additions, RBAC, and wallet UI states.
9. Add canonical chat gifts and gift bubbles.
10. Add canonical call messages and role-aware LiveKit actions.
11. Run cross-client parity, scale, security, payment, and offline tests.
12. Disable legacy writes and schedule legacy cleanup after production soak.

## 10. Product Decisions Required Before Migration

The architecture currently assumes:

1. The administrator who directly adds a group member pays the 50-credit fee.
2. A discovered/public-link join requires owner/admin approval and charges the
   joining user 50 credits on approval. Explicit invitation acceptance is free.
3. Only an active, unexpired paid subscription waives the member-add fee and
   permits group creation. A stale `profiles.is_premium` flag does not.
4. Owners alone may promote/demote administrators.
5. Group calls default to owner/admin start permission; regular members may
   join, and a group setting can allow members to start calls.
6. Chat gifts preserve the current 10% platform-fee/90% recipient-value model.
7. Existing `group_messages`, `channel_posts`, and `message_attachments` are
   migrated non-destructively before removal.

Changing any of these assumptions affects RPC authorization, wallet accounting,
or data migration and should be decided before DB-5 through DB-8 begins.
