# FeedIn Communication Platform — Master Architecture

> Ground-up design of FeedIn's permanent communication infrastructure: messaging,
> calling, spaces, presence, and notifications. Native-first (Flutter), modular,
> transport-independent, E2EE-ready, and future-proof.
>
> **Status:** Design (Phases 1–5). No production code changed by this document.
> Implementation (Phase 6) proceeds one subsystem at a time, each fully tested,
> never a full rewrite in one commit, production stable throughout.
>
> **UX north-star:** [`ux-reference.html`](./ux-reference.html) — the visual/interaction
> target. It is a *reference for look & feel and flows only*; none of its
> HTML/JS logic is migrated. Everything is rebuilt as native Flutter.

---

## Table of contents
1. [Phase 1 — Audit of the existing implementation](#phase-1--audit)
2. [Phase 2 — Architectural weaknesses](#phase-2--architectural-weaknesses)
3. [Phase 3 — New Communication Platform architecture](#phase-3--new-architecture)
4. [Phase 4 — Implementation roadmap](#phase-4--implementation-roadmap)
5. [Phase 5 — Full component inventory](#phase-5--component-inventory)

---

## Phase 1 — Audit

### 1A. Messaging (as-built today)

Three **independent** messaging stacks coexist, with a stalled migration between the first two. A message's send path, local store, retry semantics and read model all fork on *content type* and on *DM-vs-group*.

| Stack | Store | Handles | Send path |
|---|---|---|---|
| **Legacy DM** | Hive `LocalMessage` / `ConversationSummary` | All media, forwards, disappearing text | `queueMessage`/`queueAttachment` → `SyncService.syncNow()` (insert → upload → attachment) |
| **Canonical V2** | Hive `CanonicalMessage` + outbox + cursor | Text + stickers only | `enqueue()` → outbox → `send_message` RPC → `applyRemote` |
| **Groups/Communities/Channels** | none (no local store) | Group DMs, communities, broadcast channels | Raw `messages` table insert, reload-everything realtime |

- **Local store:** Hive (`hive_ce`), **not** sqflite. Both DM stores do **full-box Dart-side scans** per conversation open — O(total messages).
- **Realtime:** V2 = one Postgres-changes channel on the whole `messages` table + a durable `(updated_at,id)` cursor reconcile loop (solid, multi-device-safe for text). Legacy = **polling** (`refreshAll()` re-pulls everything every 2 min). Groups = **reload-everything** on every event.
- **Presence/typing/receipts:** a separate per-conversation channel (`typing_indicators`, `message_read_receipts`, `user_presence`) with client-side TTLs (presence 90s, typing 6s). No typing debounce.
- **Media:** chat media = legacy only, single-shot `storage.upload`, **no compression, resume, pause, cancel, progress, or integrity**; the message row is created **before** upload succeeds.
- **Receipts:** delivery receipts are **faked** (`delivered` default); read state is **inferred** from `conversation_participants.last_read_at` (per-conversation, not per-message).
- **Notifications:** FCM data-only push; `send-message-push` fires **only** from the legacy path — V2 text/sticker and all group sends don't trigger it client-side. Platform hardcoded to `'android'`.
- **The good part worth keeping:** the **canonical V2 model** — content-type union with payload validation, an **outbox** with attempt/backoff/permanence, a **revision + `(updated_at,id)` cursor** for conflict resolution and multi-device catch-up, and the server `send_message`/`get_*_envelope` RPC family.

**Feature coverage (native):** replies ✅ · reactions ⚠️(non-optimistic) · saved/star ✅ · voice notes ✅ · view-once ✅ · disappearing ✅ · forward ⚠️(text-only) · delete ⚠️(for-everyone only) · read receipts ⚠️(coarse) — **absent:** threads, polls, scheduled, edit, pinned-UI, video notes, delivery receipts, pagination, mentions parsing, group offline queue.

### 1B. Calling (as-built today)

- **Native (Flutter):** **1:1 only.** Clean, swappable **`CallMediaEngine`** seam (interface + `Stub` + **`LiveKitCallMediaEngine`** wired in production + unused raw-WebRTC engine). Control plane = `call_logs` status machine over Supabase realtime **+ 3s polling fallback**. Media = LiveKit SFU (its own TURN). Killed-app ring = `send-call-push` → data-only FCM → **CallKit** full-screen. **No native group calling.**
- **Web (React):** 1:1 LiveKit works; **group calling is orphaned** (no route/button + a room-name↔token regex bug that 403s); ~1,700 LOC of **dead** call managers (Cloudflare SFU + raw P2P) with **hardcoded TURN/Twilio creds**.
- **Backend (Supabase edge fns):** `livekit-token` is **excellent** (server-forced identity, DB-derived grants, 403-by-default). `send-call-push` + `_shared/fcm.ts` are excellent. But `send-fcm-push` & `get-turn-credentials` have **no auth**; `create-call-invite` writes to **non-existent columns**; `space-signaling` is a **dead stub**; `group_calls` SELECT RLS is **world-readable**.

**The good part worth keeping:** the `CallMediaEngine` seam + server-authoritative `livekit-token` + data-only-FCM/CallKit path.

---

## Phase 2 — Architectural weaknesses

**Messaging (top 10, prioritized)**
1. **Three parallel stacks + stalled V2 migration** — the root cause of everything below.
2. **Lossy dual-read merge drops canonical media** (`_loadMessages` skips non-text/sticker V2 records).
3. **Legacy send has no backoff / re-runs failed forever** → poison-message loop + duplicate server rows (non-atomic insert→upload→attachment).
4. **Primitive media upload** — no resume/pause/cancel/chunk/progress/integrity, no chat compression.
5. **Hive full-box scans per read** — O(total messages), no index.
6. **No pagination anywhere** — full thread loaded at once; groups reload all on every event.
7. **Groups/communities: no offline, no queue, reload-everything realtime, zero code reuse.**
8. **Delivery/read receipts faked or coarse** (no per-message state).
9. **Push inconsistent with send paths** (only legacy triggers it; platform hardcoded).
10. **Four uncoordinated realtime channels** with mostly-silent failure handling; interactions (reactions/pin/edit) partially wired.

**Calling**
1. **No native group calls / spaces** (1:1 only).
2. **Web group calling broken** (orphaned + token regex mismatch).
3. **Unauthenticated edge functions + committed TURN creds** (security).
4. **Duplicate end-of-call writers** (web) → duration races.
5. **~1,700 LOC dead call managers** shipped in the web bundle.
6. **Billing is client-side** (skippable).

**Cross-cutting**
- Business logic lives inside UI widgets (`messages_screen.dart` is ~2,900 lines and orchestrates send/merge/presence/timers).
- No shared transport/realtime abstraction — every subsystem opens its own channel.
- No unified domain model spanning DM/group/community/channel/broadcast/call/space.
- No E2EE seam anywhere.

---

## Phase 3 — New architecture

### 3.0 Design principles (non-negotiable)
- **One responsibility per module.** Business logic never lives in widgets.
- **Transport-independent core.** The domain + pipeline know nothing about Supabase or LiveKit; those are adapters behind interfaces.
- **Single source of truth per concern.** One conversation store, one outbox, one realtime multiplexer, one presence service.
- **Offline-first, optimistic, eventually-consistent.** Every write goes local-first through a durable outbox; the network is a background reconciler.
- **Reliability > appearance. Maintainability > cleverness. Scalability > convenience.**
- **E2EE-ready from day one** — an `EncryptionCodec` seam wraps payloads even while it's a no-op pass-through today.

### 3.1 Layered architecture

```
┌──────────────────────────────────────────────────────────────┐
│  UI LAYER  (Flutter widgets — presentation only, no logic)    │
│   feed · chat thread · call screen · space room · composer    │
├──────────────────────────────────────────────────────────────┤
│  CONTROLLER / STATE LAYER  (ChangeNotifier / Riverpod-style)  │
│   ConversationController · CallController · SpaceController    │
│   PresenceController · ComposerController · NotificationCtrl   │
├──────────────────────────────────────────────────────────────┤
│  APPLICATION / SERVICE LAYER  (use-cases, orchestration)      │
│   MessagePipeline · MediaEngine · CallEngine · PresenceEngine │
│   NotificationEngine · SyncEngine · RealtimeMultiplexer       │
├──────────────────────────────────────────────────────────────┤
│  DOMAIN LAYER  (pure Dart: entities, value objects, policies) │
│   Conversation · MessageEnvelope · CallSession · Space        │
│   DeliveryState · Presence · Receipt · EncryptionCodec (seam) │
├──────────────────────────────────────────────────────────────┤
│  DATA LAYER  (repositories + local store + transport adapters)│
│   MessageStore(SQLite) · Outbox · Cursor · MediaStore         │
│   SupabaseTransport · LiveKitTransport · FcmTransport         │
└──────────────────────────────────────────────────────────────┘
```

Rule: a layer may depend only on the layer directly beneath it, and only through interfaces. Transports (Supabase/LiveKit/FCM) are the **only** modules that import provider SDKs.

### 3.2 Unified domain model

One model spans every surface — DMs, groups, communities, channels, broadcasts, calls, spaces:

```
Conversation
  id, type: {dm, group, community, channel, broadcast, support, ai}
  members[], roles, policy (who can post/call/invite), e2ee: bool
  presenceScope, callPolicy, unreadState, pinnedMessageIds

MessageEnvelope            // the ONE message type for every surface
  id (client-UUID), conversationId, senderId, sentAtHlc (hybrid clock)
  revision (server), content: ContentBlock (union), replyTo?, threadRoot?
  mentions[], reactionsSummary, editedAt?, deletedAt?, ephemeral?
  deliveryState: {composing,queued,persisted,uploading,sent,delivered,read,failed}
  encryption: {alg, keyRef} | none

ContentBlock (union, validated)
  text · sticker · image · video · voiceNote · videoNote · gif
  file · location · poll · systemEvent · callEvent · payment

CallSession
  id, conversationId, mode: {voice,video,groupVoice,groupVideo,space,broadcast,webinar,stage}
  transport: {livekit}, room, participants[], state (lifecycle), stats

Space / Broadcast (creator audio/stage)  — same CallSession spine, different policy

Presence  {online,offline,idle,away,typing,recording,uploading,live,lastSeen,invisible}
Receipt   {messageId, userId, deliveredAtHlc, readAtHlc}   // per-message, per-user
```

**Why this shape:** every current fork (text-vs-media, dm-vs-group) collapses into one `MessageEnvelope` with a validated `ContentBlock` union and a `Conversation.type`/`policy`. Adding "webinar" or "business account" later is a new `mode`/`type`/`policy`, not a new stack.

### 3.3 The Message Pipeline (exactly the requested stages)

Every outgoing message flows through one pipeline. Each stage is an independently testable unit; failures are retried, never dropped.

```
Compose ──▶ Validation ──▶ Local Queue (Outbox) ──▶ Persistence (SQLite)
   │                                                        │
   └── ComposerController                                   ▼
                                                    Upload Manager ──▶ Media Processing
                                                        (resumable)      (compress/thumb/verify)
                                                                              │
                                                                              ▼
                                                                   Encryption-Ready Layer
                                                                    (EncryptionCodec seam)
                                                                              │
                                                                              ▼
                                                                     Delivery Service
                                                                    (send_message RPC)
                                                                              │
                                                                              ▼
                                                              Realtime Synchronization
                                                              (multiplexed channel + cursor)
                                                                              │
                                                        ┌─────────────────────┼─────────────────────┐
                                                        ▼                     ▼                     ▼
                                              Delivery Confirmation   Read Confirmation   History Sync ─▶ Archive
```

**Guarantees**
- **A message is never permanently stuck:** the Outbox has attempt counts, exponential backoff with jitter and a **cap**, permanent-vs-transient error classification, and a dead-letter state surfaced in the UI with a manual "retry/delete" affordance.
- **A media message is never created before upload succeeds:** compose produces a *local draft* in `composing/uploading`; the `MessageEnvelope` is only handed to the Delivery Service after the Upload Manager reports `verified` (integrity hash matches). Failure keeps it local and retriable — no broken server bubble.
- **Offline / delayed sync / conflict resolution / multi-device:** the Outbox drains when connectivity returns; the SyncEngine reconciles via HLC (`sentAtHlc`) + server `revision` ((revision) wins, then HLC, then id); the same cursor catches a second device up. Duplicate suppression by client-UUID.

### 3.4 Media Engine (dedicated subsystem)

```
MediaEngine
  ├─ UploadManager     queue · retry · resume(offset) · pause · cancel · progress · background
  ├─ MediaProcessor    compression (image→WebP, video→H.264 tiers), thumbnail, duration probe
  ├─ IntegrityService  content hash (sha256) computed pre-upload, verified post-upload
  ├─ MediaStore        local cache (path + hash + state), signed-URL cache on read
  └─ Adapters          ResumableStorageAdapter (chunked/tus-style over Supabase Storage)
Supported: image · video · voiceNote · videoNote · gif · file · document (compressed + original)
```
- Resumable, chunked uploads with a persisted byte offset → survive process death & network loss.
- Progress + state stream per attachment (drives the composer/bubble progress ring).
- Background upload via foreground service (Android) / background task (iOS).
- **Message created only after `verified`.**

### 3.5 Call Engine (permanent, mode-extensible)

```
CallEngine
  ├─ CallController        lifecycle state machine (below), one per active call
  ├─ CallSignaling         invite/accept/reject/busy/cancel/timeout over the control plane
  ├─ CallTransport (iface) join/publish/subscribe/leave, stats, ICE-restart, reconnect
  │     └─ LiveKitCallTransport   (today's provider; swappable)
  ├─ AudioRouter           earpiece/speaker/bluetooth/wired, audio focus, AEC/NS/AGC
  ├─ DeviceMonitor         network-change + device-switch + background-recovery hooks
  └─ TokenService          server-minted, per-call, short-TTL (livekit-token)
Modes (no redesign to add): voice · video · groupVoice · groupVideo · space · broadcast · webinar · stage · screenShare
```

**Call lifecycle (full):**
`Invite → Ringing → {Accept | Reject | Busy | Cancel | Timeout} → Connecting → Connected ⇄ Reconnecting(ICE restart / network change / background recovery) → {DeviceSwitch | Transfer-ready} → Ended`

- **Group calls & spaces are the SAME spine** — a `CallSession.mode` + a `Conversation.callPolicy`, not a new stack. This is what native lacks today and is the primary calling deliverable.
- **Background execution:** high-priority data-only FCM wakes the app → **CallKit/ConnectionService** full-screen incoming UI works when closed/backgrounded/locked/screen-off/other-app/battery-optimized; Android foreground service for connected calls & screen capture; proper caller ringback.
- **Session recovery:** on cold start with an active `call_logs`/session row, the engine rejoins.

### 3.6 Presence Engine
Single service, single multiplexed channel: `online/offline/idle/away/typing/recording/uploading/live/lastSeen/invisible(future)`. Debounced typing (leading+trailing, ~1.5s), heartbeat with server-side TTL, and a subscription scoped to visible conversations only (no per-conversation channel sprawl).

### 3.7 Notification Engine
One unified router over data-only FCM: `message · call · mention · reply · reaction · group/community event · channel post · creator update · silent · priority · background`. Server-authoritative senders (auth + ownership checks), consistent payload contract, per-category user preferences, and a single background-isolate dispatcher that routes by `type` (CallKit for calls, grouped inline-reply for messages, etc.). **Every send path triggers the correct push** (the current legacy-only gap is closed).

### 3.8 Realtime Multiplexer
**One** realtime connection per device, fanned out to logical subscriptions (messages, receipts, presence, calls, spaces). Replaces the current four uncoordinated channels. Backed everywhere by the durable cursor reconcile so a dropped event never loses data.

### 3.9 Security & E2EE-readiness
- **Validate every request** server-side (identity forced, membership/policy checked — the `livekit-token` model applied everywhere).
- **Idempotency**: client-UUID message ids + a server unique constraint prevent duplicate messages; one active call per conversation (partial unique index) prevents duplicate calls.
- **Session integrity**: per-call short-TTL tokens bound to call state; realtime RLS scoped to participants (fix `group_calls` world-read).
- **E2EE seam**: `EncryptionCodec.encrypt/decrypt` wraps every `ContentBlock` at the Encryption-Ready stage. Today it's identity (pass-through) with `alg: none`; enabling Signal-protocol/MLS later is swapping the codec + a key-management service — **no pipeline change**.
- Remove hardcoded TURN creds; authenticate `send-fcm-push` & `get-turn-credentials`.

### 3.10 UX north-star → native mapping
The [`ux-reference.html`](./ux-reference.html) preview defines the target experience. Native mapping (rebuilt, not migrated):

| Reference element | Native surface |
|---|---|
| Chats view: "Messages & Calls", secure-plane banner, thread tiles with inline voice/video buttons, "Group Call Hub" | `ConversationListScreen` + `ConversationTile` + `SecurePlaneBanner` |
| 1:1 calling modal (avatar, E2EE badge, ringing, duration, mute/video/speaker/end) | `CallScreen` (mode = voice/video) driven by `CallController` |
| Group call grid (participant cards, mute state) | `CallScreen` (mode = groupVideo) + `ParticipantGrid` |
| Minimized PiP call widget ("tap to return") | `CallPipOverlay` (app-wide, above nav) |
| Camera studio, post-capture, comments drawer, creator profile, audio modal | already shipped (feed migration) — reused |

Design tokens (dark slate + pink→purple gradient, emerald "secure" accent, glass surfaces) become a `CommunicationTheme` token set, consistent with the existing `FeedImmersiveTheme`.

---

## Phase 4 — Implementation roadmap

Incremental, each subsystem independently testable, **never a full rewrite in one commit**, production stable throughout. Old stacks stay live behind a feature flag until the new one reaches parity for that slice, then are deleted.

| # | Subsystem | Deliverable | Exit test |
|---|---|---|---|
| **0** | **Foundations** | Domain models (`MessageEnvelope`, `Conversation`, `CallSession`), `EncryptionCodec` (no-op), `RealtimeMultiplexer`, `Result`/error types, `CommunicationTheme` | Unit tests on models/policies; multiplexer connects & fans out |
| **1** | **Message Store + Outbox (SQLite)** | Replace Hive full-scans with indexed SQLite; unified `MessageStore`, `Outbox`, `Cursor` | Insert/query/paginate benchmarks; outbox backoff/permanence tests |
| **2** | **Message Pipeline (text)** | Compose→…→Read for text/sticker on the canonical `send_message` RPC, behind a flag; migrate legacy text | Offline send, retry, dedup, multi-device reconcile, ordering |
| **3** | **Media Engine** | Resumable UploadManager + MediaProcessor + IntegrityService; media messages via pipeline (created only after `verified`) | Pause/resume/cancel/progress; kill-process-mid-upload resume; integrity mismatch handling |
| **4** | **Unify groups/communities/channels** | Route group/community/channel/broadcast through the same pipeline + `Conversation.type/policy`; delete the raw-insert stack | Group offline send, incremental realtime (no reload-all), policy enforcement |
| **5** | **Receipts + Presence Engine** | Per-message delivery+read receipts; single presence service (debounced typing, TTL, scoped) | Per-message receipt correctness; typing debounce; presence TTL |
| **6** | **Notification Engine** | Unified router; every send path triggers correct push; per-category prefs; fix platform + auth | Push fires for text/media/group; CallKit for calls; silent/priority routing |
| **7** | **Call Engine core (1:1)** | Re-express current 1:1 on `CallTransport`/`CallController`/`AudioRouter`/`DeviceMonitor` with full lifecycle + reconnect/ICE-restart/recovery | Network-change reconnect; background/killed ring; audio routing matrix |
| **8** | **Group calls & Spaces** | `mode = groupVoice/groupVideo/space`; participant grid, PiP, join/leave, policy; server RLS/token fixes | N-party join/leave; token authz; RLS scoping; PiP restore |
| **9** | **Advanced messaging features** | Threads, mentions (parse+store), reactions (optimistic), polls, scheduled, pinned UI, edit, delete-for-me, forward-any, video notes, saved | Per-feature unit + integration |
| **10** | **Hardening & cleanup** | Delete legacy `LocalMessage`/`SyncService`/`MessageMaterializer` + dead web managers; rotate/remove TURN creds; server-side billing; load/perf pass | No regressions; perf budget; security review |
| **11** | **Future seams verified** | E2EE codec swap dry-run, business/support/AI conversation types, webinar/stage modes exercised behind flags | Seam tests compile & run with stub implementations |

Each subsystem: design note → implement → tests green → single focused commit → verify on device → next.

---

## Phase 5 — Component inventory

### Services (application layer)
- `MessagePipeline` · `MediaEngine` (`UploadManager`, `MediaProcessor`, `IntegrityService`) · `CallEngine` · `SpaceEngine` · `PresenceEngine` · `NotificationEngine` · `SyncEngine` · `RealtimeMultiplexer` · `TokenService` · `ConnectivityService`(reuse) · `EncryptionService`(seam) · `AudioRouter` · `DeviceMonitor` · `BackgroundExecutionService`

### Repositories / data
- `ConversationRepository` · `MessageStore`(SQLite) · `Outbox` · `SyncCursorStore` · `MediaStore` · `ReceiptRepository` · `PresenceRepository` · `CallLogRepository` · `NotificationPreferenceRepository`
- Transport adapters: `SupabaseTransport` · `LiveKitCallTransport` · `ResumableStorageAdapter` · `FcmTransport`

### Managers
- `UploadManager` · `DownloadManager` · `ReconnectionManager` · `RingtoneManager` · `CallKitManager` (CallKit/ConnectionService) · `ForegroundServiceManager` · `KeyManager`(future E2EE)

### Controllers / state objects (no logic in widgets)
- `ConversationListController` · `ConversationController` · `ComposerController` · `CallController` · `SpaceController` · `PresenceController` · `NotificationController`
- State: `ConversationListState` · `ThreadState` · `ComposerState` · `CallState` · `SpaceState` · `PresenceState` · `UploadState`

### Models / domain
- `Conversation` · `ConversationType` · `ConversationPolicy` · `MessageEnvelope` · `ContentBlock`(union) · `DeliveryState` · `Receipt` · `Reaction` · `Mention` · `Poll` · `CallSession` · `CallMode` · `CallLifecycleState` · `Participant` · `Presence` · `Space` · `HybridClock(HLC)` · `EncryptionEnvelope`

### Notification handlers
- `PushRouter` (background isolate) → `MessageNotificationHandler` · `CallNotificationHandler`(CallKit) · `MentionReplyHandler` · `ReactionHandler` · `GroupEventHandler` · `ChannelPostHandler` · `CreatorUpdateHandler` · `SilentSyncHandler`

### UI components
- `ConversationListScreen` · `ConversationTile` · `SecurePlaneBanner` · `ThreadScreen` · `MessageBubble`(one component, content-block dispatched) · `Composer` · `AttachmentTray` · `VoiceRecorderSheet` · `ReactionBar` · `MessageActionSheet` · `ReplyPreview` · `TypingIndicator` · `ReceiptTicks`
- `CallScreen` · `ParticipantGrid` · `CallControlsBar` · `IncomingCallView` · `CallPipOverlay` · `SpaceRoomScreen` · `SpeakerRail`
- `NotificationCenterScreen` · `NotificationPreferencesScreen`

---

*End of master architecture. Phase 6 begins only after this design is approved, one subsystem at a time.*
