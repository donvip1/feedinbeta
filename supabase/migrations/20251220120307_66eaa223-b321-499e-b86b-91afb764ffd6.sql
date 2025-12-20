-- Fix all inaccurate gift counts on posts by recalculating from gift_analytics
-- This corrects the historical bug where credit values were added instead of 1

UPDATE posts p
SET gifts_count = COALESCE(
  (SELECT COUNT(*) FROM gift_analytics ga WHERE ga.source_id = p.id AND ga.source_type = 'post'),
  0
)
WHERE p.gifts_count > 0 
   OR p.id IN (SELECT DISTINCT source_id FROM gift_analytics WHERE source_type = 'post');