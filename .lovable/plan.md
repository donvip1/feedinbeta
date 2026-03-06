

## Video Stream Room Overhaul Plan

### Problems Identified

1. **Reactions broken for viewers**: Stream uses `postgres_changes` on `live_stream_reactions` table, but the space (which works) uses a **broadcast channel**. The broadcast approach is faster and doesn't require DB inserts to propagate.
2. **Chat not showing**: Messages are sent via `live_stream_messages` table + broadcast, but the flying chat only shows last 15 messages and the broadcast refetch may not trigger properly. Also, sent messages aren't added to local state immediately (optimistic update missing).
3. **Gift/credit counter for host missing**: Space has `hostGiftTotal` state that tracks gifts received — stream room has no equivalent.
4. **Screen share & recording**: User explicitly says remove these — they're not needed for video streams.
5. **Camera flip broken**: The `restartTrack` approach may fail on some devices. Needs fallback to stop+recreate track.
6. **PK Battle non-functional**: `PKBattleChallenge` component opens but doesn't actually start a battle — it just shows a toast.
7. **UI dull/not responsive**: Bottom bar too cluttered with screen share + recording + camera + mic + chat + gift. Needs cleanup and better mobile layout.
8. **Gift modal works but uses Dialog component** — looks out of place in a fullscreen video room.

### Changes to `TwitterStreamRoom.tsx`

**Remove entirely:**
- Screen share state, refs, handlers (`screenTrackRef`, `isScreenSharing`, `handleScreenShare`, `createLocalScreenTracks` import)
- Recording state, refs, handlers (`mediaRecorderRef`, `recordingChunksRef`, `isRecording`, `recordingLoading`, `handleRecordingToggle`)
- Screen share button from bottom bar
- Recording button/indicator from bottom bar
- Monitor import from lucide

**Fix reactions — switch to broadcast channel (matching space pattern):**
- Change `handleReaction` to broadcast via `supabase.channel().send({ type: 'broadcast', event: 'reaction', payload: { emoji, user_id, display_name } })`
- Change subscription from `postgres_changes` on `live_stream_reactions` to `broadcast` listener on `stream-reactions-{streamId}`
- Still insert into `live_stream_reactions` for persistence, but don't rely on it for UI

**Fix chat — add optimistic updates:**
- After `handleReplySubmit`, immediately push the new message into `replies` state (don't wait for refetch)
- This matches what the space does

**Add host gift counter:**
- Add `hostGiftTotal` state (copy from space)
- Fetch initial total from `live_stream_gifts` on mount
- Update counter in the gift realtime subscription when `receiver_id === stream.user_id`
- Display as a badge below host tag: "Gifts: {count}"

**Fix camera flip:**
- If `restartTrack` fails, fallback to: stop current track → create new track with opposite `facingMode` → unpublish old → publish new

**Improve PK Battle:**
- Wire `onSelectChallenger` to actually call `usePKBattle.createBattle()` and `sendChallenge()`
- Import and use the `usePKBattle` hook

**UI/UX improvements:**
- Clean up bottom bar: only show Mic (host), Chat input, Gift button, Camera toggle (host)
- Move settings (⋯) to header next to "HD Live" badge (matching space pattern)
- Add `QuickGiftBar` as an alternative to the full modal for fast gifting (matching space)
- Ensure all overlays use `pb-safe` and `pt-safe` for mobile
- Add proper `min-h-[100dvh]` for mobile viewport

### Files to Modify

1. **`src/components/live/twitter-space/TwitterStreamRoom.tsx`** — All changes above
2. No other files need modification

### What stays the same
- LiveKit initialization logic
- All Supabase table structures
- LiveGiftModal (still available for full gift UI)
- Guest list view
- Share menu
- All modals (Report, Rules, Feedback, Audio Settings)
- FloatingReactions component

