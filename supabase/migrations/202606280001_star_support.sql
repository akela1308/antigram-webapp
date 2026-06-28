create extension if not exists pgcrypto;

create table if not exists public.star_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_payload text not null unique,
  payer_id uuid references public.profiles(id) on delete set null,
  moment_id uuid not null references public.moments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  currency text not null default 'XTR' check (currency = 'XTR'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  telegram_payment_charge_id text unique,
  provider_payment_charge_id text,
  telegram_payer_id bigint,
  paid_at timestamptz,
  refunded_at timestamptz,
  raw_update jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists star_payments_moment_id_idx on public.star_payments(moment_id);
create index if not exists star_payments_author_id_idx on public.star_payments(author_id);
create index if not exists star_payments_payer_id_idx on public.star_payments(payer_id);
create index if not exists star_payments_status_idx on public.star_payments(status);

create table if not exists public.moment_star_totals (
  moment_id uuid primary key references public.moments(id) on delete cascade,
  total_amount integer not null default 0 check (total_amount >= 0),
  payments_count integer not null default 0 check (payments_count >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_star_totals (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  total_received integer not null default 0 check (total_received >= 0),
  payments_count integer not null default 0 check (payments_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.star_payments enable row level security;
alter table public.moment_star_totals enable row level security;
alter table public.profile_star_totals enable row level security;

drop policy if exists "Star payments visible to participants" on public.star_payments;
create policy "Star payments visible to participants"
  on public.star_payments
  for select
  to authenticated
  using (payer_id = auth.uid() or author_id = auth.uid());

drop policy if exists "Moment star totals are public" on public.moment_star_totals;
create policy "Moment star totals are public"
  on public.moment_star_totals
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Profile star totals are public" on public.profile_star_totals;
create policy "Profile star totals are public"
  on public.profile_star_totals
  for select
  to anon, authenticated
  using (true);

create or replace function public.set_star_payment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_star_payments_updated_at on public.star_payments;
create trigger set_star_payments_updated_at
  before update on public.star_payments
  for each row
  execute function public.set_star_payment_updated_at();

create or replace function public.complete_star_payment(
  p_invoice_payload text,
  p_telegram_payment_charge_id text,
  p_provider_payment_charge_id text default null,
  p_telegram_payer_id bigint default null,
  p_raw_update jsonb default '{}'::jsonb
)
returns table (
  payment_id uuid,
  moment_id uuid,
  author_id uuid,
  amount integer,
  already_paid boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.star_payments%rowtype;
begin
  select *
    into payment_row
    from public.star_payments
    where invoice_payload = p_invoice_payload
    for update;

  if not found then
    raise exception 'star payment payload not found: %', p_invoice_payload;
  end if;

  if payment_row.status = 'paid' then
    payment_id := payment_row.id;
    moment_id := payment_row.moment_id;
    author_id := payment_row.author_id;
    amount := payment_row.amount;
    already_paid := true;
    return next;
    return;
  end if;

  if payment_row.status <> 'pending' then
    raise exception 'star payment has invalid status: %', payment_row.status;
  end if;

  update public.star_payments
    set status = 'paid',
        telegram_payment_charge_id = p_telegram_payment_charge_id,
        provider_payment_charge_id = p_provider_payment_charge_id,
        telegram_payer_id = p_telegram_payer_id,
        paid_at = now(),
        raw_update = coalesce(p_raw_update, '{}'::jsonb)
    where id = payment_row.id
    returning * into payment_row;

  insert into public.moment_star_totals (moment_id, total_amount, payments_count, updated_at)
  values (payment_row.moment_id, payment_row.amount, 1, now())
  on conflict (moment_id) do update
    set total_amount = public.moment_star_totals.total_amount + excluded.total_amount,
        payments_count = public.moment_star_totals.payments_count + 1,
        updated_at = now();

  insert into public.profile_star_totals (profile_id, total_received, payments_count, updated_at)
  values (payment_row.author_id, payment_row.amount, 1, now())
  on conflict (profile_id) do update
    set total_received = public.profile_star_totals.total_received + excluded.total_received,
        payments_count = public.profile_star_totals.payments_count + 1,
        updated_at = now();

  payment_id := payment_row.id;
  moment_id := payment_row.moment_id;
  author_id := payment_row.author_id;
  amount := payment_row.amount;
  already_paid := false;
  return next;
end;
$$;
