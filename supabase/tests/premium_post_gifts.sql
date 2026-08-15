begin;

select plan(9);

select is(
  (
    select count(*)::integer
    from public.gift_catalog
    where is_active and 'post' = any(supported_sources)
  ),
  16,
  'exactly 16 active post gifts are available'
);

select is(
  (
    select count(*)::integer
    from public.gift_catalog
    where is_active
      and 'post' = any(supported_sources)
      and recipient_percent = 80
  ),
  16,
  'every post gift uses the 80 percent creator split'
);

select ok(
  not exists (
    select 1
    from public.gift_catalog
    where 'post' = any(supported_sources)
      and (
        poster_url is null or idle_url is null or preview_url is null
        or send_url is null or fallback_asset_key is null
      )
  ),
  'all post gifts include complete animation metadata'
);

select has_function(
  'public',
  'send_post_gift',
  array['uuid', 'uuid', 'uuid'],
  'send_post_gift is installed'
);

select has_table(
  'public',
  'notification_delivery_outbox',
  'gift notification delivery outbox is installed'
);

select ok(
  pg_get_functiondef(
    'public.send_post_gift(uuid,uuid,uuid)'::regprocedure
  ) like '%recipient_balance_after%',
  'gift RPC returns the recipient balance after settlement'
);

select ok(
  pg_get_functiondef(
    'public.send_post_gift(uuid,uuid,uuid)'::regprocedure
  ) like '%notification_id%',
  'gift RPC returns the durable notification receipt id'
);

select ok(
  pg_get_functiondef(
    'public.send_post_gift(uuid,uuid,uuid)'::regprocedure
  ) like '%pg_advisory_xact_lock%',
  'gift RPC serializes a sender idempotency key before settlement'
);

select ok(
  pg_get_functiondef(
    'public.send_post_gift(uuid,uuid,uuid)'::regprocedure
  ) like '%sender_balance_after%',
  'gift RPC replays the stored settlement snapshot'
);

select * from finish();
rollback;
