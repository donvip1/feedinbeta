-- feedIn native: threaded post comments, comment likes, and owner-safe actions.

alter table public.post_comments
  add column if not exists parent_comment_id uuid
    references public.post_comments(id) on delete cascade,
  add column if not exists likes_count integer not null default 0;

create index if not exists post_comments_parent_created_idx
  on public.post_comments(parent_comment_id, created_at);

create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists post_comment_likes_user_idx
  on public.post_comment_likes(user_id, created_at desc);

alter table public.post_comment_likes enable row level security;

drop policy if exists "Comment likes are readable" on public.post_comment_likes;
create policy "Comment likes are readable"
on public.post_comment_likes for select
using (true);

drop policy if exists "Users can like comments as self" on public.post_comment_likes;
create policy "Users can like comments as self"
on public.post_comment_likes for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can remove own comment likes" on public.post_comment_likes;
create policy "Users can remove own comment likes"
on public.post_comment_likes for delete
using (auth.uid() = user_id);

create or replace function public.validate_post_comment_parent()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_post_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select post_id into parent_post_id
  from public.post_comments
  where id = new.parent_comment_id;

  if parent_post_id is null or parent_post_id <> new.post_id then
    raise exception 'Reply parent must belong to the same post';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_post_comment_parent_trigger
  on public.post_comments;
create trigger validate_post_comment_parent_trigger
before insert or update of parent_comment_id, post_id on public.post_comments
for each row execute function public.validate_post_comment_parent();

create or replace function public.sync_post_comment_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.post_comments
    set likes_count = likes_count + 1
    where id = new.comment_id;
  elsif tg_op = 'DELETE' then
    update public.post_comments
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.comment_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_post_comment_likes_count_trigger
  on public.post_comment_likes;
create trigger sync_post_comment_likes_count_trigger
after insert or delete on public.post_comment_likes
for each row execute function public.sync_post_comment_likes_count();

-- Replies should not inflate the top-level post comment count. Replace the
-- existing generic trigger with one that counts root comments only.
create or replace function public.sync_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.parent_comment_id is null then
      update public.posts
      set comments_count = comments_count + 1
      where id = new.post_id;
    end if;
  elsif tg_op = 'DELETE' then
    if old.parent_comment_id is null then
      update public.posts
      set comments_count = greatest(comments_count - 1, 0)
      where id = old.post_id;
    end if;
  end if;
  return null;
end;
$$;

-- The baseline already permits authors to delete their own comments. Keep the
-- rule idempotent so older or partially applied environments converge safely.
drop policy if exists "Users can delete own comments" on public.post_comments;
create policy "Users can delete own comments"
on public.post_comments for delete
using (auth.uid() = user_id);
