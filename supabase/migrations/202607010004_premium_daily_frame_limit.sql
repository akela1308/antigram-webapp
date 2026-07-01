-- Premium-aware daily frame limit.
-- Regular users keep 4 frames per UTC day; active Premium users get 8.

create or replace function public.enforce_daily_frame_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today_count integer;
  daily_limit integer := 4;
begin
  if exists (
    select 1
      from public.premium_subscriptions
      where user_id = new.user_id
        and status = 'active'
        and expires_at > now()
  ) then
    daily_limit := 8;
  end if;

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
