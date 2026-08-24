begin;
select plan(5);

select is(
  (select count(*)::integer from public.promotion_plans where is_active),
  5,
  'five remotely managed promotion plans are active'
);

select is(
  (select array_agg(credit_cost order by display_order) from public.promotion_plans where is_active),
  array[25, 50, 100, 200, 500],
  'promotion plan prices match the approved ladder'
);

select has_function(
  'public',
  'promote_post',
  array['uuid', 'uuid', 'integer', 'jsonb', 'uuid'],
  'promote_post is installed'
);

select has_table(
  'public',
  'post_promotion_delivery_events',
  'promotion delivery events are installed'
);

select has_function(
  'public',
  'record_post_promotion_delivery',
  array['uuid', 'uuid', 'uuid'],
  'server-owned promotion delivery recorder is installed'
);

select * from finish();
rollback;
