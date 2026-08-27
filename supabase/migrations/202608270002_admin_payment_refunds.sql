-- ============================================================================
-- ANTIGRAM — возвраты из админки.
--
-- Telegram требует, чтобы у бота с платежами был путь возврата. Раньше его
-- пришлось бы делать руками через SQL; здесь — функции, на которые опирается
-- кнопка «Вернуть» на экране /admin/payments.
--
-- Идентификаторы платежей Telegram (charge id) наружу не отдаются: список для
-- админки возвращает только внутренние uuid, а charge id читает серверная
-- функция под service_role.
-- ============================================================================

-- ── Возврат поддержки кадра ─────────────────────────────────────────────────
create or replace function public.refund_star_payment(
  p_telegram_payment_charge_id text
)
returns table (
  payment_id uuid,
  refunded boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.star_payments%rowtype;
begin
  select *
    into pay
    from public.star_payments
   where telegram_payment_charge_id = p_telegram_payment_charge_id
     for update;

  if not found then
    raise exception 'star payment not found for charge id';
  end if;

  -- Повторный возврат безопасен: просто сообщаем, что уже возвращено.
  if pay.status = 'refunded' then
    payment_id := pay.id;
    refunded   := false;
    return next;
    return;
  end if;

  if pay.status <> 'paid' then
    raise exception 'star payment is not paid: %', pay.status;
  end if;

  update public.star_payments
     set status      = 'refunded',
         refunded_at = now()
   where id = pay.id;

  -- Публичные счётчики уменьшаем, но не уводим в минус: если строку тотала
  -- кто-то правил руками, лучше показать ноль, чем отрицательное число.
  update public.moment_star_totals
     set total_amount   = greatest(0, total_amount - pay.amount),
         payments_count = greatest(0, payments_count - 1),
         updated_at     = now()
   where moment_id = pay.moment_id;

  update public.profile_star_totals
     set total_received = greatest(0, total_received - pay.amount),
         payments_count = greatest(0, payments_count - 1),
         updated_at     = now()
   where profile_id = pay.author_id;

  payment_id := pay.id;
  refunded   := true;
  return next;
end;
$$;

-- ── Список последних платежей для админки ───────────────────────────────────
-- Возвращает оба вида платежей одним списком. Никаких charge id.
create or replace function public.admin_recent_payments(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if not public.is_admin_user(auth.uid()) then
    raise exception 'not_allowed';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        (select
          sp.id,
          'moment'::text                       as kind,
          sp.amount,
          sp.status,
          sp.created_at,
          sp.paid_at,
          sp.refunded_at,
          coalesce(payer.username, 'без имени')  as payer_name,
          coalesce(author.username, 'без имени') as counterparty_name,
          sp.moment_id::text                   as target_id
        from public.star_payments sp
        left join public.profiles payer  on payer.id  = sp.payer_id
        left join public.profiles author on author.id = sp.author_id
        where sp.status in ('paid', 'refunded')
        order by sp.created_at desc
        limit safe_limit)

        union all

        (select
          ps.id,
          'premium'::text                      as kind,
          ps.price_stars                       as amount,
          ps.status,
          ps.created_at,
          ps.started_at                        as paid_at,
          null::timestamptz                    as refunded_at,
          coalesce(buyer.username, 'без имени') as payer_name,
          'Antigram Premium'::text             as counterparty_name,
          null::text                           as target_id
        from public.premium_subscriptions ps
        left join public.profiles buyer on buyer.id = ps.user_id
        where ps.status in ('active', 'expired', 'refunded')
        order by ps.created_at desc
        limit safe_limit)
      ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.refund_star_payment(text) from public, anon, authenticated;
grant execute on function public.admin_recent_payments(integer) to authenticated;
