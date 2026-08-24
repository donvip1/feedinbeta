begin;

select plan(3);

select has_function(
  'public',
  'native_feed_v2',
  array['integer', 'timestamp with time zone', 'uuid'],
  'native_feed_v2 exposes the versioned feed identity contract'
);

select function_returns(
  'public',
  'native_feed_v2',
  'setof record',
  'native_feed_v2 is table-returning'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'is_verified'
  ),
  'profiles exposes an explicit verification flag'
);

select * from finish();
rollback;
