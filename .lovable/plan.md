
# Twitter/X Spaces UI Integration Plan

## Overview

This plan integrates the provided Twitter/X Spaces-style UI code into the existing live streaming infrastructure while preserving:
- **Gift/Credit System** - Full 85/15 revenue split, gift animations, LiveGiftModal
- **Recording** - LiveKit Egress recording with PostRecordingModal
- **Screen Sharing** - Host-only screen share via LiveKit
- **LiveKit Server** - All existing LiveKit token generation and room management

The new UI brings a Twitter Spaces-like experience with:
- Dark theme with user grid layout
- Floating reaction animations
- Slide-out chat sidebar
- Guest management overlay
- Reaction picker with emoji grid
- Share and settings menus

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    New Component Structure                  │
├─────────────────────────────────────────────────────────────┤
│  TwitterSpaceRoom.tsx (New - Main Component)                │
│  ├── Uses existing SpaceContext / UnifiedLiveContext        │
│  ├── Uses existing LiveKit integration                      │
│  ├── Integrates existing LiveGiftModal                      │
│  ├── Integrates existing SpeakerQueuePanel                  │
│  └── New UI overlays: Chat, Guests, Settings, Reactions     │
│                                                             │
│  Sub-components (New):                                      │
│  ├── TwitterSpaceHeader.tsx                                 │
│  ├── TwitterSpaceUserGrid.tsx                               │
│  ├── TwitterSpaceControls.tsx                               │
│  ├── TwitterSpaceChat.tsx (slide-out sidebar)               │
│  ├── TwitterSpaceGuests.tsx (full-screen overlay)           │
│  ├── TwitterSpaceReactionPicker.tsx                         │
│  └── TwitterSpaceShareMenu.tsx                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Create Core Component Structure

### 1.1 Create `TwitterSpaceRoom.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceRoom.tsx`

Main container component that:
- Accepts `spaceId` and `onClose` props (same as existing LiveSpaceRoom)
- Uses `SpaceContext` for audio connection and state management
- Uses existing LiveKit token generation via `livekit-token` edge function
- Manages view state: `'main' | 'guests'`
- Manages overlay states: `showChat`, `showReactions`, `showShare`, `showSettings`
- Fetches space data and speakers from `live_spaces` and `live_space_speakers` tables

**Key State:**
```typescript
const [view, setView] = useState<'main' | 'guests'>('main');
const [showChat, setShowChat] = useState(false);
const [showReactions, setShowReactions] = useState(false);
const [showShare, setShowShare] = useState(false);
const [showSettings, setShowSettings] = useState(false);
const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
```

**Preserves from existing code:**
- `useAuth()` for user authentication
- `useOptionalSpaceContext()` for audio management
- `useNavigation()` to hide bottom nav
- All LiveKit connection logic from SpaceContext

### 1.2 Create `TwitterSpaceHeader.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceHeader.tsx`

Minimal header with:
- Back arrow (minimize/navigate away while keeping audio)
- Settings gear icon (opens settings menu)
- Leave button (red, actually disconnects)

```typescript
interface TwitterSpaceHeaderProps {
  onBack: () => void;
  onSettings: () => void;
  onLeave: () => void;
  isHost: boolean;
}
```

### 1.3 Create `TwitterSpaceUserGrid.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceUserGrid.tsx`

Grid of user avatars showing:
- Speaking ring animation (green pulsing when user is speaking)
- Muted indicator badge
- Verified checkmark
- Role label (Host/Speaker/Listener)

Uses existing `audioLevels` from SpaceContext to determine who is speaking.

```typescript
interface UserGridProps {
  speakers: Speaker[];
  audioLevels: Record<string, number>;
  onUserClick?: (userId: string) => void;
}
```

### 1.4 Create `TwitterSpaceControls.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceControls.tsx`

Bottom control bar with:
- **Mic button** - Request to speak / toggle mute (uses existing `toggleMute`)
- **Guests button** - Opens guests overlay
- **Reactions button** - Opens reaction picker
- **Share button** - Opens share menu
- **Chat button** - Opens chat sidebar with unread badge

For hosts, shows direct mic toggle instead of "Request".

```typescript
interface ControlsProps {
  isMicOn: boolean;
  onMicToggle: () => void;
  onGuestsClick: () => void;
  onReactionsClick: () => void;
  onShareClick: () => void;
  onChatClick: () => void;
  unreadCount: number;
  canSpeak: boolean;
  hasRaisedHand: boolean;
}
```

---

## Phase 2: Overlay Components

### 2.1 Create `TwitterSpaceReactionPicker.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceReactionPicker.tsx`

Modal overlay with emoji grid:
- Emoji array: `['😂', '😮', '😢', '💜', '💯', '👏', '✊', '👍', '👎', '👋']`
- On select: triggers floating animation + broadcasts to all participants
- Uses existing reaction broadcast channel: `space-reactions-{spaceId}`

Floating reactions will animate upward with CSS keyframe animation:
```css
@keyframes space-float {
  0% { transform: translateY(0) scale(1); opacity: 0; }
  10% { opacity: 1; transform: translateY(-20px) scale(1.5); }
  100% { transform: translateY(-500px) scale(0.8); opacity: 0; }
}
```

### 2.2 Create `TwitterSpaceShareMenu.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceShareMenu.tsx`

Bottom sheet menu with options:
- Share via post (navigates to compose with space link)
- Invite via Chat (opens existing SpaceInviteModal)
- Copy Link (uses existing `shareUrls.liveSpace()`)
- Share via... (native share API)

### 2.3 Create `TwitterSpaceSettingsMenu.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceSettingsMenu.tsx`

Settings bottom sheet:
- Adjust settings (audio preferences)
- Share feedback
- View rules
- View captions toggle
- Report this Space

### 2.4 Create `TwitterSpaceGuests.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceGuests.tsx`

Full-screen overlay showing:
- Search bar for filtering
- Tab bar: All | Co-hosts | Speakers | Listening
- Sectioned list: Host → Speakers → Listeners
- Shows speaker count and open spots

For hosts: Includes ability to promote/demote users (uses existing `promoteSpeaker`, `removeSpeaker` functions)

### 2.5 Create `TwitterSpaceChat.tsx`

**File:** `src/components/live/twitter-space/TwitterSpaceChat.tsx`

Right slide-out sidebar with:
- Space info header (title, host, live indicator)
- Stats (duration, views, reposts, likes)
- Replies feed (uses existing `live_space_messages` table)
- Reply input at bottom

```typescript
interface SpaceChatProps {
  spaceId: string;
  spaceTitle: string;
  hostName: string;
  onClose: () => void;
}
```

---

## Phase 3: Integrate Existing Features

### 3.1 Gift System Integration

The new `TwitterSpaceRoom` will:
- Import and use existing `LiveGiftModal`
- Show gift button in user actions (tap on avatar → gift)
- Display gift animations using existing `giftAnimations` state pattern
- Use existing `send_gift` RPC and credit transaction system

Add gift button to `TwitterSpaceControls`:
```typescript
<GiftButton onClick={() => setShowGiftModal(true)} />
```

### 3.2 Recording Integration

For hosts only:
- Add record button to controls (uses existing `isRecording` state)
- Integrate existing recording logic from `LiveSpaceRoom`:
  - Toggle recording state
  - On end, check for `recording_url` in database
  - Show `PostRecordingModal` if recording exists

### 3.3 Screen Sharing Integration

For hosts only:
- Add screen share button to controls
- Use existing `startScreenShare` / `stopScreenShare` functions
- Display screen share overlay when active (existing pattern)

### 3.4 Hand Raise Integration

For listeners:
- "Request" button triggers `toggleRaiseHand`
- Uses existing database update to `live_space_speakers.has_raised_hand`
- For hosts: See raised hands count in Guests overlay
- Uses existing `SpeakerQueuePanel` for managing queue

---

## Phase 4: Update Routing

### 4.1 Create Option to Use New UI

**File:** `src/pages/SpaceDetail.tsx`

Add feature flag or default to new UI:
```typescript
const useTwitterUI = true; // Or read from user preferences

if (showRoom && space) {
  return useTwitterUI ? (
    <TwitterSpaceRoom spaceId={space.id} onClose={handleClose} />
  ) : (
    <LiveSpaceRoom spaceId={space.id} onClose={handleClose} />
  );
}
```

### 4.2 Export from Index

**File:** `src/components/live/twitter-space/index.ts`

```typescript
export { TwitterSpaceRoom } from './TwitterSpaceRoom';
```

---

## Phase 5: Styling

### 5.1 Dark Theme

All new components use:
- Background: `bg-zinc-950` (near black)
- Text: `text-white` / `text-zinc-400`
- Accents: `bg-purple-600` (primary actions)
- Borders: `border-zinc-800`

### 5.2 Animations

Using Framer Motion for:
- Floating reactions (float up and fade)
- Chat sidebar slide-in
- Guests overlay transitions
- Menu appear/disappear

### 5.3 Mobile-First

All layouts optimized for mobile:
- Full-screen overlays
- Touch-friendly tap targets (44px minimum)
- Safe area padding for notched devices

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/live/twitter-space/TwitterSpaceRoom.tsx` | Main container |
| `src/components/live/twitter-space/TwitterSpaceHeader.tsx` | Top header |
| `src/components/live/twitter-space/TwitterSpaceUserGrid.tsx` | User avatar grid |
| `src/components/live/twitter-space/TwitterSpaceControls.tsx` | Bottom controls |
| `src/components/live/twitter-space/TwitterSpaceChat.tsx` | Chat sidebar |
| `src/components/live/twitter-space/TwitterSpaceGuests.tsx` | Guests overlay |
| `src/components/live/twitter-space/TwitterSpaceReactionPicker.tsx` | Emoji picker |
| `src/components/live/twitter-space/TwitterSpaceShareMenu.tsx` | Share menu |
| `src/components/live/twitter-space/TwitterSpaceSettingsMenu.tsx` | Settings menu |
| `src/components/live/twitter-space/index.ts` | Barrel export |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/SpaceDetail.tsx` | Route to new `TwitterSpaceRoom` |

---

## Technical Notes

### LiveKit Preservation
- All LiveKit logic remains in `SpaceContext.tsx`
- Token generation via `livekit-token` edge function unchanged
- Audio level monitoring continues via `audioLevels` state

### Database Schema
No changes needed - uses existing tables:
- `live_spaces` - Space metadata
- `live_space_speakers` - Participants with roles
- `live_space_messages` - Chat messages
- `live_space_reactions` - Reactions
- `live_space_gifts` - Gift transactions

### Real-time Channels
Uses existing Supabase channels:
- `space-{spaceId}` - Presence and status
- `space-reactions-{spaceId}` - Reaction broadcasts
- `space-control-{spaceId}` - Mute/unmute broadcasts
- `speaker-queue-{spaceId}` - Hand raise updates

---

## Expected Result

After implementation:
1. User navigates to `/live/space/{spaceId}`
2. `SpaceDetail.tsx` loads the new `TwitterSpaceRoom`
3. User sees Twitter/X Spaces-like dark UI
4. All existing features work: audio, gifts, recording, screen share
5. New UI overlays for chat, guests, reactions, share, settings
