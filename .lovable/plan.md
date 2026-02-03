
# Plan: Fix Live Streaming Chat, Reactions, Likes Count & Menu Features

## Issues Identified

| Issue | Root Cause | Solution |
|-------|------------|----------|
| **Chat not working** | `FlyingChat` in `LiveKitViewer.tsx` receives `messages={[]}` (empty array) instead of actual comments | Pass `comments` state to `FlyingChat` |
| **12K likes is mocked** | Hardcoded `12K` in `UnifiedRoom.tsx` line 726 | Replace with real-time reaction count from database |
| **Viewer count mismatch** | Viewer count on host avatar shows ~42 but database shows 0 | Sync with `live_stream_viewers` table and LiveKit room participants |
| **Three-dot menu empty** | `UnifiedControlBar.tsx` has `onClick={() => {}}` for MoreHorizontal | Implement proper options menu with relevant features |
| **No animated emoji reactions** | Missing `LiveReactionBar` component in viewer interface | Add animated emoji bar using `AnimatedEmojiButton` system |
| **No chat reactions** | Missing reaction feature in chat messages | Add reaction support to chat messages |

---

## Phase 1: Fix Chat Overlay in LiveKitViewer

### Problem
The `FlyingChat` component in `LiveKitViewer.tsx` (line 575) is receiving an empty array:
```typescript
<FlyingChat messages={[]} gifts={flyingGifts} hostId={stream?.user_id} />
```

### Solution
Pass the actual `comments` state to `FlyingChat`:
```typescript
<FlyingChat 
  messages={comments.map(c => ({
    id: c.id,
    content: c.content,
    user_id: c.user_id,
    created_at: c.created_at,
    profiles: c.profiles,
  }))} 
  gifts={flyingGifts} 
  hostId={stream?.user_id} 
/>
```

Similarly update `LiveKitBroadcaster.tsx` where the same pattern exists.

---

## Phase 2: Replace Mocked 12K Likes with Real Data

### Problem
In `UnifiedRoom.tsx` (line 726), likes are hardcoded:
```typescript
<span className="text-xs text-white mt-1">12K</span>
```

### Solution
1. Add state to track reaction count:
```typescript
const [reactionCount, setReactionCount] = useState(0);
```

2. Fetch initial count on mount:
```typescript
const { count } = await supabase
  .from("live_stream_reactions")
  .select("*", { count: 'exact', head: true })
  .eq("stream_id", room.id);
setReactionCount(count || 0);
```

3. Update count on each new reaction via realtime subscription

4. Display formatted count:
```typescript
<span className="text-xs text-white mt-1">
  {reactionCount >= 1000 ? `${(reactionCount/1000).toFixed(1)}K` : reactionCount}
</span>
```

Also apply same fix in `LiveKitViewer.tsx` reactions sidebar.

---

## Phase 3: Add Three-Dot Menu with Stream Options

### Current State
```typescript
<ControlButton
  icon={<MoreHorizontal className="w-5 h-5" />}
  onClick={() => {}} // Empty handler
/>
```

### Solution
Create a `StreamOptionsMenu` component with relevant features:

**For Viewers:**
- Report Stream
- Share Stream
- Copy Link
- Block Host
- Turn on/off Notifications
- Picture-in-Picture mode

**For Host:**
- Stream Settings
- Viewer Management
- Lock/Unlock Chat
- End Stream
- Go to Picture-in-Picture

Implementation using Radix DropdownMenu:
```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <ControlButton icon={<MoreHorizontal />} onClick={() => {}} />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={handleShare}>
      <Share2 className="mr-2" /> Share
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleReport}>
      <Flag className="mr-2" /> Report
    </DropdownMenuItem>
    // ... more options
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Phase 4: Add Animated Emoji Reactions Bar

### Current State
Reactions in `LiveKitViewer.tsx` use basic button UI:
```typescript
{REACTIONS.map((reaction) => (
  <Button ... onClick={() => sendReaction(reaction.type)}>
    <span className="text-2xl">{reaction.emoji}</span>
  </Button>
))}
```

### Solution
Replace with the existing `LiveReactionBar` component from `AnimatedEmojiButton.tsx`:

```typescript
import { LiveReactionBar, LIVE_REACTIONS } from '@/components/shared/AnimatedEmojiButton';

// In component:
<LiveReactionBar 
  onReact={(reactionType) => sendReaction(reactionType)}
  className="flex-col"
/>
```

This provides:
- Animated particle burst effects on tap
- Scaling hover animations
- Consistent design across app
- 6 reaction types: Heart, Fire, Star, Clap, Like, Love

---

## Phase 5: Add Chat Message Reactions

### Feature Description
Allow users to react to individual chat messages with emojis (like Twitch/YouTube Live).

### Database Changes
Create new table `live_stream_chat_reactions`:
```sql
CREATE TABLE public.live_stream_chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES live_stream_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Enable RLS
ALTER TABLE public.live_stream_chat_reactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view all chat reactions"
  ON public.live_stream_chat_reactions FOR SELECT USING (true);
  
CREATE POLICY "Authenticated users can react"
  ON public.live_stream_chat_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can remove own reactions"
  ON public.live_stream_chat_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_chat_reactions;
```

### UI Implementation
Add long-press/tap handler to chat messages that shows quick reaction picker.

---

## Phase 6: Sync Real Viewer Count

### Problem
Database shows `viewer_count: 0` even when viewers are connected.

### Solution
1. Update `live_stream_viewers` table on join/leave
2. Use LiveKit room participant count as ground truth
3. Periodically sync to database (every 30s)

```typescript
// In LiveKitViewer - when joining
useEffect(() => {
  const updateViewerCount = async () => {
    await supabase.rpc('increment_viewer_count', { stream_id: streamId });
  };
  updateViewerCount();
  
  return () => {
    supabase.rpc('decrement_viewer_count', { stream_id: streamId });
  };
}, [streamId]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/live/LiveKitViewer.tsx` | Pass comments to FlyingChat, add real reaction count, use LiveReactionBar |
| `src/components/live/LiveKitBroadcaster.tsx` | Pass comments to FlyingChat, use LiveReactionBar |
| `src/components/live/unified/UnifiedRoom.tsx` | Replace 12K with real count, add reactions fetch |
| `src/components/live/unified/UnifiedControlBar.tsx` | Implement MoreHorizontal menu |

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/live/StreamOptionsMenu.tsx` | Dropdown menu for stream options |

## Database Migration

```sql
-- 1. Add viewer count sync function
CREATE OR REPLACE FUNCTION increment_viewer_count(stream_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE live_streams 
  SET viewer_count = viewer_count + 1 
  WHERE id = stream_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_viewer_count(stream_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE live_streams 
  SET viewer_count = GREATEST(viewer_count - 1, 0) 
  WHERE id = stream_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create chat reactions table (for Phase 5)
CREATE TABLE IF NOT EXISTS public.live_stream_chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES public.live_stream_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

ALTER TABLE public.live_stream_chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view chat reactions" ON public.live_stream_chat_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can add reactions" ON public.live_stream_chat_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions" ON public.live_stream_chat_reactions
  FOR DELETE USING (auth.uid() = user_id);
```

---

## Visual Summary

```text
BEFORE                          AFTER
┌─────────────────────┐        ┌─────────────────────┐
│ Chat: Empty         │   →    │ Chat: Real messages │
│ Likes: 12K (fake)   │   →    │ Likes: 47 (real)    │
│ Menu: Nothing       │   →    │ Menu: Options popup │
│ Reactions: Basic    │   →    │ Reactions: Animated │
│ Chat msgs: No react │   →    │ Chat msgs: Reactable│
└─────────────────────┘        └─────────────────────┘
```

---

## Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Send chat as viewer | Message appears in flying chat overlay |
| Send chat as host | Message appears for all viewers |
| Tap heart reaction | Count increases, animation plays |
| Tap three-dot menu | Options dropdown appears |
| Long-press chat message | Reaction picker shows |
| Join as viewer | Viewer count increments |
| Leave stream | Viewer count decrements |
