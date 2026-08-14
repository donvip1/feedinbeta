-- Count every post_comments row, including threaded replies, in the post total.
-- The existing sync_post_comments_count_trigger already invokes this function
-- after each insert/delete, including cascaded descendant deletions.
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

-- Reconcile historical rows that were created while replies were excluded.
update public.posts as post
set comments_count = (
  select count(*)::integer
  from public.post_comments as comment
  where comment.post_id = post.id
);
