
-- Fix all functions missing SET search_path = public

-- 1. create_friend_request_notification
CREATE OR REPLACE FUNCTION public.create_friend_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sender_name TEXT;
  receiver_name TEXT;
BEGIN
  SELECT COALESCE(display_name, username, 'Someone') INTO sender_name 
  FROM profiles WHERE id = NEW.sender_id;
  
  SELECT COALESCE(display_name, username, 'Someone') INTO receiver_name 
  FROM profiles WHERE id = NEW.receiver_id;

  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type, from_user_id)
    VALUES (NEW.receiver_id, 'friend_request', 'Friend Request', sender_name || ' sent you a friend request', NEW.sender_id, 'profile', NEW.sender_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type, from_user_id)
    VALUES (NEW.sender_id, 'friend_request_accepted', 'Friend Request Accepted', receiver_name || ' accepted your friend request', NEW.receiver_id, 'profile', NEW.receiver_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type, from_user_id)
    VALUES (NEW.sender_id, 'friend_request_declined', 'Friend Request Declined', receiver_name || ' declined your friend request', NEW.receiver_id, 'profile', NEW.receiver_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. decrement_viewer_count
CREATE OR REPLACE FUNCTION public.decrement_viewer_count(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.live_streams 
  SET viewer_count = GREATEST(COALESCE(viewer_count, 0) - 1, 0) 
  WHERE id = p_stream_id;
END;
$function$;

-- 3. generate_certificate_number
CREATE OR REPLACE FUNCTION public.generate_certificate_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.certificate_number := 'FEEDIN-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
  RETURN NEW;
END;
$function$;

-- 4. generate_group_invite_code
CREATE OR REPLACE FUNCTION public.generate_group_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := LOWER(SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 8));
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. generate_unique_invite_code
CREATE OR REPLACE FUNCTION public.generate_unique_invite_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    result TEXT := '';
    i INT;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$function$;

-- 6. increment_viewer_count
CREATE OR REPLACE FUNCTION public.increment_viewer_count(p_stream_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.live_streams 
  SET viewer_count = COALESCE(viewer_count, 0) + 1 
  WHERE id = p_stream_id;
END;
$function$;

-- 7. update_course_enrollment_count
CREATE OR REPLACE FUNCTION public.update_course_enrollment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses SET total_enrolled = total_enrolled + 1 WHERE id = NEW.course_id;
    UPDATE public.instructors SET total_students = total_students + 1 
    WHERE id = (SELECT instructor_id FROM public.courses WHERE id = NEW.course_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses SET total_enrolled = total_enrolled - 1 WHERE id = OLD.course_id;
    UPDATE public.instructors SET total_students = total_students - 1 
    WHERE id = (SELECT instructor_id FROM public.courses WHERE id = OLD.course_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 8. update_course_module_count
CREATE OR REPLACE FUNCTION public.update_course_module_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.courses SET total_modules = total_modules + 1 WHERE id = NEW.course_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.courses SET total_modules = total_modules - 1 WHERE id = OLD.course_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 9. update_course_review_stats
CREATE OR REPLACE FUNCTION public.update_course_review_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  avg_rating DECIMAL(3,2);
  review_count INTEGER;
BEGIN
  SELECT AVG(rating), COUNT(*) INTO avg_rating, review_count 
  FROM public.course_reviews 
  WHERE course_id = COALESCE(NEW.course_id, OLD.course_id);
  
  UPDATE public.courses SET 
    average_rating = COALESCE(avg_rating, 0),
    total_reviews = COALESCE(review_count, 0)
  WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 10. update_instructor_rating
CREATE OR REPLACE FUNCTION public.update_instructor_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  avg_rating DECIMAL(3,2);
  total_reviews INTEGER;
  instructor UUID;
BEGIN
  SELECT instructor_id INTO instructor FROM public.courses WHERE id = COALESCE(NEW.course_id, OLD.course_id);
  
  SELECT AVG(cr.rating), COUNT(*) INTO avg_rating, total_reviews
  FROM public.course_reviews cr
  JOIN public.courses c ON c.id = cr.course_id
  WHERE c.instructor_id = instructor;
  
  UPDATE public.instructors SET 
    rating = COALESCE(avg_rating, 0),
    review_count = COALESCE(total_reviews, 0)
  WHERE id = instructor;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 11. update_module_lesson_count
CREATE OR REPLACE FUNCTION public.update_module_lesson_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.course_modules SET total_lessons = total_lessons + 1 WHERE id = NEW.module_id;
    UPDATE public.courses SET total_lessons = total_lessons + 1 
    WHERE id = (SELECT course_id FROM public.course_modules WHERE id = NEW.module_id);
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.course_modules SET total_lessons = total_lessons - 1 WHERE id = OLD.module_id;
    UPDATE public.courses SET total_lessons = total_lessons - 1 
    WHERE id = (SELECT course_id FROM public.course_modules WHERE id = OLD.module_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
