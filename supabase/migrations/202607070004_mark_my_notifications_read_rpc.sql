create or replace function public.mark_my_notifications_read()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.notifications
    set read = true
    where auth.uid() is not null
      and user_id = auth.uid()
      and read = false;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

grant execute on function public.mark_my_notifications_read() to authenticated;
