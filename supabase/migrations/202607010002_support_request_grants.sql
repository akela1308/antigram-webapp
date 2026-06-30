grant select, insert, update on public.support_requests to authenticated;
grant all on public.support_requests to service_role;

grant execute on function public.is_admin_user(uuid) to authenticated, service_role;
