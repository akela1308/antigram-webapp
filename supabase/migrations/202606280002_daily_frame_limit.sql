-- Daily frame limit: enforced at DB level via BEFORE INSERT trigger.
-- Default limit: 4 moments per user per UTC day.
-- Raises exception code P0001 / message 'daily_frame_limit_exceeded' on violation.
-- Client should catch this and show a friendly message.

create or replace function public.enforce_daily_frame_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today_count integer;
  daily_limit constant integer := 4;
begin
  select count(*)
    into today_count
    from public.moments
    where user_id = new.user_id
      and created_at >= date_trunc('day', now() at time zone 'UTC');

  if today_count >= daily_limit then
    raise exception 'daily_frame_limit_exceeded'
      using errcode = 'P0001',
            detail  = format('user %s has already posted %s frames today (limit %s)', new.user_id, today_count, daily_limit);
  end if;

  return new;
end;
$$;

drop trigger if exists check_daily_frame_limit on public.moments;
create trigger check_daily_frame_limit
  before insert on public.moments
  for each row
  execute function public.enforce_daily_frame_limit();
