create or replace function public.enforce_highlight_entitlements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  highlight_limit integer := 5;
begin
  if new.position < 0 then
    raise exception 'highlight_position_invalid';
  end if;

  if exists (
    select 1
    from public.premium_subscriptions ps
    where ps.user_id = new.user_id
      and ps.status = 'active'
      and ps.expires_at > now()
    limit 1
  ) then
    highlight_limit := 10;
  end if;

  if new.position >= highlight_limit then
    raise exception 'highlight_limit_exceeded';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_highlight_entitlements_before_write on public.highlights;
create trigger enforce_highlight_entitlements_before_write
  before insert or update on public.highlights
  for each row
  execute function public.enforce_highlight_entitlements();
