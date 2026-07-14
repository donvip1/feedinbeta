-- Reconcile Paystack transfer reversals after a creator payout was marked paid.

create or replace function public.wallet_update_creator_payout_status(
  p_request_id uuid,
  p_status text,
  p_provider_reference text default null,
  p_failure_reason text default null
)
returns public.creator_payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  payout public.creator_payout_requests;
begin
  if p_status not in (
    'processing',
    'paid',
    'failed',
    'rejected',
    'canceled',
    'reversed'
  ) then
    raise exception 'invalid payout status';
  end if;
  if p_status = 'paid'
     and nullif(btrim(p_provider_reference), '') is null then
    raise exception 'provider reference is required for paid payouts';
  end if;

  select * into payout
  from public.creator_payout_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'payout request not found';
  end if;

  if payout.status in ('failed', 'rejected', 'canceled', 'reversed') then
    return payout;
  end if;
  if payout.status = 'paid' and p_status <> 'reversed' then
    return payout;
  end if;

  if p_status in ('failed', 'rejected', 'canceled', 'reversed')
     and payout.funds_released_at is null then
    update public.creator_monetization
    set available_balance = available_balance + payout.amount,
        updated_at = now()
    where user_id = payout.user_id;
  end if;

  update public.creator_payout_requests
  set status = p_status,
      provider_reference = coalesce(
        nullif(p_provider_reference, ''),
        provider_reference
      ),
      failure_reason = case
        when p_status in ('failed', 'rejected', 'canceled', 'reversed')
          then left(coalesce(p_failure_reason, p_status), 500)
        else null
      end,
      funds_released_at = case
        when p_status in ('failed', 'rejected', 'canceled', 'reversed')
          then coalesce(funds_released_at, now())
        else funds_released_at
      end,
      processed_at = case
        when p_status in (
          'paid',
          'failed',
          'rejected',
          'canceled',
          'reversed'
        ) then now()
        else processed_at
      end,
      updated_at = now()
  where id = payout.id
  returning * into payout;

  if p_status = 'paid' then
    update public.creator_monetization
    set last_payout_at = now(),
        updated_at = now()
    where user_id = payout.user_id;

    insert into public.creator_payouts (
      user_id,
      amount,
      currency,
      total_earnings,
      status,
      provider_reference,
      payout_request_id,
      paid_at
    )
    select
      payout.user_id,
      payout.amount,
      payout.currency,
      monetization.total_earnings,
      'paid',
      payout.provider_reference,
      payout.id,
      now()
    from public.creator_monetization monetization
    where monetization.user_id = payout.user_id
    on conflict (payout_request_id) where payout_request_id is not null
    do nothing;
  elsif p_status = 'reversed' then
    update public.creator_payouts
    set status = 'reversed'
    where payout_request_id = payout.id;
  end if;

  return payout;
end;
$$;

revoke all on function public.wallet_update_creator_payout_status(
  uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.wallet_update_creator_payout_status(
  uuid, text, text, text
) to service_role;
