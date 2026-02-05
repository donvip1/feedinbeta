
# Fix Duplicate Friend Request Notifications

The issue of duplicate notifications for friend requests is caused by redundant logic: both the database (via a trigger) and the frontend code (manually) are creating notifications for the same event. Additionally, one of the manual notification versions was incorrectly using the recipient's name instead of the sender's.

## Proposed Changes

### 1. Database Logic Consolidation
I will update the existing database trigger function `create_friend_request_notification` to be the single source of truth for friend request notifications.

- **Improve Name Handling**: Use `COALESCE(display_name, username, 'Someone')` to ensure a name is always shown, even if a user hasn't set their display name.
- **Fix Deep Linking**: Update the `related_id` and `related_type` for accepted requests so they correctly point to the user's profile, allowing for proper navigation.
- **Support Declined Status**: Add logic to handle 'declined' notifications centrally.

### 2. Frontend Cleanup
I will remove all manual `supabase.from('notifications').insert()` calls related to friend requests and their acceptance/rejection from the following files:

- **`src/pages/Profile.tsx`**: Remove manual notifications in `requestChat` and `handleAcceptFriendRequest`.
- **`src/pages/Friends.tsx`**: Remove manual notifications in `sendFriendRequest` and `respondToRequest`.
- **`src/components/messages/NewConversationModal.tsx`**: Remove manual notifications in `sendFriendRequest`, `acceptFriendRequest`, and `declineFriendRequest`.
- **`src/components/profile/ProfilePreviewModal.tsx`**: Remove manual notifications in `handleAddFriend`.
- **`src/components/notifications/NotificationItem.tsx`**: Remove manual notification in `handleFriendRequestResponse`.

### 3. Unified Notification Branding
I will align the notification titles and messages across the platform to use the standard "Friend Request" and "Friend Request Accepted" titles used by the database trigger.

## Technical Details

### Database Migration
The updated trigger function will look like this:
```sql
CREATE OR REPLACE FUNCTION public.create_friend_request_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  sender_name TEXT;
  receiver_name TEXT;
BEGIN
  -- Get sender name
  SELECT COALESCE(display_name, username, 'Someone') INTO sender_name 
  FROM profiles WHERE id = NEW.sender_id;
  
  -- Get receiver name
  SELECT COALESCE(display_name, username, 'Someone') INTO receiver_name 
  FROM profiles WHERE id = NEW.receiver_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type, from_user_id)
    VALUES (
      NEW.receiver_id,
      'friend_request',
      'Friend Request',
      sender_name || ' sent you a friend request',
      NEW.id,
      'friend_request',
      NEW.sender_id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type, from_user_id)
    VALUES (
      NEW.sender_id,
      'friend_request_accepted',
      'Friend Request Accepted',
      receiver_name || ' accepted your friend request',
      NEW.receiver_id, -- Use user ID for profile deep-linking
      'profile',
      NEW.receiver_id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'declined' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type, from_user_id)
    VALUES (
      NEW.sender_id,
      'friend_request_declined',
      'Friend Request Declined',
      receiver_name || ' declined your friend request',
      NEW.receiver_id,
      'profile',
      NEW.receiver_id
    );
  END IF;
  RETURN NEW;
END;
$function$;
```

### Verification Plan
- Send a friend request from User A to User B and verify only one notification appears for User B with User A's name.
- Accept a friend request and verify only one notification appears for the original sender.
- Verify that clicking the "Accepted" notification correctly navigates to the other user's profile.
- Verify that the "Declined" notification (if enabled) appears correctly with a single entry.
