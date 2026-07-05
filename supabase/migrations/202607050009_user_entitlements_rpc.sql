create or replace function public.get_user_entitlements(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  has_premium boolean := false;
  daily_limit integer := 4;
  highlight_limit integer := 5;
  premium_until timestamptz := null;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'not_allowed';
  end if;

  select ps.expires_at
    into premium_until
  from public.premium_subscriptions ps
  where ps.user_id = p_user_id
    and ps.status = 'active'
    and ps.expires_at > now()
  order by ps.expires_at desc
  limit 1;

  has_premium := premium_until is not null;

  if has_premium then
    daily_limit := 8;
    highlight_limit := 10;
  end if;

  return jsonb_build_object(
    'is_premium', has_premium,
    'premium_until', premium_until,
    'daily_frame_limit', daily_limit,
    'highlight_limit', highlight_limit,
    'features', jsonb_build_object(
      'rare_films', has_premium,
      'premium_badge', has_premium,
      'priority_support', has_premium
    )
  );
end;
$$;

grant execute on function public.get_user_entitlements(uuid) to authenticated;
