alter table public.star_payments
  add column if not exists pre_checkout_seen_at timestamptz,
  add column if not exists successful_payment_seen_at timestamptz,
  add column if not exists author_notification_status text not null default 'pending',
  add column if not exists author_notification_error text,
  add column if not exists author_notified_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'star_payments_author_notification_status_check'
  ) then
    alter table public.star_payments
      add constraint star_payments_author_notification_status_check
      check (author_notification_status in ('pending', 'sent', 'failed', 'skipped'));
  end if;
end $$;

create table if not exists public.star_webhook_events (
  id uuid primary key default gen_random_uuid(),
  update_id bigint unique,
  update_type text not null check (update_type in ('pre_checkout_query', 'successful_payment', 'callback_query', 'bot_message', 'unknown')),
  invoice_payload text,
  payment_id uuid references public.star_payments(id) on delete set null,
  processing_status text not null default 'received' check (processing_status in ('received', 'handled', 'failed')),
  error text,
  raw_update jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists star_webhook_events_invoice_payload_idx
  on public.star_webhook_events(invoice_payload);

create index if not exists star_webhook_events_created_at_idx
  on public.star_webhook_events(created_at desc);

alter table public.star_webhook_events enable row level security;

drop policy if exists "Star webhook events visible to admins" on public.star_webhook_events;
create policy "Star webhook events visible to admins"
  on public.star_webhook_events
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

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
    if payment_row.telegram_payment_charge_id is not null
       and payment_row.telegram_payment_charge_id <> p_telegram_payment_charge_id then
      raise exception 'star payment payload already paid with a different charge id';
    end if;

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
        successful_payment_seen_at = now(),
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

create or replace view public.star_payment_reconciliation as
select
  sp.id,
  sp.invoice_payload,
  sp.status,
  sp.amount,
  sp.currency,
  sp.payer_id,
  sp.author_id,
  sp.moment_id,
  sp.created_at,
  sp.pre_checkout_seen_at,
  sp.successful_payment_seen_at,
  sp.paid_at,
  sp.author_notification_status,
  sp.author_notification_error,
  sp.author_notified_at,
  case
    when sp.status = 'pending' and sp.created_at < now() - interval '30 minutes' then 'stale_pending_invoice'
    when sp.status = 'paid' and sp.successful_payment_seen_at is null then 'paid_without_successful_payment_marker'
    when sp.status = 'paid' and sp.author_notification_status = 'failed' then 'author_notification_failed'
    else null
  end as issue
from public.star_payments sp;
