-- Fix the comment notification trigger to store comment ID instead of post ID
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  commenter_name TEXT;
BEGIN
  -- Get post owner ID
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- Don't notify if user commented on their own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter's display name
  SELECT COALESCE(display_name, username, 'Someone') INTO commenter_name 
  FROM profiles WHERE id = NEW.user_id;
  
  -- Create notification with COMMENT ID (not post ID) for deep linking
  INSERT INTO notifications (
    user_id,
    from_user_id,
    type,
    title,
    message,
    related_type,
    related_id
  ) VALUES (
    post_owner_id,
    NEW.user_id,
    'comment',
    'New comment',
    commenter_name || ' commented on your post',
    'comment',  -- Changed from 'post' to 'comment'
    NEW.id      -- Changed from NEW.post_id to NEW.id (the comment ID)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix the reply notification trigger to store the NEW reply comment ID
CREATE OR REPLACE FUNCTION notify_comment_reply()
RETURNS TRIGGER AS $$
DECLARE
  parent_comment_owner_id UUID;
  replier_name TEXT;
BEGIN
  -- Only process if this is a reply (has parent_comment_id)
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get parent comment owner ID
  SELECT user_id INTO parent_comment_owner_id 
  FROM post_comments WHERE id = NEW.parent_comment_id;
  
  -- Don't notify if user replied to their own comment
  IF parent_comment_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get replier's display name
  SELECT COALESCE(display_name, username, 'Someone') INTO replier_name 
  FROM profiles WHERE id = NEW.user_id;
  
  -- Create notification with the REPLY COMMENT ID (NEW.id) for deep linking
  INSERT INTO notifications (
    user_id,
    from_user_id,
    type,
    title,
    message,
    related_type,
    related_id
  ) VALUES (
    parent_comment_owner_id,
    NEW.user_id,
    'reply',
    'New reply',
    replier_name || ' replied to your comment',
    'comment',
    NEW.id  -- Changed from NEW.parent_comment_id to NEW.id (the reply comment ID)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;