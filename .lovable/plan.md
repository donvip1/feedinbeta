

# Add Verified Badges Across the Entire App

## Problem
The VerifiedBadge (subscription badge) is missing from several key areas of the app where user names are displayed. Currently it only shows in some places but not others.

## Where Badges Already Exist
- Feed PostCard (Photo+ card view)
- Feed ImmersivePostCard (video fullscreen)
- Feed PhotoPostSlide (Photo+ swipeable view)
- Feed CommentsModal (full-screen comments)
- Messages conversation list (TikTokConversationItem)
- Messages chat header (ModernChatInterface)
- Groups message bubbles (GroupMessageBubble)
- Groups info sheet member list (GroupInfoSheet)
- Profile page

## Where Badges Are Missing (To Fix)

### 1. InlineCommentsPanel (Feed inline comments)
Comments and replies show display names but no badge. Add `VerifiedBadge` next to each commenter's name and each reply author's name.

- **Line ~396**: After `{c.profiles?.display_name}` add `<VerifiedBadge userId={c.user_id} size="sm" />`
- **Line ~473**: After `{reply.profiles?.display_name}` add `<VerifiedBadge userId={reply.user_id} size="sm" />`
- Add `flex items-center gap-1` to the parent `<p>` tags
- Import VerifiedBadge at top of file

### 2. GroupMembersSheet (Group members list)
Member names in the group members list have no badge.

- **Line ~280**: After `{member.display_name || 'User'}` add `<VerifiedBadge userId={member.user_id} size="sm" />`
- Add `flex items-center gap-1` to the parent span
- Import VerifiedBadge at top of file

### 3. NewConversationModal (New message user list)
User names in the new conversation search/friends list have no badge.

- **Line ~347**: After `{u.display_name || 'Unknown User'}` add `<VerifiedBadge userId={u.id} size="sm" />`
- Add `flex items-center gap-1` to the parent `<p>` tag
- Import VerifiedBadge at top of file

## Technical Details

- All additions use `<VerifiedBadge userId={...} size="sm" />` for consistency
- The VerifiedBadge component already handles caching (2-min TTL), fallback queries, and auth-state cache clearing from the previous fix
- No database changes needed -- the foreign key and fallback query from the previous fix ensure reliable data
- The badge will only render for users with active Pro or Premium subscriptions
- 3 files need to be modified: `InlineCommentsPanel.tsx`, `GroupMembersSheet.tsx`, `NewConversationModal.tsx`

