create extension if not exists pgcrypto;

create table if not exists public.premium_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled', 'refunded')),
  source text not null default 'telegram_stars' check (source = 'telegram_stars'),
  price_stars integer not null default 149 check (price_stars > 0),
  period_days integer not null default 30 check (period_days = 30),
  started_at timestamptz,
  expires_at timestamptz,
  invoice_payload text unique,
  telegram_payment_charge_id text unique,
  provider_payment_charge_id text,
  raw_update jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists premium_subscriptions_user_id_idx on public.premium_subscriptions(user_id);
create index if not exists premium_subscriptions_status_idx on public.premium_subscriptions(status);
create index if not exists premium_subscriptions_expires_at_idx on public.premium_subscriptions(expires_at desc);

alter table public.premium_subscriptions enable row level security;

drop policy if exists "Premium subscriptions visible to owner" on public.premium_subscriptions;
create policy "Premium subscriptions visible to owner"
  on public.premium_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.set_premium_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_premium_subscriptions_updated_at on public.premium_subscriptions;
create trigger set_premium_subscriptions_updated_at
  before update on public.premium_subscriptions
  for each row
  execute function public.set_premium_subscription_updated_at();

grant select on public.premium_subscriptions to authenticated;
grant all on public.premium_subscriptions to service_role;
