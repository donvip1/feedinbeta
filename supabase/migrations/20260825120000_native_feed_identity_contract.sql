-- Native feed author-identity contract.
--
-- Surfaces the author identity the immersive feed renders (verified check,
-- Pro/Premium badge, follow state) without exposing raw subscription rows:
--   * profiles.is_verified — a simple, publicly-readable verified flag.
--   * native_author_identity(uuid[]) — a security-definer batch helper that
--     derives each author's active badge tier from their subscription so any
--     viewer can see the badge while user_subscriptions RLS stays locked down.
--
-- posts.privacy already exists (20260624000800_posts_privacy_rls.sql); the
-- client maps it to a coarse visibility (public / followers / private) and the
-- follows table (20260627143000_native_profile_social_contracts.sql) drives
-- viewer_is_following via a per-request lookup.

alter table public.profiles
  add column if not exists is_verified boolean not null default false;

create or replace function public.native_author_identity(p_user_ids uuid[])
returns table (
  user_id uuid,
  is_verified boolean,
  badge_tier text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id as user_id,
    coalesce(profile.is_verified, false) as is_verified,
    coalesce(active_tier.badge_tier, 'none') as badge_tier
  from public.profiles profile
  left join lateral (
    select case lower(tier.name)
      when 'premium' then 'premium'
      when 'pro' then 'pro'
      else 'none'
    end as badge_tier
    from public.user_subscriptions subscription
    join public.subscription_tiers tier on tier.id = subscription.tier_id
    where subscription.user_id = profile.id
      and subscription.status = 'active'
      and (subscription.current_period_start is null
        or subscription.current_period_start <= now())
      and (subscription.current_period_end is null
        or subscription.current_period_end > now())
      and tier.is_active
    order by
      case lower(tier.name)
        when 'premium' then 2
        when 'pro' then 1
        else 0
      end desc,
      subscription.current_period_end desc nulls last
    limit 1
  ) active_tier on true
  where profile.id = any (p_user_ids);
$$;

revoke all on function public.native_author_identity(uuid[]) from public;
grant execute on function public.native_author_identity(uuid[]) to authenticated, anon;

comment on function public.native_author_identity(uuid[]) is
  'Batch author identity for the native feed: verified flag + derived pro/premium badge tier, without exposing raw subscription rows.';

notify pgrst, 'reload schema';
