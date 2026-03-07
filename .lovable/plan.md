

# Full System Structure Audit + PULSE Enhancement Plan

## Part 1: PULSE Panel Enhancement

The current PULSE panel shows AI-generated data only. Per the reference screenshot and your request, the host should be able to **add custom cards** (announcements, promo text, product highlights, etc.) that appear alongside the AI data in a visually rich layout.

### Changes to `AICatchUpPanel.tsx`:
- Add a **"Host Cards"** section at the top — editable cards the host can add before/during stream (e.g., "Blue Hoodie drops at 8PM", promo codes, pinned announcements)
- Host sees an "Add Card" button; viewers see the published cards
- Cards support: title, body text, optional emoji/icon, optional link
- Store host cards in `live_streams.stream_features` JSON (no new table needed)
- Visual: Match the reference screenshot exactly — dark glassmorphic cards with bold italic text, yellow accent labels

### Changes to `StreamRoomV2.tsx`:
- Pass `isHost` and stream data to PULSE panel so it can render edit vs. view mode

---

## Part 2: Full System Structure Audit

Here is a complete breakdown of what exists, what works, and what is missing across all major features:

---

### A. Messaging (DMs) — `src/components/messages/`

| Feature | Status | Files |
|---------|--------|-------|
| 1:1 text chat | Done | `ModernChatInterface.tsx`, `ModernMessageBubble.tsx` |
| Voice messages (recording + waveform playback) | Done | `VoiceRecorder.tsx`, `WaveformPlayer.tsx` |
| Media sharing (photo/video/file) | Done | `AttachmentPicker.tsx`, `MediaUploadModal.tsx`, `MediaMessageBubble.tsx` |
| Reply to message | Done | `ModernChatInterface.tsx` |
| Forward message | Done | `ForwardMessageSheet.tsx` |
| Delete message | Done | `DeleteMessageModal.tsx` |
| Message context menu (long press) | Done | `MessageContextMenu.tsx` |
| Typing indicators | Done | `TypingIndicator.tsx` |
| Read receipts | Done | via unified-realtime |
| AI smart replies | Done | `AIReplySuggestions.tsx` |
| Message search | Done | `MessageSearchSheet.tsx` |
| Starred messages | Done | `StarButton.tsx`, `StarredMessages` page |
| Secret/self-destruct messages | Done | `SecretMessageBubble.tsx` |
| Mute conversation | Done | `MuteConversationSheet.tsx` |
| Shared media gallery | Done | `SharedMediaGallery.tsx` |
| Link previews | Done | `LinkPreviewCard.tsx` |
| Scheduled messages | Done | `ScheduleMessageModal.tsx` |
| Chat gifts | Done | `ChatGiftButton.tsx` |
| Emoji reactions on messages | Done | via `MessageContextMenu` |
| Report message | Done | `ReportMessageModal.tsx` |
| Archive conversations | Done | via Messages.tsx |
| Online presence | Done | via unified-realtime presence |
| **Music file sharing (up to 4min)** | **MISSING** | No audio file validation or music-specific UI |
| **Audio notes in chat** | **Partial** | Voice recorder exists but no dedicated "audio note" type distinct from voice messages |

---

### B. Groups — `src/components/groups/`

| Feature | Status | Files |
|---------|--------|-------|
| Create group | Done | `CreateGroupModal.tsx` |
| Group chat with messages | Done | `GroupChatInterface.tsx`, `GroupMessageBubble.tsx` |
| Group info/settings | Done | `GroupInfoSheet.tsx` |
| Member management | Done | `GroupMembersSheet.tsx` |
| Role management (admin/mod) | Done | `GroupRoleManagement.tsx` |
| Invite links | Done | `GroupInviteLinkSheet.tsx` |
| Group polls | Done | `groups/polls/` |
| Typing indicators | Done | `GroupTypingIndicator.tsx` |
| Message reactions | Done | `MessageReactionsDisplay.tsx` |
| Voice messages in groups | Done | via `VoiceRecorder` |
| Group call (voice/video) | Done | `GroupCallRoom.tsx`, `GroupCallBanner.tsx` |
| **Go Live from group** | **MISSING** | No button/flow to start a livestream scoped to a group |
| **Group channels (Telegram-style)** | **MISSING** | No channel concept within groups |

---

### C. Stories — `src/components/stories/`

| Feature | Status | Files |
|---------|--------|-------|
| Create story (image/video) | Done | `CreateStoryModal.tsx` |
| View stories (swipe, progress bars) | Done | `StoryViewer.tsx` |
| Story reactions (emoji) | Done | `StoryViewer.tsx` |
| Story reply (DM) | Done | `StoryViewer.tsx` |
| Story viewers list | Done | `StoryViewersList.tsx` |
| Stories bar in messages | Done | `TikTokStoriesBar.tsx` |
| Video duration limit (2min) | Done | `CreateStoryModal.tsx` |
| Music on image stories | Done | `CreateStoryModal.tsx` (sample library) |
| Delete own story | Done | `StoryViewer.tsx` |
| **Audio note stories** | **MISSING** | No option to record/upload audio-only stories |
| **Music file attachment (up to 4min)** | **MISSING** | Music library is hardcoded samples, no user upload |
| **Text-only stories** | **MISSING** | Must upload media — no text/gradient story option |

---

### D. Voice & Video Calling — `src/components/calls/`

| Feature | Status | Files |
|---------|--------|-------|
| 1:1 voice calls | Done | `Call.tsx`, `CallContext` |
| 1:1 video calls | Done | `Call.tsx`, `CallContext` |
| Floating call widget (minimized) | Done | `FloatingCallWidget.tsx` |
| Incoming call screen | Done | `IncomingCall.tsx`, `IncomingCallListener.tsx` |
| Call controls (mute/video/speaker) | Done | `CallControls.tsx` |
| Connection status indicator | Done | `ConnectionStatus.tsx` |
| Network quality indicator | Done | `NetworkQualityIndicator.tsx` |
| Share call link | Done | `ShareCallModal.tsx` |
| PiP mode | Done | `FloatingCallWidget.tsx` |
| Call history | Done | `CallHistory.tsx` page |
| Group calls (up to 4) | Done | `GroupCallRoom.tsx` |
| **Screen sharing** | **Partial** | LiveKit supports it but UI toggle may not be wired |

---

### E. Live Streaming — `src/components/live/stream-v2/`

| Feature | Status | Files |
|---------|--------|-------|
| Create livestream modal | Done | `CreateLiveStreamModal.tsx` |
| Video engine (LiveKit) | Done | `VideoEngine.tsx` |
| Stream chat | Done | `StreamChat.tsx` |
| Gift overlay + 85/15 split | Done | `GiftOverlay.tsx`, `LiveGiftModal` |
| Co-host/guests (up to 10) | Done | `StreamGuests.tsx` |
| POV multi-cam switcher | Done | `POVSwitcher.tsx` |
| Polls | Done | `PollSystem.tsx` |
| PK Battles (2-way, 4-way) | Done | `PKBattleBar`, `PKBattleChallenge` |
| Hype system (meter/particles/ticker) | Done | `HypeMeter.tsx`, `HypeParticles.tsx`, `EventTicker.tsx` |
| AI PULSE panel | Done | `AICatchUpPanel.tsx` |
| Co-Pilot (light/sound/predict) | Done | `CoPilotJoystick.tsx`, `LightFlashOverlay.tsx`, `PredictionSystem.tsx` |
| Feature toggles per mode | Done | `CreateLiveStreamModal.tsx` + `StreamRoomV2.tsx` |
| Stream reactions | Done | via `StreamControls.tsx` |
| In-stream recharge | Done | `InStreamRechargeSheet.tsx` |
| Live streak badges | Done | `LiveStreakBadge.tsx` |
| **Go Live from group chat** | **MISSING** | No integration point |

---

### F. Channels (Telegram-style) — **MISSING ENTIRELY**

No channel system exists. Channels would be broadcast-only spaces where admins post and members consume. This is a significant feature gap.

---

## Summary of Missing Features

```text
PRIORITY   FEATURE                              EFFORT
───────────────────────────────────────────────────
HIGH       PULSE host-editable cards             Small (UI + JSON storage)
HIGH       Channels system (Telegram-style)      Large (new tables, pages, components)
MEDIUM     Go Live from Group                    Medium (integration flow)
MEDIUM     Audio note stories                    Small (new story type)
MEDIUM     Music file upload in stories (4min)   Small (upload + validation)
MEDIUM     Music/audio file in chat (4min)       Small (upload + validation)
LOW        Text-only stories                     Small (new creation mode)
LOW        Screen sharing toggle in calls        Small (wire existing LiveKit API)
```

---

## Recommended Implementation Order

1. **PULSE host cards** — quick win, enhances live experience immediately
2. **Audio notes + music files in stories** — extends existing story infrastructure
3. **Music/audio file sharing in chat (4min limit)** — extends existing attachment picker
4. **Go Live from Group** — connects existing live system to groups
5. **Channels system** — largest feature, needs its own dedicated planning session

