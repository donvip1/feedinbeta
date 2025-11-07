-- Enable realtime and badge updates for notifications
-- 1) Trigger: increment unread badge on INSERT
DROP TRIGGER IF EXISTS trg_notifications_insert_badge ON public.notifications;
CREATE TRIGGER trg_notifications_insert_badge
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.update_notification_badge();

-- 2) Trigger: decrease unread badge when marking read (UPDATE is_read)
DROP TRIGGER IF EXISTS trg_notifications_update_read_badge ON public.notifications;
CREATE TRIGGER trg_notifications_update_read_badge
AFTER UPDATE OF is_read ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.decrease_notification_badge();

-- 3) Function + Trigger: decrease unread badge on DELETE of unread notifications
CREATE OR REPLACE FUNCTION public.decrease_notification_badge_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_read = false THEN
    UPDATE public.notification_badges
    SET unread_count = GREATEST(0, unread_count - 1),
        updated_at = now()
    WHERE user_id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_delete_badge ON public.notifications;
CREATE TRIGGER trg_notifications_delete_badge
AFTER DELETE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.decrease_notification_badge_on_delete();