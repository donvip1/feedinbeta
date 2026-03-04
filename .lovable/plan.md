

# UI/UX Overhaul: Live Dashboard + Space Room

## Summary

Update the visual design of the Live Dashboard, GoLiveModal, LiveSpaceRoom, FloatingSpacePlayer, and SpeakerAvatarWithWaves to adopt the reference code's premium dark aesthetic (bg-[#050505], rounded-[2.5rem], purple/pink accents, ultra-rounded controls) while keeping all existing backend logic, credit system, LiveKit audio, and database integrations intact.

**Important**: The build output you saw is NOT an error — it's a successful build (✓ 6543 modules transformed). The output is just truncated due to listing many asset files.

---

## What Changes (UI Only — No Backend Changes)

### 1. LiveDashboard.tsx — Visual Refresh
- **Hero Card**: Replace current gradient card with the reference's "Creator Studio" style — larger icon (Radio w/ animate-pulse), `bg-gradient-to-br from-[#11131E] to-[#0a0b12]`, rounded-[2.5rem], "START GOING LIVE" white button with Play icon
- **Filter Tabs**: Add purple underline indicator (bg-purple-500) instead of current pink-to-violet gradient
- **Header subtitle**: Change "Watch active streams" → "Global Spaces" with tracking-widest uppercase styling  
- **Room cards**: Replace the grid of `LiveDiscoverCard` with a **list-style RoomCard** (reference's `RoomCard` layout) — horizontal card with host avatar, title, trending score badge (Flame icon), stacked participant avatars in top-right, bg-[#11131E] rounded-[2.5rem]
- Keep: All data fetching, realtime subscriptions, category filtering, recommended creators, scheduled section

### 2. GoLiveModal.tsx — "Broadcast Center" Redesign
- Rename header to "Broadcast Center" with subtitle "Select your medium"
- Use rounded-[3rem] modal with gradient top-line accent
- Bigger option buttons with rounded-[2.5rem], 16x16 icon containers, ChevronRight arrows
- Add security notice at bottom (Shield icon + "Secure broadcasting enabled" message)
- Keep: canLivestream permission check, video lock for non-Popular users, all navigation logic

### 3. LiveSpaceRoom.tsx — Immersive Room Redesign
- **Background**: Change from `bg-gradient-to-b from-background` to `bg-[#050505]` full dark
- **Header**: Replace current sticky header with the reference's minimal bar — Minimize2 button (left), "HD Audio" badge with Signal icon (purple), Share2 + Leave button (right, red rounded-full)
- **Room Info**: Large centered host avatar (w-24 h-24 rounded-[2.5rem]) with Crown badge, title centered, pill-style viewer/speaker counts
- **Speaker Grid**: 3-4 column grid using updated SpeakerAvatarWithWaves
- **Listeners Section**: Smaller grid (4-6 cols) with rounded-2xl avatars, "requested" count badge
- **Control Bar**: Replace current bottom bar with reference's `rounded-t-[3rem] bg-[#0F1119]` bar — ControlButton components with labels (Muted/On Air, Request), pink Gift button, MessageSquare, MoreHorizontal
- **Gift Overlay**: Full-screen overlay with 2-col grid of gift items (bigger emojis, Sparkles cost indicator, "Your Balance" footer with Trophy icon + Refill button)
- Keep: ALL business logic — toggleMute, toggleRaiseHand, sendReaction, endSpace, handleShare, screen sharing, host controls, speaker promotion, SpaceContext integration, realtime subscriptions, gift transactions

### 4. FloatingSpacePlayer.tsx — Minimized Widget
- Update to reference's style: `bg-[#11131E]/90 backdrop-blur-xl rounded-[2rem]`
- Green dot connection indicator on host avatar
- "Live Session" pulsing red dot label
- Maximize2 + X buttons (smaller, ghost style)
- Keep: drag controls, snap-to-edges, SpaceContext integration, mute toggle

### 5. SpeakerAvatarWithWaves.tsx — Enhanced Speaking Indicators
- Replace current wave rings with reference's **ping-style borders**: `animate-[ping_2s_infinite]` outer ring, `animate-[ping_1.5s_infinite]` inner ring
- Avatar container: `rounded-[2.2rem]` with gradient border (`from-purple-500 to-pink-500` when speaking)
- **Microbadge**: Crown badge (amber-400, rounded-xl) for hosts, Volume2 bounce badge (purple-600) when speaking
- Role label: `text-[8px] uppercase tracking-widest`, amber-400 for hosts
- Keep: All host controls dropdown, gift button, audio level detection, profile click, host-mute indicators

---

## Files Modified (6 files, UI-only changes)

| File | Change Type |
|------|-------------|
| `src/components/live/LiveDashboard.tsx` | Visual refresh — hero card, room cards, header styling |
| `src/components/live/GoLiveModal.tsx` | Redesign to "Broadcast Center" with security notice |
| `src/components/live/LiveSpaceRoom.tsx` | Full room UI overhaul — header, speaker grid, control bar |
| `src/components/live/FloatingSpacePlayer.tsx` | Updated minimized widget styling |
| `src/components/live/SpeakerAvatarWithWaves.tsx` | New speaking indicator animations |
| `src/components/live/LiveDiscoverCard.tsx` | Update to list-style RoomCard layout |

## What Does NOT Change
- No database migrations
- No edge function changes  
- All credit/gift transaction logic stays identical (85/15 split, credit_transactions inserts)
- LiveKit/SFU audio connections unchanged
- SpaceContext, LiveStreamContext unchanged
- All realtime subscriptions unchanged
- Permission checks (useLivestreamPermission) unchanged
- All modals (TestAudioModal, SpaceInviteModal, LiveGiftModal, SpeakerQueuePanel) keep working

