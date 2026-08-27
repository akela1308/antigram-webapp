-- ============================================================================
-- ANTIGRAM — активация Premium после оплаты Telegram Stars.
--
-- Зеркалит подход complete_star_payment: строка подписки создаётся заранее
-- со статусом 'pending' и своим invoice_payload, а активируется только по
-- successful_payment. План проекта требует прямо: никогда не выдавать премиум
-- на pre_checkout_query и не активировать его из клиентского пути.
-- ============================================================================

-- Для разбора обращений в поддержку полезно знать, кто именно платил в Telegram
-- (аккаунт Telegram может не совпадать с профилем Antigram).
alter table public.premium_subscriptions
  add column if not exists telegram_payer_id bigint;

-- ── Активация ───────────────────────────────────────────────────────────────
create or replace function public.complete_premium_subscription(
  p_invoice_payload text,
  p_telegram_payment_charge_id text,
  p_provider_payment_charge_id text default null,
  p_telegram_payer_id bigint default null,
  p_raw_update jsonb default '{}'::jsonb
)
returns table (
  subscription_id uuid,
  user_id uuid,
  expires_at timestamptz,
  already_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_row public.premium_subscriptions%rowtype;
  base_at timestamptz;
begin
  if p_telegram_payment_charge_id is null or length(trim(p_telegram_payment_charge_id)) = 0 then
    raise exception 'premium payment is missing telegram_payment_charge_id';
  end if;

  select *
    into sub_row
    from public.premium_subscriptions
   where invoice_payload = p_invoice_payload
     for update;

  if not found then
    raise exception 'premium subscription payload not found: %', p_invoice_payload;
  end if;

  -- Повторная доставка вебхука: возвращаем то же самое, ничего не меняя.
  if sub_row.status = 'active' then
    if sub_row.telegram_payment_charge_id is not null
       and sub_row.telegram_payment_charge_id <> p_telegram_payment_charge_id then
      raise exception 'premium payload already paid with a different charge id';
    end if;

    subscription_id := sub_row.id;
    user_id         := sub_row.user_id;
    expires_at      := sub_row.expires_at;
    already_active  := true;
    return next;
    return;
  end if;

  if sub_row.status <> 'pending' then
    raise exception 'premium subscription has invalid status: %', sub_row.status;
  end if;

  -- Продление, а не сброс: если у человека уже есть живая подписка, новый срок
  -- прибавляется к её концу. Иначе купивший заранее терял бы оплаченные дни.
  select greatest(now(), coalesce(max(ps.expires_at), now()))
    into base_at
    from public.premium_subscriptions ps
   where ps.user_id = sub_row.user_id
     and ps.status = 'active'
     and ps.expires_at > now();

  update public.premium_subscriptions
     set status                     = 'active',
         started_at                 = now(),
         expires_at                 = base_at + make_interval(days => sub_row.period_days),
         telegram_payment_charge_id = p_telegram_payment_charge_id,
         provider_payment_charge_id = p_provider_payment_charge_id,
         telegram_payer_id          = p_telegram_payer_id,
         raw_update                 = coalesce(p_raw_update, '{}'::jsonb)
   where id = sub_row.id
  returning * into sub_row;

  subscription_id := sub_row.id;
  user_id         := sub_row.user_id;
  expires_at      := sub_row.expires_at;
  already_active  := false;
  return next;
end;
$$;

-- ── Возврат ─────────────────────────────────────────────────────────────────
-- Вызывать после успешного refundStarPayment в Bot API.
create or replace function public.refund_premium_subscription(
  p_telegram_payment_charge_id text
)
returns table (
  subscription_id uuid,
  user_id uuid,
  refunded boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  sub_row public.premium_subscriptions%rowtype;
begin
  select *
    into sub_row
    from public.premium_subscriptions
   where telegram_payment_charge_id = p_telegram_payment_charge_id
     for update;

  if not found then
    raise exception 'premium subscription not found for charge id';
  end if;

  if sub_row.status = 'refunded' then
    subscription_id := sub_row.id;
    user_id         := sub_row.user_id;
    refunded        := false;   -- уже возвращали
    return next;
    return;
  end if;

  -- Доступ снимается сразу: expires_at в прошлом, и get_user_entitlements
  -- перестанет считать подписку активной.
  update public.premium_subscriptions
     set status     = 'refunded',
         expires_at = least(coalesce(expires_at, now()), now())
   where id = sub_row.id;

  subscription_id := sub_row.id;
  user_id         := sub_row.user_id;
  refunded        := true;
  return next;
end;
$$;

-- ── Гигиена ─────────────────────────────────────────────────────────────────
-- get_user_entitlements и так сверяется с expires_at, поэтому на права это не
-- влияет. Нужно, чтобы статусы в админских выборках отражали реальность.
create or replace function public.expire_premium_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.premium_subscriptions
     set status = 'expired'
   where status = 'active'
     and expires_at is not null
     and expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- Всё это вызывается только вебхуком и админскими скриптами под service_role.
revoke all on function public.complete_premium_subscription(text, text, text, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.refund_premium_subscription(text) from public, anon, authenticated;
revoke all on function public.expire_premium_subscriptions() from public, anon, authenticated;
