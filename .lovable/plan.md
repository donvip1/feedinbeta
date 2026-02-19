

# Fix Verified Badge: Video Fullscreen + Persistence

## Changes

### 1. `src/components/feed/ImmersivePostCard.tsx` (line 1144-1153)
Add VerifiedBadge next to displayName in the immersive/fullscreen video header:

```text
<span 
  className="font-bold text-sm text-white cursor-pointer flex items-center gap-1" 
  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
  onClick={...}
>
  {displayName}
  <VerifiedBadge userId={post.user_id} size="sm" />
</span>
```

### 2. `src/components/profile/VerifiedBadge.tsx` - Two cache fixes

**Line 13**: Increase TTL from 2 minutes to 30 minutes so the badge stays cached throughout a session:
```text
const CACHE_TTL = 1800000; // 30 minutes
```

**Lines 22-24**: Only clear cache on explicit sign-out (not on token refreshes which happen every few minutes and cause the badge to vanish):
```text
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    badgeDataCache.clear();
  }
});
```

## Why the badge disappears after login
- Every auth event (including background token refreshes) wipes the cache
- The 2-minute TTL means badges expire quickly
- Together, this causes the badge to vanish within seconds of login

## Result
- Badge persists reliably from login until sign-out
- Badge shows in video fullscreen mode
- Cache only clears when user explicitly logs out
- 30-minute TTL reduces unnecessary re-fetches

Two files, three small edits.

