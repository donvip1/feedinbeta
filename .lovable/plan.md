
# Plan: Modern Live Dashboard with Hidden Navigation

## Overview

This plan modernizes the Live page (`/live`) with a TikTok/Tango-style interface based on your reference code, while ensuring the bottom navigation bar (Home, Messages, Wallet, etc.) is completely hidden. A back button will be added for easy navigation back to the feed.

## Current Issues Identified

| Issue | Current Behavior | Required |
|-------|-----------------|----------|
| Navigation Bar | Shows on `/live` route | Should be hidden |
| Live Page Design | Traditional card-based layout | Modern TikTok-style dashboard |
| Back Navigation | No back button | Need back arrow to return to feed |
| Live Room Navigation | BottomNav still visible | Fullscreen immersive experience |

## Solution Overview

```text
LIVE PAGE (/live)
┌─────────────────────────────────────────────┐
│ ← Back    Discover    🔔 + ⋮              │  ← Header with back button
├─────────────────────────────────────────────┤
│  All  Popular  Music  Gaming  Chat          │  ← Filter tabs
├─────────────────────────────────────────────┤
│ ┌───────────────────────────────────────┐  │
│ │    [Your Profile Avatar]              │  │
│ │    Ready to broadcast                 │  │
│ │    Start your Live Journey            │  │
│ │    [Go Live Button]                   │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ Trending Now                       View All │
│ ┌─────────┐  ┌─────────┐                   │
│ │  LIVE   │  │  LIVE   │                   │
│ │ Stream  │  │ Space   │                   │
│ │ Preview │  │ Preview │                   │
│ └─────────┘  └─────────┘                   │
│                                             │
│ Recommended For You                         │
│ [Creator 1] [Creator 2] [Creator 3]        │
└─────────────────────────────────────────────┘
                NO BOTTOM NAV
```

## Phase 1: Hide Navigation on Live Page

### 1.1 Update NavigationContext

Add `/live` (exact match) to the hidden nav routes:

```typescript
// Current HIDDEN_NAV_ROUTES
const HIDDEN_NAV_ROUTES = [
  '/live/stream/',
  '/live/space/',
  '/space/'
];

// NEW - Add exact /live path detection
const isLiveStreamPage = useMemo(() => {
  const pathname = location.pathname;
  // Hide on exact /live AND on live stream/space detail pages
  return pathname === '/live' || 
         HIDDEN_NAV_ROUTES.some(route => pathname.startsWith(route));
}, [location.pathname]);
```

### 1.2 Remove BottomNav from Live.tsx

The current Live.tsx explicitly renders `<BottomNav />` at line 885. This will be removed since the NavigationContext will handle hiding it.

## Phase 2: Create Modern Live Dashboard Component

### 2.1 New Component: `src/components/live/LiveDashboard.tsx`

A new modern dashboard component based on your reference code:

**Key Features:**
- Glassmorphism header with back button
- Modern filter tabs (All, Popular, Music, Gaming, Chat)
- "Go Live" CTA card with user avatar and decorative circles
- Trending section with 4:5 aspect ratio preview cards
- Recommended creators section
- No external navigation elements

**Header Structure:**
```typescript
<div className="flex items-center justify-between">
  <button onClick={() => navigate('/feed')}>
    <ArrowLeft className="w-5 h-5" />
  </button>
  <div>
    <h1>Discover</h1>
    <p>Watch active streams</p>
  </div>
  <div className="flex gap-2">
    <button><Search /></button>
    <button><Bell /></button>
    <button><Plus /></button>
  </div>
</div>
```

### 2.2 Modern Feed Item Component

Update `LiveFeedItem.tsx` with the reference design:
- 4:5 aspect ratio cards
- Gradient overlays
- Live badge + room type badge
- Host avatar with level indicator
- Viewer count and quality badge

## Phase 3: Restructure Live.tsx

### 3.1 New Page Structure

Replace the current Live.tsx layout with a cleaner structure:

```typescript
const Live = () => {
  // ... existing queries and state ...
  
  // Render modals/overlays (keep existing logic)
  if (selectedStreamId) return <LiveKitViewer ... />;
  if (isBroadcasting) return <LiveKitBroadcaster ... />;
  if (selectedSpaceId) return <LiveSpaceRoom ... />;
  
  return (
    <div className="min-h-screen bg-black">
      {/* Modern Dashboard - NO BottomNav */}
      <LiveDashboard 
        liveStreams={liveStreams}
        liveSpaces={liveSpaces}
        scheduledStreams={scheduledStreams}
        scheduledSpaces={scheduledSpaces}
        myStreams={myStreams}
        mySpaces={mySpaces}
        user={user}
        onStreamClick={handleStreamClick}
        onSpaceClick={handleSpaceClick}
        onGoLive={() => setShowGoLiveModal(true)}
        onVideoStream={() => setCreateStreamModalOpen(true)}
        onAudioSpace={() => setCreateSpaceModalOpen(true)}
      />
      
      {/* Modals */}
      <CreateLiveStreamModal ... />
      <CreateSpaceModal ... />
      <GoLiveModal open={showGoLiveModal} onClose={() => setShowGoLiveModal(false)} />
    </div>
  );
};
```

## Phase 4: Go Live Modal

### 4.1 New Component: `src/components/live/GoLiveModal.tsx`

Modern bottom sheet modal for selecting stream type:

```text
┌─────────────────────────────────────────────┐
│ Start Broadcasting                      [X] │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │  📹  Video Stream                       │ │
│ │      Standard broadcast with camera     │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │  🎙️  Audio Space                        │ │
│ │      Voice-only conversation room       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Schedule for later →]                      │
└─────────────────────────────────────────────┘
```

## Phase 5: File Changes Summary

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/live/LiveDashboard.tsx` | Modern TikTok-style dashboard |
| `src/components/live/GoLiveModal.tsx` | Bottom sheet for stream type selection |
| `src/components/live/LiveDiscoverCard.tsx` | Modern feed item card component |

### Files to Update

| File | Changes |
|------|---------|
| `src/context/NavigationContext.tsx` | Add `/live` to hidden nav routes |
| `src/pages/Live.tsx` | Use new LiveDashboard, remove BottomNav import |
| `src/components/live/unified/LiveFeedItem.tsx` | Minor styling updates to match reference |

## Phase 6: Detailed Implementation

### 6.1 LiveDashboard.tsx Key Sections

**My Status CTA Card:**
```typescript
<div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6">
  {/* Decorative circles */}
  <div className="absolute top-4 left-4 w-16 h-16 bg-purple-500/20 rounded-full blur-xl" />
  <div className="absolute bottom-4 right-4 w-24 h-24 bg-pink-500/20 rounded-full blur-xl" />
  
  <div className="relative flex items-center gap-4">
    <Avatar className="w-16 h-16 border-2 border-primary/50">
      <AvatarImage src={user?.avatar_url} />
    </Avatar>
    <div className="flex-1">
      <p className="text-sm text-white/60">Ready to broadcast</p>
      <p className="text-xl font-bold">Start your Live Journey</p>
      <p className="text-sm text-white/60">{followerCount} followers waiting</p>
    </div>
    <Button onClick={onGoLive} className="bg-gradient-to-r from-pink-500 to-violet-600">
      <Play className="w-4 h-4 mr-2" />
      Go Live
    </Button>
  </div>
</div>
```

**Trending Section:**
```typescript
<div className="mt-8">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Flame className="w-5 h-5 text-orange-500" />
      <span className="font-bold">Trending Now</span>
    </div>
    <button className="text-sm text-white/60 flex items-center gap-1">
      View All <ChevronRight className="w-4 h-4" />
    </button>
  </div>
  
  <div className="grid grid-cols-2 gap-4">
    {liveStreams?.slice(0, 2).map(stream => (
      <LiveDiscoverCard 
        key={stream.id}
        stream={stream}
        onClick={() => onStreamClick(stream)}
      />
    ))}
  </div>
</div>
```

### 6.2 Navigation Context Update

```typescript
const isLiveStreamPage = useMemo(() => {
  const pathname = location.pathname;
  // Exact match for /live dashboard OR startsWith for detail pages
  const isLiveDashboard = pathname === '/live';
  const isLiveDetail = HIDDEN_NAV_ROUTES.some(route => pathname.startsWith(route));
  return isLiveDashboard || isLiveDetail;
}, [location.pathname]);
```

## Visual Design Specifications

| Element | Style |
|---------|-------|
| Background | `bg-black` or `bg-gradient-to-b from-black to-slate-900` |
| Cards | Rounded 2xl-3xl with gradient overlays |
| Live Badge | Red with pulse animation |
| Buttons | Gradient pink-to-violet with glow |
| Text | White with opacity variations |
| Filters | Underline indicator (not pill shapes) |

## Testing Checklist

| Test Case | Expected Behavior |
|-----------|-------------------|
| Navigate to /live | Bottom nav hidden, back button visible |
| Click back button | Navigate to /feed |
| Click stream card | Open stream viewer, nav still hidden |
| Click "Go Live" | Open modal with options |
| Select Video Stream | Open create stream modal |
| Select Audio Space | Open create space modal |
| Navigate to /live/stream/:id | Bottom nav hidden |
| Navigate to /live/space/:id | Bottom nav hidden |
