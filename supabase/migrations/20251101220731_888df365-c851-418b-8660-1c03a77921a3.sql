-- Create notifications for post likes
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id UUID;
  liker_name TEXT;
BEGIN
  -- Get post owner ID
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  
  -- Don't notify if user liked their own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker's display name
  SELECT COALESCE(display_name, username, 'Someone') INTO liker_name 
  FROM profiles WHERE id = NEW.user_id;
  
  -- Create notification
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
    'like',
    'New like',
    liker_name || ' liked your post',
    'post',
    NEW.post_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for post likes
DROP TRIGGER IF EXISTS on_post_like ON post_likes;
CREATE TRIGGER on_post_like
  AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION notify_post_like();

-- Create notifications for comments
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
  
  -- Create notification
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
    'post',
    NEW.post_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for comments
DROP TRIGGER IF EXISTS on_post_comment ON post_comments;
CREATE TRIGGER on_post_comment
  AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION notify_post_comment();

-- Create notifications for comment replies
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
  
  -- Create notification
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
    NEW.parent_comment_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for comment replies
DROP TRIGGER IF EXISTS on_comment_reply ON post_comments;
CREATE TRIGGER on_comment_reply
  AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION notify_comment_reply();

-- Create notifications for follows
CREATE OR REPLACE FUNCTION notify_follow()
RETURNS TRIGGER AS $$
DECLARE
  follower_name TEXT;
BEGIN
  -- Get follower's display name
  SELECT COALESCE(display_name, username, 'Someone') INTO follower_name 
  FROM profiles WHERE id = NEW.follower_id;
  
  -- Create notification
  INSERT INTO notifications (
    user_id,
    from_user_id,
    type,
    title,
    message,
    related_type,
    related_id
  ) VALUES (
    NEW.following_id,
    NEW.follower_id,
    'follow',
    'New follower',
    follower_name || ' started following you',
    'profile',
    NEW.follower_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for follows
DROP TRIGGER IF EXISTS on_follow ON follows;
CREATE TRIGGER on_follow
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_follow();