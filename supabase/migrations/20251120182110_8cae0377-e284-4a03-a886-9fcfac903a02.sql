-- Fix search_path security warnings
ALTER FUNCTION update_post_comment_count() SET search_path = public;
ALTER FUNCTION get_user_total_likes(UUID) SET search_path = public;