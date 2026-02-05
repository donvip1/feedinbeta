CREATE OR REPLACE FUNCTION public.create_friend_request_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  sender_name TEXT;
  receiver_name TEXT;
BEGIN
  -- Get sender name with proper fallback
  SELECT COALESCE(display_name, username, 'Someone') INTO sender_name 
  FROM profiles WHERE id = NEW.sender_id;
  
  -- Get receiver name with proper fallback
  SELECT COALESCE(display_name, username, 'Someone') INTO receiver_name 
  FROM profiles WHERE id = NEW.receiver_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type, from_user_id)
    VALUES (
      NEW.receiver_id,
      'friend_request',
      'Friend Request',
      sender_name || ' sent you a friend request',
      NEW.sender_id,
      'profile',
      NEW.sender_id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type, from_user_id)
    VALUES (
      NEW.sender_id,
      'friend_request_accepted',
      'Friend Request Accepted',
      receiver_name || ' accepted your friend request',
      NEW.receiver_id,
      'profile',
      NEW.receiver_id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status = 'pending' THEN
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