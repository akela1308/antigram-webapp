grant usage on schema public to service_role;

grant select (
  id,
  user_id,
  caption
) on table public.moments to service_role;

grant select, insert, update on table public.star_payments to service_role;
grant select, insert, update on table public.star_webhook_events to service_role;
grant select, insert, update on table public.moment_star_totals to service_role;
grant select, insert, update on table public.profile_star_totals to service_role;

grant execute on function public.complete_star_payment(text, text, text, bigint, jsonb) to service_role;

revoke all on table public.star_payment_reconciliation from anon;
revoke all on table public.star_payment_reconciliation from authenticated;
grant select on table public.star_payment_reconciliation to service_role;
