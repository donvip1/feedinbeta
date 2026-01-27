

# Database Cleanup & Photo+ Fixes

## Overview
This plan addresses three issues:
1. Delete all posts from the database to start fresh
2. Fix the duplicate social buttons issue on plain text posts in Photo+
3. Fix the RLS error when creating new Photo+ posts

## Part 1: Clear All Posts from Database

**What will happen:**
- All 249 posts will be deleted from the `posts` table
- Related data in linked tables will also be cleaned up:
  - `post_likes` (likes on posts)
  - `post_views` (view records)
  - `post_comments` (comments on posts)
  - `post_hashtags` (hashtag associations)
  - `saved_posts` (saved bookmarks)
  - `refeeds` (refeed records)

**Database Operations:**
```text
1. Delete from post_hashtags
2. Delete from post_views  
3. Delete from post_likes
4. Delete from post_comments
5. Delete from saved_posts
6. Delete from refeeds
7. Delete from posts
```

This gives users a completely clean slate to start posting fresh content.

---

## Part 2: Fix Duplicate Social Buttons on Plain Text Posts

**Current Problem:**
In `ImmersivePostCard.tsx`, plain text posts (`isEffectivelyPlainText`) render social buttons inline within the text section (lines 877-902). However, the footer section for Photo+ layout (lines 1328-1387) also renders when `isPhotoTextLayout` is true but `isEffectivelyPlainText` is false. 

The issue is that `isEffectivelyPlainText` includes posts with `isPlainText` OR posts without any media:
```tsx
const isEffectivelyPlainText = isPlainText || (!currentMediaUrl && !hasVideo && !hasImage && !isTextStyled);
```

But the Photo+ footer condition at line 1328:
```tsx
{!isImmersiveMode && isPhotoTextLayout && !isEffectivelyPlainText && (...)}
```

This should correctly exclude plain text posts. However, the inline social buttons for plain text (lines 877-902) may be rendering alongside other content incorrectly.

**Fix:**
Update the conditions to ensure:
- Plain text posts ONLY show inline social buttons (under the text)
- Image-based Photo+ posts ONLY show footer social buttons
- No duplication occurs

The fix will:
1. Ensure `isEffectivelyPlainText` condition properly gates the inline social buttons section
2. Add explicit exclusion in the footer section for plain text
3. Move the Promote button placement to be consistent (after social buttons for both layouts)

---

## Part 3: Fix RLS Error When Creating Photo+ Posts

**Current Problem:**
When creating a new Photo+ post, users get an error about "row-level security policy".

**Root Cause:**
Looking at the RLS policy on `posts` table:
```
INSERT policy: ((auth.uid() IS NOT NULL) AND (auth.uid() = user_id))
```

The policy requires:
1. User must be authenticated (`auth.uid() IS NOT NULL`)
2. The `user_id` column in the insert must match `auth.uid()`

The current `PhotoPlusPostCreator.tsx` correctly sets `user_id: user.id` in the insert (line 126). However, the check at line 81 (`if (!user) return`) may not be sufficient if the auth token is stale or the user object doesn't have the correct ID.

**Investigation:**
The code looks correct. The issue might be:
1. User session not properly loaded when creating post
2. The `user.id` not matching the authenticated session

**Fix:**
1. Add additional auth validation before attempting to create post
2. Ensure the user object is fresh from the auth session
3. Add better error messaging to understand the exact RLS failure

---

## Technical Implementation

### Files to Modify

1. **Database Cleanup (via SQL execution)**
   - Delete all related records first (foreign key dependencies)
   - Delete all posts last
   
2. **`src/components/feed/ImmersivePostCard.tsx`**
   - Fix the conditional rendering logic for plain text vs image Photo+ posts
   - Ensure only ONE set of social buttons renders for each post type

3. **`src/components/post/PhotoPlusPostCreator.tsx`**
   - Add defensive auth checking
   - Improve error handling to show more specific messages

### Implementation Steps

**Step 1: Database Cleanup**
Run SQL to delete all posts and related data in the correct order to respect foreign key constraints.

**Step 2: Fix Duplicate Social Buttons**
Update `ImmersivePostCard.tsx`:
- Review and fix the `isEffectivelyPlainText` condition usage
- Ensure the inline social buttons (lines 877-902) only render when `isEffectivelyPlainText` is true
- Ensure the footer Photo+ social buttons (lines 1327-1387) never render for plain text

**Step 3: Fix RLS Error**
Update `PhotoPlusPostCreator.tsx`:
- Add auth state refresh before submission
- Add more detailed error logging
- Ensure user.id matches the authenticated user

---

## Summary of Changes

| Area | Change |
|------|--------|
| Database | Delete all 249 posts and related data |
| ImmersivePostCard | Fix duplicate social button rendering |
| PhotoPlusPostCreator | Fix auth validation for post creation |

