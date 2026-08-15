begin;

select plan(25);

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

select ok(
  pg_get_functiondef(
    'public.send_post_gift(uuid,uuid,uuid)'::regprocedure
  ) like '%notification_delivery_outbox%',
  'gift RPC queues its own trusted delivery receipt'
);

select ok(
  pg_get_functiondef(
    'public.send_post_gift(uuid,uuid,uuid)'::regprocedure
  ) like '%recipient_credit_value%',
  'gift RPC returns authoritative recipient credit value'
);

select ok(
  pg_get_functiondef(
    'public.send_post_gift(uuid,uuid,uuid)'::regprocedure
  ) not like '%send_post_gift_legacy%',
  'gift RPC does not delegate settlement to a legacy wrapper'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and cmd = 'INSERT'
      and policyname = 'Users can create non-gift notifications for self'
      and coalesce(with_check, '') like '%gift%'
  ),
  'clients cannot forge gift notification rows'
);

select is(
  (
    select count(*)::integer
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'post_gifts'
      and column_name in (
        'notification_id', 'sender_balance_after', 'recipient_balance_after'
      )
  ),
  3,
  'gift records retain immutable receipt fields'
);

create temporary table gift_test_receipts (
  sender_id uuid not null,
  creator_id uuid not null,
  post_id uuid not null,
  gift_id uuid not null,
  other_gift_id uuid not null,
  idempotency_key uuid not null,
  platform_balance_before bigint not null,
  first_receipt jsonb not null,
  replay_receipt jsonb not null
);

do $$
declare
  sender uuid := '11111111-1111-4111-8111-111111111101';
  creator uuid := '11111111-1111-4111-8111-111111111102';
  target_post uuid := '11111111-1111-4111-8111-111111111103';
  gift_id uuid;
  other_gift_id uuid;
  idem uuid := '11111111-1111-4111-8111-111111111104';
  platform_before bigint;
  first_receipt jsonb;
  replay_receipt jsonb;
begin
  insert into auth.users(id, email) values
    (sender, sender::text || '@test.invalid'),
    (creator, creator::text || '@test.invalid')
  on conflict (id) do nothing;
  insert into public.profiles(id, username) values
    (sender, 'gift-test-sender'),
    (creator, 'gift-test-creator')
  on conflict (id) do update set username = excluded.username;
  insert into public.posts(id, user_id, status, privacy)
    values (target_post, creator, 'active', 'everyone');
  select id into gift_id from public.gift_catalog
    where key = 'golden-star' and is_active;
  select id into other_gift_id from public.gift_catalog
    where key = 'pulse-heart' and is_active;
  insert into public.user_credits(user_id, balance)
    values (sender, 100), (creator, 0)
  on conflict (user_id) do update set balance = excluded.balance;
  select balance into platform_before from public.platform_wallet where id = 1;
  perform set_config('request.jwt.claim.sub', sender::text, true);
  first_receipt := public.send_post_gift(gift_id, target_post, idem);
  replay_receipt := public.send_post_gift(gift_id, target_post, idem);
  insert into gift_test_receipts values (
    sender, creator, target_post, gift_id, other_gift_id, idem,
    platform_before, first_receipt, replay_receipt
  );
end;
$$;

select is(
  (select balance from public.user_credits where user_id = state.sender_id),
  70::bigint,
  'sender is debited by the 30-credit gift'
) from gift_test_receipts state;

select is(
  (select balance from public.user_credits where user_id = state.creator_id),
  24::bigint,
  'creator receives 80 percent of the gift'
) from gift_test_receipts state;

select is(
  (select balance from public.platform_wallet where id = 1),
  state.platform_balance_before + 6,
  'platform receives the six-credit fee'
) from gift_test_receipts state;

select is(
  (select count(*) from public.credit_transactions
    where user_id = state.sender_id and type = 'post_gift_sent'),
  1::bigint,
  'sender ledger is written once'
) from gift_test_receipts state;

select is(
  (select count(*) from public.credit_transactions
    where user_id = state.creator_id and type = 'post_gift_received'),
  1::bigint,
  'recipient ledger is written once'
) from gift_test_receipts state;

select is(
  (select count(*) from public.post_gifts
    where idempotency_key = state.idempotency_key),
  1::bigint,
  'gift record is written once across replay'
) from gift_test_receipts state;

select is(
  (select count(*) from public.notifications
    where data->>'gift_record_id' = state.first_receipt->>'gift_record_id'),
  1::bigint,
  'recipient notification is written once across replay'
) from gift_test_receipts state;

select is(
  (select count(*) from public.notification_delivery_outbox
    where notification_id = (state.first_receipt->>'notification_id')::uuid),
  1::bigint,
  'trusted gift delivery is queued once'
) from gift_test_receipts state;

select is(
  (select gifts_count from public.posts where id = state.post_id),
  1,
  'post gift counter increments once across replay'
) from gift_test_receipts state;

select is(
  state.replay_receipt,
  state.first_receipt,
  'replay returns the original immutable receipt'
) from gift_test_receipts state;

select throws_ok(
  format(
    'select public.send_post_gift(%L::uuid, %L::uuid, %L::uuid)',
    state.other_gift_id, state.post_id, state.idempotency_key
  ),
  '23505',
  'IDEMPOTENCY_KEY_CONFLICT',
  'reusing a key for another gift is rejected'
) from gift_test_receipts state;

select * from finish();
rollback;
