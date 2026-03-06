

## Problem Analysis

The "Profile not found" screen flashes because of a race condition in the Profile page:

1. `loading` initializes as `false` and `profile` initializes as `null`
2. When there's no cached data (memory or IndexedDB), the component renders immediately
3. The render check at line 729 (`loading && !profile`) is `false` because `loading` is `false`
4. The check at line 737 (`!profile`) is `true` → shows "Profile not found"
5. Then `loadProfile` fires, sets `loading = true`, fetches data, and sets the profile — but the user already saw the error flash

## Fix

**File: `src/pages/Profile.tsx`**

1. Change `loading` initial state to `true` (line 82) so the spinner shows by default when there's no cached profile
2. Update the "not found" guard (line 737) to also check that loading is complete AND the identifier has been resolved, preventing premature "not found" rendering:
   - Only show "Profile not found" when `!loading && !profile && resolvedUserId` (i.e., we finished loading, have a resolved user, but still no profile)
3. Add a guard: if `resolvedUserId` is not yet set AND no cached data, show the loading spinner instead of "not found"

This ensures:
- **With cache**: Profile renders instantly from cache (no spinner, no flash)
- **Without cache**: Spinner shows until data loads (no "not found" flash)
- **Truly missing profile**: "Not found" only shows after fetch completes and returns no data

