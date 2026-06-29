-- feedIn native: feed engagement count-sync triggers.
--
-- The native core schema (20260624000100) ships posts.likes_count,
-- comments_count, views_count, and refeeds_count but no triggers to keep
-- them in sync with the engagement tables — so likes/comments/refeeds were
-- written to post_likes / post_comments / posts(post_type='refeed') without
-- ever updating the denormalized counters the feed reads. This migration
-- restores the web app's count-sync behaviour (see archive
-- 20251101160918_..., 20251101114834_..., 20251101160606_...).
--
-- SCOPE: engagement-table / count-sync triggers ONLY. This migration does NOT
-- alter the posts or profiles columns (owned by the Upload and Profile
-- agents). The trigger functions only UPDATE existing posts counter columns.
--
-- Counters are clamped at 0 with greatest(...) so a double-delete or a
-- replayed offline action can never drive a count negative.

-- ---------------------------------------------------------------------------
-- Likes: post_likes insert/delete -> posts.likes_count
-- ---------------------------------------------------------------------------
create or replace function public.sync_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
      set likes_count = likes_count + 1
      where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
      set likes_count = greatest(likes_count - 1, 0)
      where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_post_likes_count_trigger on public.post_likes;
create trigger sync_post_likes_count_trigger
  after insert or delete on public.post_likes
  for each row execute function public.sync_post_likes_count();

-- ---------------------------------------------------------------------------
-- Comments: post_comments insert/delete -> posts.comments_count
-- ---------------------------------------------------------------------------
create or replace function public.sync_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
      set comments_count = comments_count + 1
      where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts
      set comments_count = greatest(comments_count - 1, 0)
      where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_post_comments_count_trigger on public.post_comments;
create trigger sync_post_comments_count_trigger
  after insert or delete on public.post_comments
  for each row execute function public.sync_post_comments_count();

-- ---------------------------------------------------------------------------
-- Refeeds: a refeed is a posts row with post_type = 'refeed' pointing at the
-- original via original_post_id. Keep the ORIGINAL post's refeeds_count in
-- sync. This trigger lives on public.posts but only UPDATES the existing
-- refeeds_count column on a *different* row (the original) and never alters
-- the table's structure.
-- ---------------------------------------------------------------------------
create or replace function public.sync_post_refeeds_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.post_type = 'refeed' and new.original_post_id is not null then
      update public.posts
        set refeeds_count = refeeds_count + 1
        where id = new.original_post_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.post_type = 'refeed' and old.original_post_id is not null then
      update public.posts
        set refeeds_count = greatest(refeeds_count - 1, 0)
        where id = old.original_post_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_post_refeeds_count_trigger on public.posts;
create trigger sync_post_refeeds_count_trigger
  after insert or delete on public.posts
  for each row execute function public.sync_post_refeeds_count();

-- NOTE: post_shares is an append-only event log in the native model and has no
-- corresponding counter column on posts (the web app's posts.shares_count does
-- not exist here; refeeds_count is the shareable counter and is driven by the
-- refeed action above). No share-count trigger is added intentionally.

notify pgrst, 'reload schema';
