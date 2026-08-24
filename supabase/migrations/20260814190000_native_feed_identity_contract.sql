-- Stable native feed contract. Keep compatibility columns in the same
-- migration so the RPC cannot fail against a partially migrated live schema.

alter table public.profiles
  add column if not exists is_verified boolean not null default false;

alter table public.posts
  add column if not exists media_filter_id text,
  add column if not exists media_filter_ids text[] not null default '{}',
  add column if not exists privacy text not null default 'everyone';

create or replace function public.native_feed_v2(
  p_limit integer default 30,
  p_before timestamptz default null,
  p_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  content text,
  media_url text,
  media_type text,
  media_urls text[],
  media_types text[],
  media_filter_id text,
  media_filter_ids text[],
  created_at timestamptz,
  likes_count integer,
  comments_count integer,
  views_count integer,
  refeeds_count integer,
  location text,
  post_type text,
  status text,
  original_post_id uuid,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  author_verified boolean,
  author_badge_tier text,
  visibility text,
  viewer_is_following boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    post.id,
    post.user_id,
    post.content,
    post.media_url,
    post.media_type,
    coalesce(post.media_urls, '{}'::text[]),
    coalesce(post.media_types, '{}'::text[]),
    post.media_filter_id,
    coalesce(post.media_filter_ids, '{}'::text[]),
    post.created_at,
    post.likes_count,
    (
      select count(*)::integer
      from public.post_comments comment
      where comment.post_id = post.id
    ) as comments_count,
    post.views_count,
    post.refeeds_count,
    post.location,
    post.post_type,
    post.status,
    post.original_post_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    profile.is_verified,
    coalesce(active_tier.badge_tier, 'none') as author_badge_tier,
    case coalesce(post.privacy, 'everyone')
      when 'only_me' then 'private'
      when 'followers' then 'followers'
      when 'friends' then 'followers'
      else 'public'
    end as visibility,
    exists (
      select 1
      from public.follows follow
      where follow.follower_id = auth.uid()
        and follow.following_id = post.user_id
    ) as viewer_is_following
  from public.posts post
  join public.profiles profile on profile.id = post.user_id
  left join lateral (
    select case lower(tier.name)
      when 'premium' then 'premium'
      when 'pro' then 'pro'
      else 'none'
    end as badge_tier
    from public.user_subscriptions subscription
    join public.subscription_tiers tier on tier.id = subscription.tier_id
    where subscription.user_id = post.user_id
      and subscription.status = 'active'
      and (subscription.current_period_start is null
        or subscription.current_period_start <= now())
      and subscription.current_period_end is not null
      and subscription.current_period_end > now()
      and tier.is_active
    order by
      case lower(tier.name)
        when 'premium' then 2
        when 'pro' then 1
        else 0
      end desc,
      subscription.current_period_end desc
    limit 1
  ) active_tier on true
  where post.status = 'active'
    and (p_before is null or post.created_at < p_before)
    and (p_user_id is null or post.user_id = p_user_id)
  order by post.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

revoke all on function public.native_feed_v2(integer, timestamptz, uuid)
  from public;
revoke all on function public.native_feed_v2(integer, timestamptz, uuid)
  from anon;
grant execute on function public.native_feed_v2(integer, timestamptz, uuid)
  to authenticated;

comment on function public.native_feed_v2(integer, timestamptz, uuid) is
  'Versioned RLS-aware native feed contract with author identity and reply-inclusive comment totals.';

notify pgrst, 'reload schema';
