

## Plan: Host Speaker Management via Display Name Tap

### What We're Building

When a host taps on a participant's **display name** (not avatar) in the live space, a dropdown/action sheet appears with role management options:
- **For listeners**: "Invite to Speak" — sends a real-time invitation the listener can accept/decline
- **For speakers**: "Move to Listener" — demotes them back to listener immediately

Tapping the **avatar** continues to navigate to the user's profile as it does now.

### Technical Approach

#### 1. Add Speaker Action Sheet Component
Create `src/components/live/twitter-space/SpeakerActionSheet.tsx` — a bottom sheet modal showing:
- User's avatar, name, username
- Action buttons based on current role:
  - Listener → "Invite to Speak" button
  - Speaker → "Move to Listener" button
- Only visible to host/co-host

#### 2. Add Speaker Invite Dialog Component  
Create `src/components/live/twitter-space/SpeakInviteDialog.tsx` — a dialog shown to the invited listener:
- Shows who invited them and the space name
- "Accept" and "Decline" buttons
- On accept: updates DB role to `speaker`, broadcasts promotion event, connects audio for broadcasting
- On decline: dismisses the dialog

#### 3. Modify `TwitterSpaceRoom.tsx`
- **Split click handlers**: Avatar click → `navigateToProfile()`, display name click → `openSpeakerActionSheet(speaker)` (host only; non-hosts still navigate to profile)
- **Add state** for selected speaker and action sheet visibility
- **Add invite logic**: When host taps "Invite to Speak" on a listener:
  - Insert into `live_space_invitations` table (existing table)
  - Broadcast an `invite-to-speak` event on the space control channel
- **Add demote logic**: When host taps "Move to Listener" on a speaker:
  - Update `live_space_speakers` role to `listener`, set `is_muted: true`, `mic_allowed: false`
  - Broadcast a `demoted-to-listener` event so the demoted user's UI updates
- **Listen for demote broadcast**: Update local state when current user gets demoted (set role, mute mic, update toggle)
- **Listen for invite broadcast**: Show the invite dialog to the targeted listener

#### 4. Update Speaker Grid & Listener Grid in `TwitterSpaceRoom.tsx`
- In the main view speaker grid (lines ~1111-1182) and listener grid (lines ~1186-1217):
  - Keep avatar `onClick → navigateToProfile`
  - Add separate `onClick` on display name text → `handleNameTap(speaker)` which opens the action sheet for hosts
- In the guests view (lines ~920-1001): Same split

#### 5. Update Guests Panel (`TwitterSpaceGuests.tsx`)
- Same pattern: avatar navigates to profile, display name opens action sheet for hosts

### Key Details
- Reuses existing `live_space_invitations` table and `speaker-promotion` broadcast pattern from `SpeakerQueuePanel`
- Demote broadcasts use the existing `space-control` channel with a new `demoted-to-listener` event
- The demoted user's `spaceContext.updateRole('listener')` is called to stop audio broadcasting
- No database schema changes needed — uses existing tables

