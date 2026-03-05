

## Plan: Complete Replays Tab & Role-Based Deletion

### Current State
- The Replays tab exists in LiveDashboard but only shows spaces where `recording_url IS NOT NULL`
- Many ended spaces may exist without recordings and are invisible
- No delete button exists on replay cards
- No admin/moderator permission check for deletion

### Changes

#### 1. Expand Replays Query (`LiveDashboard.tsx`)
- Remove the `.not('recording_url', 'is', null)` filter — show ALL ended spaces under Replays, not just those with recordings
- Increase limit from 20 to 50 for better coverage
- Add a visual indicator for spaces that have a recording vs those that are just ended

#### 2. Add Delete Button on Replay Cards (`LiveDashboard.tsx`)
- Add a delete button (trash icon) on each replay card
- Show it only if the current user is the space host (`space.user_id === user?.id`) OR has admin/moderator role
- Use the `useAdminRole` hook to check permissions
- On delete: remove related data (messages, reactions, speakers, gifts) then delete the space itself
- Refetch the recorded spaces query after deletion

#### 3. Same Delete Permission for Live Stream Cards (`LiveStreamCard.tsx`)
- Currently `isOwner` controls delete visibility
- Update parent components to also pass `isOwner={true}` when user has admin/moderator role, so admins can delete any stream

### Files to modify:
- `src/components/live/LiveDashboard.tsx` — Remove recording_url filter, add delete buttons with role checks, import `useAdminRole`
- `src/components/live/LiveStreamCard.tsx` — No changes needed (already supports `isOwner` prop; parent will pass admin status)
- Callers of `LiveStreamCard` that pass `isOwner` — Update to include admin/moderator check

