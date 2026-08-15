-- Local-currency wallet checkout backed by canonical USD catalog prices.

create table if not exists public.currency_rates (
  id uuid primary key default gen_random_uuid(),
  currency_code text not null unique,
  currency_name text not null,
  currency_symbol text not null,
  rate_to_usd numeric(18, 6) not null check (rate_to_usd > 0),
  country_codes text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.currency_rates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'currency_rates'
      and policyname = 'Currency rates are publicly readable'
  ) then
    create policy "Currency rates are publicly readable"
      on public.currency_rates for select using (true);
  end if;
end
$$;

alter table public.profiles
  add column if not exists preferred_currency text not null default 'USD';

insert into public.currency_rates (
  currency_code,
  currency_name,
  currency_symbol,
  rate_to_usd,
  country_codes,
  is_active
)
values
  ('USD', 'US Dollar', '$', 1, array['US'], true),
  ('NGN', 'Nigerian Naira', '₦', 1515, array['NG'], true),
  ('GHS', 'Ghanaian Cedi', 'GH₵', 15.5, array['GH'], true),
  ('KES', 'Kenyan Shilling', 'KSh', 129, array['KE'], true),
  ('ZAR', 'South African Rand', 'R', 18.5, array['ZA'], true)
on conflict (currency_code) do nothing;

comment on column public.currency_rates.rate_to_usd is
  'Local major currency units charged for one canonical USD.';
