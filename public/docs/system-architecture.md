# FeedIn — Complete System Architecture Document

> **Generated:** 2026-03-07
> **Scope:** Messaging, Groups, Stories, Calls, Live Streaming, Channels

---

## Table of Contents

1. [Messaging (DMs)](#a-messaging-dms)
2. [Groups](#b-groups)
3. [Stories](#c-stories)
4. [Voice & Video Calling](#d-voice--video-calling)
5. [Live Streaming](#e-live-streaming)
6. [Channels](#f-channels-telegram-style)
7. [Hooks & Context](#g-hooks--context)
8. [Pages & Routes](#h-pages--routes)
9. [Missing Features](#i-missing-features)

---

## A. Messaging (DMs)

**Directory:** `src/components/messages/`

### Core Chat Engine
| File | Purpose | Status |
|------|---------|--------|
| `ModernChatInterface.tsx` | Main 1:1 chat — send, receive, scroll, reply, pagination | ✅ |
| `ModernMessageBubble.tsx` | Individual message bubble renderer (text, media, voice) | ✅ |
| `VirtualizedMessageList.tsx` | Performance-optimized virtualized message list | ✅ |
| `SecretMessageBubble.tsx` | Self-destructing (secret mode) messages | ✅ |

### Media & Attachments
| File | Purpose | Status |
|------|---------|--------|
| `AttachmentPicker.tsx` | Popover picker for images, videos, files, location | ✅ |
| `MediaUploadModal.tsx` | Upload flow with progress indicator | ✅ |
| `MediaMessageBubble.tsx` | Renders image/video/file message types | ✅ |
| `MediaPreviewBar.tsx` | Glassmorphic attachment preview before send | ✅ |
| `ChatMediaViewer.tsx` | Fullscreen media viewer overlay | ✅ |
| `VoiceRecorder.tsx` | Hold-to-record voice message UI | ✅ |
| `WaveformPlayer.tsx` | Audio waveform playback component | ✅ |
| `LinkPreviewCard.tsx` | Auto-generated URL link preview cards | ✅ |

### Message Actions
| File | Purpose | Status |
|------|---------|--------|
| `MessageContextMenu.tsx` | Long-press context menu (reply, forward, delete, react, star) | ✅ |
| `ForwardMessageSheet.tsx` | Forward message to another conversation | ✅ |
| `DeleteMessageModal.tsx` | Delete message confirmation dialog | ✅ |
| `ReportMessageModal.tsx` | Report inappropriate message | ✅ |
| `StarButton.tsx` | Star/bookmark individual messages | ✅ |
| `ScheduleMessageModal.tsx` | Schedule a message for future delivery | ✅ |
| `ScheduledMessagesList.tsx` | View and manage scheduled messages | ✅ |

### Features & Intelligence
| File | Purpose | Status |
|------|---------|--------|
| `AIReplySuggestions.tsx` | Gemini-powered smart reply chip suggestions | ✅ |
| `TypingIndicator.tsx` | Real-time typing indicator dots | ✅ |
| `MessageSearchSheet.tsx` | Search within conversation | ✅ |
| `MuteConversationSheet.tsx` | Mute conversation with duration options | ✅ |
| `SharedMediaGallery.tsx` | Shared media gallery (tabbed: images, videos, files) | ✅ |
| `ChatGiftButton.tsx` | Send gifts within DMs | ✅ |
| `MessageSettingsSheet.tsx` | Per-chat settings sheet | ✅ |
| `UserMentionInput.tsx` | @mention input with autocomplete | ✅ |
| `CreateStickerModal.tsx` | AI-powered custom sticker creation | ✅ |
| `CallLogBubble.tsx` | Call history entry rendered inside chat | ✅ |

### Inbox & Navigation
| File | Purpose | Status |
|------|---------|--------|
| `NewConversationModal.tsx` | Start new conversation — user search | ✅ |
| `MessagingTabs.tsx` | Tab switcher (All / Unread / Groups) | ✅ |
| `InboxActivitySection.tsx` | Activity feed section in inbox | ✅ |
| `TikTokConversationItem.tsx` | Individual conversation list item | ✅ |

---

## B. Groups

**Directory:** `src/components/groups/`

### Core Group Chat
| File | Purpose | Status |
|------|---------|--------|
| `GroupChatInterface.tsx` | Main group chat engine (messages, send, scroll) | ✅ |
| `GroupMessageBubble.tsx` | Group message bubble with sender info | ✅ |
| `GroupChatHeader.tsx` | Group chat header bar with avatar + name | ✅ |
| `GroupChatMenu.tsx` | Group options dropdown menu | ✅ |

### Group Management
| File | Purpose | Status |
|------|---------|--------|
| `CreateGroupModal.tsx` | Create new group (name, avatar, description) | ✅ |
| `GroupInfoSheet.tsx` | Group info/settings bottom sheet | ✅ |
| `GroupMembersSheet.tsx` | Member list with admin actions | ✅ |
| `GroupRoleManagement.tsx` | Admin/moderator role assignment | ✅ |
| `GroupInviteLinkSheet.tsx` | Generate & share invite links | ✅ |

### Group Features
| File | Purpose | Status |
|------|---------|--------|
| `GroupTypingIndicator.tsx` | Real-time typing dots for groups | ✅ |
| `MessageReactionsDisplay.tsx` | Emoji reaction display on messages | ✅ |
| `ReportMessageModal.tsx` | Report group message | ✅ |
| `polls/CreatePollModal.tsx` | Create a poll within group chat | ✅ |
| `polls/PollCard.tsx` | Display and vote on polls | ✅ |

### Group Calling
| File | Purpose | Status |
|------|---------|--------|
| `GroupCallRoom.tsx` | Group voice/video call room (up to 4) | ✅ |
| `GroupCallBanner.tsx` | "Call in progress" banner in group chat | ✅ |

---

## C. Stories

**Directory:** `src/components/stories/`

| File | Purpose | Status |
|------|---------|--------|
| `CreateStoryModal.tsx` | Create story — image/video upload, 2min video limit, music overlay | ✅ |
| `StoryViewer.tsx` | Fullscreen viewer — swipe, progress bars, emoji reactions, reply | ✅ |
| `StoryViewersList.tsx` | List of users who viewed a story | ✅ |
| `StoriesBar.tsx` | Standard horizontal stories bar | ✅ |
| `TikTokStoriesBar.tsx` | TikTok-style stories bar (used in Messages page) | ✅ |
| `StoryCircle.tsx` | Individual story circle avatar component | ✅ |

---

## D. Voice & Video Calling

**Directory:** `src/components/calls/`

### Call UI Components
| File | Purpose | Status |
|------|---------|--------|
| `CallControls.tsx` | Mute, video toggle, speaker, end call buttons | ✅ |
| `FloatingCallWidget.tsx` | Minimized floating call widget with PiP | ✅ |
| `IncomingCall.tsx` | Incoming call screen UI | ✅ |
| `IncomingCallListener.tsx` | Global listener for incoming calls (always mounted) | ✅ |
| `ConnectionStatus.tsx` | Connection state overlay (connecting, reconnecting) | ✅ |
| `NetworkQualityIndicator.tsx` | Signal quality bars indicator | ✅ |
| `ShareCallModal.tsx` | Share call invite link modal | ✅ |
| `ActiveCallIndicator.tsx` | Small header indicator for active call | ✅ |

### Call Context
| File | Purpose |
|------|---------|
| `src/context/CallContext.tsx` | Global call state manager — LiveKit rooms, call lifecycle, push notifications |

---

## E. Live Streaming

### Top-Level Components — `src/components/live/`

| File | Purpose | Status |
|------|---------|--------|
| `CreateLiveStreamModal.tsx` | Create video stream — mode selector, categories, feature toggles | ✅ |
| `CreateSpaceModal.tsx` | Create audio space | ✅ |
| `GoLiveDropdown.tsx` | "Go Live" dropdown menu (Stream vs Space) | ✅ |
| `GoLiveModal.tsx` | Go live flow | ✅ |
| `LiveGiftModal.tsx` | Full gift store modal with categories | ✅ |
| `InStreamRechargeSheet.tsx` | In-stream credit purchase/recharge | ✅ |
| `FloatingLivePlayer.tsx` | Generic PiP minimized player | ✅ |
| `FloatingSpacePlayer.tsx` | PiP audio space player | ✅ |
| `FloatingStreamPlayer.tsx` | PiP video stream player | ✅ |
| `LiveDashboard.tsx` | Live discovery/browse page | ✅ |
| `LiveStreamCard.tsx` | Stream card in discovery feed | ✅ |
| `LiveDiscoverCard.tsx` | Discover card variant | ✅ |
| `SpaceCard.tsx` | Audio space card | ✅ |
| `LiveStreamPreviewCard.tsx` | Preview card for streams | ✅ |
| `FlyingChat.tsx` | Flying chat messages overlay | ✅ |
| `FloatingReactions.tsx` | Floating emoji reactions | ✅ |
| `FullScreenGiftEffect.tsx` | Full-screen gift animation | ✅ |
| `LiveChatMessage.tsx` | Individual chat message in live | ✅ |
| `LiveStreamMentionInput.tsx` | @mention input for live chat | ✅ |
| `MentionText.tsx` | Renders @mentions | ✅ |
| `CoHostPanel.tsx` | Co-host management panel | ✅ |
| `LiveInviteModal.tsx` | Invite users to live | ✅ |
| `LiveInviteNotification.tsx` | Incoming live invite notification | ✅ |
| `LiveNotificationsPanel.tsx` | Live notification panel | ✅ |
| `LiveKitBroadcaster.tsx` | LiveKit broadcaster component | ✅ |
| `LiveKitViewer.tsx` | LiveKit viewer component | ✅ |
| `ScreenShareButton.tsx` | Screen share toggle button | ✅ |
| `StreamHealthIndicator.tsx` | Stream health/quality indicator | ✅ |
| `StreamOptionsMenu.tsx` | Stream options menu | ✅ |
| `StreamReadyGate.tsx` | Pre-stream readiness check | ✅ |
| `SpeakerAvatarWithWaves.tsx` | Speaker avatar with audio waves | ✅ |
| `SpeakerQueuePanel.tsx` | Speaker request queue | ✅ |
| `ViewerListPanel.tsx` | Viewer list panel | ✅ |
| `SpaceChat.tsx` | Audio space chat | ✅ |
| `SpaceContentManager.tsx` | Space content management | ✅ |
| `SpaceGiftHistory.tsx` | Gift history in space | ✅ |
| `SpaceInviteModal.tsx` | Invite to space | ✅ |
| `SpaceInviteNotification.tsx` | Space invite notification | ✅ |
| `SpaceMentionInput.tsx` | @mention in space chat | ✅ |
| `SpaceReplayPlayer.tsx` | Space replay player | ✅ |
| `SpaceWalletBoard.tsx` | Wallet leaderboard in space | ✅ |
| `LiveSpaceRoom.tsx` | Audio space room (legacy) | ✅ |
| `UnifiedLiveRoom.tsx` | Unified live room wrapper | ✅ |
| `PostRecordingModal.tsx` | Post-recording save modal | ✅ |
| `RecordingsManager.tsx` | Recording management | ✅ |
| `ListenersModal.tsx` | Listeners list modal | ✅ |
| `TestAudioModal.tsx` | Test audio before going live | ✅ |

### Video Stream V2 — `src/components/live/stream-v2/`

| File | Purpose | Status |
|------|---------|--------|
| `StreamRoomV2.tsx` | Main video stream room — all state, effects, UI | ✅ |
| `VideoEngine.tsx` | LiveKit video rendering engine | ✅ |
| `StreamChat.tsx` | Overlay chat with gradient masking | ✅ |
| `StreamControls.tsx` | Bottom control bar (chat input, gift, react) | ✅ |
| `StreamHeader.tsx` | Top header (host info, PULSE, settings, end) | ✅ |
| `StreamGuests.tsx` | Guest/co-broadcaster list view | ✅ |
| `StreamSettings.tsx` | Settings sheets (share, settings, reactions, gift, invite) | ✅ |
| `GiftOverlay.tsx` | Gift animation overlay | ✅ |
| `POVSwitcher.tsx` | Multi-cam POV switcher (right side) | ✅ |
| `AICatchUpPanel.tsx` | AI PULSE panel + Host-editable cards | ✅ |
| `CoPilotJoystick.tsx` | Host co-pilot FAB (polls, lights, sounds, predictions) | ✅ |
| `HypeMeter.tsx` | Hype level progress meter | ✅ |
| `HypeParticles.tsx` | Floating hype emoji particles | ✅ |
| `EventTicker.tsx` | Rotating event ticker banner | ✅ |
| `LightFlashOverlay.tsx` | Light flash trigger overlay | ✅ |
| `PollSystem.tsx` | In-stream poll creation & voting | ✅ |
| `PredictionSystem.tsx` | Predictive betting system | ✅ |
| `LiveStreakBadge.tsx` | Consecutive viewing streak badge | ✅ |
| `InteractiveCanvas.tsx` | Interactive layer (Z-10) | ✅ |

### Audio Spaces — `src/components/live/twitter-space/`

| File | Purpose | Status |
|------|---------|--------|
| `TwitterSpaceRoom.tsx` | Main audio space room | ✅ |
| `TwitterStreamRoom.tsx` | Video variant of space room | ✅ |
| `TwitterSpaceChat.tsx` | Space chat UI | ✅ |
| `TwitterSpaceControls.tsx` | Space control bar | ✅ |
| `TwitterSpaceHeader.tsx` | Space header | ✅ |
| `TwitterSpaceGuests.tsx` | Space guest list | ✅ |
| `TwitterSpaceUserGrid.tsx` | Speaker grid layout | ✅ |
| `TwitterSpaceReactionPicker.tsx` | Reaction emoji picker | ✅ |
| `TwitterSpaceSettingsMenu.tsx` | Space settings menu | ✅ |
| `TwitterSpaceShareMenu.tsx` | Share space menu | ✅ |
| `ThreadedRepliesList.tsx` | Threaded chat replies | ✅ |
| `SpeakInviteDialog.tsx` | Invite to speak dialog | ✅ |
| `SpeakerActionSheet.tsx` | Speaker management actions | ✅ |
| `SpaceRulesModal.tsx` | Community rules modal | ✅ |
| `SpaceFeedbackModal.tsx` | Post-space feedback | ✅ |
| `SpaceAudioSettingsModal.tsx` | Audio settings | ✅ |

### Unified / Shared Live Components — `src/components/live/unified/`

| File | Purpose | Status |
|------|---------|--------|
| `PKBattleBar.tsx` | PK battle score bar (multi-segment) | ✅ |
| `PKBattleChallenge.tsx` | PK battle invite/challenge modal | ✅ |
| `UnifiedRoom.tsx` | Unified room wrapper | ✅ |
| `UnifiedControlBar.tsx` | Shared control bar | ✅ |
| `LiveFeedItem.tsx` | Live item in feed | ✅ |
| `AudioVisualizer.tsx` | Audio visualization component | ✅ |
| `types.ts` | Shared type definitions | ✅ |

### Shared Live Components — `src/components/live/shared/`

| File | Purpose | Status |
|------|---------|--------|
| `QuickGiftBar.tsx` | Quick gift bar (fast gifting) | ✅ |
| `HostGiftPanel.tsx` | Host gift counter panel | ✅ |
| `BroadcastInput.tsx` | Chat input for broadcasts | ✅ |
| `ConnectionOverlay.tsx` | Connection status overlay | ✅ |
| `CoverImageUpload.tsx` | Cover image upload for events | ✅ |
| `EventCoverDisplay.tsx` | Event cover display | ✅ |
| `LiveControlBar.tsx` | Generic live control bar | ✅ |
| `ParticipantsList.tsx` | Participants list component | ✅ |

---

## F. Channels (Telegram-style) — ❌ NOT IMPLEMENTED

**No files exist.** Channels would be broadcast-only spaces where admins post and subscribers consume content.

### Required for implementation:
- `src/components/channels/` — New directory
- Database tables: `channels`, `channel_posts`, `channel_subscribers`
- Channel creation, subscription, admin posting UI
- Push notifications for new posts

---

## G. Hooks & Context

### Messaging Hooks — `src/hooks/`
| Hook | Purpose |
|------|---------|
| `useMessageRealtime.tsx` | Real-time message subscription via Supabase channels |
| `useMessageCache.tsx` | Client-side message caching layer |
| `useOptimisticMessages.tsx` | Optimistic message updates (instant UI) |
| `useForwardMessage.tsx` | Forward message logic |
| `useMessageSearch.tsx` | Search within messages |
| `useStarredMessages.tsx` | Starred messages CRUD |
| `useSharedMedia.tsx` | Shared media queries |
| `useConversationCache.tsx` | Conversation list caching |
| `useKeyboardHeight.tsx` | Mobile keyboard height detection |

### Presence & Realtime Hooks
| Hook | Purpose |
|------|---------|
| `usePresence.tsx` | Online/offline user presence |
| `useRealtimeSubscriptions.tsx` | Unified realtime channel (`[user-realtime:userId]`) |
| `useGroupPresence.tsx` | Group member presence tracking |
| `useGroupRealtime.tsx` | Group-specific real-time events |
| `useLivePresence.tsx` | Live stream viewer presence |

### Group Hooks
| Hook | Purpose |
|------|---------|
| `useGroupCall.tsx` | Group call management & lifecycle |

### Live Hooks
| Hook | Purpose |
|------|---------|
| `usePKBattle.ts` | PK battle creation, challenges, scoring |
| `useLivestreamPermission.ts` | Permission gating for live features |
| `useSpaceAudio.tsx` | Audio space management |
| `useSpaceLiveKit.ts` | Space LiveKit connection |
| `useSpaceRecorder.ts` | Space recording |
| `useStreamPlayback.ts` | Stream video playback |
| `useCloudflarePlayback.ts` | Cloudflare-hosted video playback |

### Contexts — `src/context/`
| Context | Purpose |
|---------|---------|
| `AuthContext.tsx` | Authentication state & user session |
| `CallContext.tsx` | Global call state — LiveKit rooms, call lifecycle, PiP |
| `LiveStreamContext.tsx` | Live stream state management |
| `SpaceContext.tsx` | Audio space state management |
| `UnifiedLiveContext.tsx` | Unified live room state |
| `NavigationContext.tsx` | Bottom nav visibility, navigation state |
| `CurrencyContext.tsx` | Currency formatting & settings |
| `RefreshContext.tsx` | Pull-to-refresh state |

---

## H. Pages & Routes

### Messaging Pages
| Page File | Route | Purpose |
|-----------|-------|---------|
| `Messages.tsx` | `/messages` | Inbox — conversations list, stories bar, tabs |
| `StarredMessages.tsx` | `/starred-messages` | View all starred/saved messages |

### Group Pages
| Page File | Route | Purpose |
|-----------|-------|---------|
| `Groups.tsx` | `/groups` | Groups discovery & list |
| `GroupDetail.tsx` | `/groups/:groupId` | Group info page |
| `GroupChat.tsx` | `/groups/:groupId/chat` | Group chat interface |
| `GroupJoin.tsx` | `/groups/join/:inviteCode` | Join group via invite link |

### Story Pages
| Page File | Route | Purpose |
|-----------|-------|---------|
| `StoryDetail.tsx` | `/story/:storyId` | Story permalink/deep link |

### Call Pages
| Page File | Route | Purpose |
|-----------|-------|---------|
| `Call.tsx` | `/call` | Active call page (voice or video) |
| `CallHistory.tsx` | `/call-history` | Call log/history |
| `CallInvite.tsx` | `/call/join/:inviteCode` | Join call via shared link |

### Live Pages
| Page File | Route | Purpose |
|-----------|-------|---------|
| `Live.tsx` | `/live` | Live discovery — streams & spaces |
| `LiveStreamDetail.tsx` | `/live/:streamId` | Video stream room |
| `SpaceDetail.tsx` | `/spaces/:spaceId` | Audio space room |

---

## I. Missing Features Summary

| # | Feature | Module | Files Affected | Effort |
|---|---------|--------|----------------|--------|
| 1 | **Music/audio file sharing (4min limit)** | Messaging | `AttachmentPicker.tsx`, new `AudioFileBubble.tsx` | Small |
| 2 | **Audio notes (distinct type)** | Messaging | `VoiceRecorder.tsx`, `ModernMessageBubble.tsx` | Small |
| 3 | **Audio-only stories** | Stories | `CreateStoryModal.tsx` | Small |
| 4 | **Music file upload in stories (4min)** | Stories | `CreateStoryModal.tsx` | Small |
| 5 | **Text-only gradient stories** | Stories | `CreateStoryModal.tsx`, `StoryViewer.tsx` | Small |
| 6 | **Screen sharing in calls** | Calls | `CallControls.tsx`, `CallContext.tsx` | Small |
| 7 | **Go Live from Group** | Groups + Live | `GroupChatHeader.tsx`, `CreateLiveStreamModal.tsx` | Medium |
| 8 | **Channels system** | New module | New directory + tables + pages | Large |

---

## J. Database Tables Referenced

### Messaging
- `conversations` — Conversation metadata
- `conversation_participants` — Who's in each conversation
- `messages` (referenced in code, not in types excerpt) — Message content

### Groups
- `groups` — Group metadata
- `group_members` — Membership
- `group_messages` — Group messages
- `group_calls` — Active group calls
- `group_call_participants` — Call participants

### Stories
- `stories` — Story content
- `story_views` — Who viewed
- `story_reactions` — Reactions

### Calls
- `call_logs` — Call history
- `call_participants` — Call participants
- `call_signals` — WebRTC signaling
- `call_invites` — Shareable invite codes

### Live Streaming
- `live_streams` — Stream metadata + `stream_features` JSONB
- `live_stream_viewers` — Viewer tracking
- `live_stream_messages` — Chat messages
- `live_stream_reactions` — Reactions
- `live_stream_gifts` — Gift transactions
- `live_spaces` — Audio space metadata

---

*This document reflects the codebase as of 2026-03-07. Update when new modules are added.*
