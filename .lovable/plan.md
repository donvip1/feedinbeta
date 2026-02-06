
# Twitter Spaces Settings & Gift System Enhancement Plan

## Overview

This plan addresses two major gaps in the current Twitter Space UI:

1. **Settings Menu Features** - Make all settings options functional with proper modals/pages
2. **Gift System Integration** - Restore the gift/credit features with TikTok-style animations

---

## Part 1: Functional Settings Menu

The current settings menu (lines 956-1008 in `TwitterSpaceRoom.tsx`) shows toast messages instead of actual functionality. We need to create proper components for each feature.

### 1.1 Space Rules Modal

**New Component:** `src/components/live/twitter-space/SpaceRulesModal.tsx`

A bottom sheet modal displaying space rules:
- Community guidelines
- No harassment or hate speech
- No spam or misleading content
- Respect other participants
- Follow platform terms of service

The rules will be hard-coded but styled as a proper scrollable modal with:
- Dark theme matching the space UI
- Close button
- Animated entrance (slide up from bottom)

### 1.2 Share Feedback Modal

**New Component:** `src/components/live/twitter-space/SpaceFeedbackModal.tsx`

A feedback form with:
- Star rating (1-5 stars)
- Optional text feedback area
- Submit button
- Data saved to a `space_feedback` table (will need migration)

Database migration needed:
```sql
CREATE TABLE space_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES live_spaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE space_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own feedback" ON space_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own feedback" ON space_feedback FOR SELECT USING (auth.uid() = user_id);
```

### 1.3 Audio Settings Modal

**New Component:** `src/components/live/twitter-space/SpaceAudioSettingsModal.tsx`

Audio configuration options:
- Input device selection (microphone dropdown)
- Output device selection (speaker dropdown)
- Volume slider
- Echo cancellation toggle
- Noise suppression toggle

Uses the Web Audio API and LiveKit's device management.

### 1.4 Report Space Integration

**Update:** Integrate the existing `ReportContentModal` component

In `TwitterSpaceRoom.tsx`, add state and import:
```typescript
import { ReportContentModal } from '@/components/moderation/ReportContentModal';

const [showReportModal, setShowReportModal] = useState(false);
```

Update the "Report this Space" button to open the modal:
```typescript
onClick={() => {
  setShowSettings(false);
  setShowReportModal(true);
}}
```

Render the modal:
```tsx
<ReportContentModal
  isOpen={showReportModal}
  onClose={() => setShowReportModal(false)}
  contentType="live_stream"
  contentId={spaceId}
  reportedUserId={space?.user_id}
/>
```

---

## Part 2: Gift System Restoration

The current `TwitterSpaceRoom` has `LiveGiftModal` imported but no gift button or animations. We need to restore:
1. Gift button in controls
2. TikTok-style gift animations
3. Real-time gift notifications in chat

### 2.1 Add Gift Button to Controls

In the bottom controls section (around line 850), add a gift button:

```tsx
{/* Gift Button - For viewers */}
{!isHost && (
  <button
    onClick={() => setShowGiftModal(true)}
    className="p-2 text-zinc-400 hover:text-amber-400 transition-colors"
  >
    <Gift className="w-6 h-6" />
  </button>
)}

{/* Host Gift Viewers Button */}
{isHost && (
  <button
    onClick={() => setShowGiftModal(true)}
    className="p-2 text-teal-400 hover:text-teal-300 transition-colors"
  >
    <Gift className="w-6 h-6" />
  </button>
)}
```

### 2.2 Gift Animation State

Add state for gift animations:
```typescript
interface GiftAnimation {
  id: string;
  emoji: string;
  senderName: string;
  receiverName: string;
  value: number;
}

const [giftAnimations, setGiftAnimations] = useState<GiftAnimation[]>([]);
```

### 2.3 Real-time Gift Subscription

Add a subscription to `live_space_gifts` table for real-time gift notifications:

```typescript
// In the realtime subscriptions useEffect
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'live_space_gifts',
  filter: `space_id=eq.${spaceId}`,
}, async (payload: any) => {
  const giftData = payload.new;
  
  // Fetch sender and receiver profiles
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', giftData.sender_id)
    .single();
  
  const { data: receiverProfile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', giftData.receiver_id)
    .single();
  
  const giftEmojis = {
    rose: '🌹', coffee: '☕', heart: '❤️', diamond: '💎',
    rocket: '🚀', castle: '🏰', crown: '👑', universe: '🌌',
  };
  
  const newGiftAnim = {
    id: giftData.id,
    emoji: giftEmojis[giftData.gift_type] || '🎁',
    senderName: senderProfile?.display_name || 'Someone',
    receiverName: receiverProfile?.display_name || 'Host',
    value: giftData.credit_value || 1,
  };
  
  setGiftAnimations(prev => [...prev, newGiftAnim]);
  
  // Remove after 5 seconds
  setTimeout(() => {
    setGiftAnimations(prev => prev.filter(g => g.id !== newGiftAnim.id));
  }, 5000);
})
```

### 2.4 Gift Animation UI

Add the TikTok-style gift notification banner (copied from `LiveSpaceRoom.tsx`):

```tsx
{/* Gift Animations - TikTok style notifications */}
<AnimatePresence>
  {giftAnimations.map((gift) => (
    <motion.div
      key={gift.id}
      initial={{ opacity: 0, x: -100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      transition={{ type: 'spring', damping: 20 }}
      className="absolute left-4 top-1/3 z-50 max-w-[280px]"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/90 to-pink-500/90 backdrop-blur-sm shadow-lg">
        <motion.span 
          className="text-3xl"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 0.5, repeat: 2 }}
        >
          {gift.emoji}
        </motion.span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {gift.senderName}
          </p>
          <p className="text-white/80 text-xs truncate">
            sent {gift.emoji} to {gift.receiverName}
          </p>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20">
          <span className="text-white text-xs font-bold">+{gift.value}</span>
        </div>
      </div>
    </motion.div>
  ))}
</AnimatePresence>
```

### 2.5 Gift Notification in Chat

When a gift is sent, add a styled message to the chat:

```typescript
// In the gift subscription callback, also add to chat
const giftChatMessage = {
  id: `gift-${giftData.id}`,
  user_id: giftData.sender_id,
  user: senderProfile?.display_name || 'Someone',
  handle: '@' + (senderProfile?.username || 'user'),
  time: 'Just now',
  text: `🎁 Sent ${giftEmojis[giftData.gift_type]} ${giftData.gift_type} (${giftData.credit_value} credits)`,
  avatar: '',
  likes: 0,
  liked_by_me: false,
  isGift: true, // Flag for special styling
};

setReplies(prev => [...prev, giftChatMessage]);
```

Then in the chat rendering, add special styling for gift messages:
```tsx
{reply.isGift && (
  <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-lg px-2 py-1 inline-block">
    <span className="text-pink-400 font-medium">{reply.text}</span>
  </div>
)}
```

---

## Part 3: Update LiveGiftModal Props

The `LiveGiftModal` is already imported but needs the `isSpace={true}` prop to insert gifts into `live_space_gifts` instead of `live_stream_gifts`:

```tsx
<LiveGiftModal
  isOpen={showGiftModal}
  onClose={() => setShowGiftModal(false)}
  streamId={spaceId}
  hostId={space?.user_id || ''}
  viewers={speakers.map(s => ({
    id: s.user_id,
    display_name: s.profile?.display_name || 'User',
    username: s.profile?.username || 'user',
    avatar_url: s.profile?.avatar_url || '',
  }))}
  isHost={isHost}
  isSpace={true}  // ADD THIS PROP
/>
```

---

## Files to Create

| File | Description |
|------|-------------|
| `src/components/live/twitter-space/SpaceRulesModal.tsx` | Space rules display |
| `src/components/live/twitter-space/SpaceFeedbackModal.tsx` | Feedback form |
| `src/components/live/twitter-space/SpaceAudioSettingsModal.tsx` | Audio device settings |

## Files to Modify

| File | Changes |
|------|-------------|
| `src/components/live/twitter-space/TwitterSpaceRoom.tsx` | Add gift button, gift animations, report modal, new settings modals, isSpace prop |

## Database Migration

Create `space_feedback` table for storing user feedback on spaces.

---

## Summary

After implementation:

1. **Adjust Settings** - Opens audio settings modal with device selection
2. **Share Feedback** - Opens feedback form to rate and comment on the space  
3. **View Rules** - Opens modal with community guidelines
4. **Report this Space** - Opens the existing report modal (saves to `content_reports`)
5. **Gift Button** - Visible in controls, opens `LiveGiftModal`
6. **Gift Animations** - TikTok-style banners slide in when gifts are sent
7. **Gift Chat Messages** - Special styled messages appear in the chat sidebar
