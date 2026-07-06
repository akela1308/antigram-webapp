-- Public-safe profile surface for social UI.
-- Keep service/admin-only flags out of ordinary client reads.

drop view if exists public.public_profiles;

create view public.public_profiles
with (security_invoker = true)
as
select
  id,
  username,
  display_name,
  bio,
  avatar_url,
  website,
  created_at
from public.profiles
where coalesce(is_banned, false) = false;

grant select on public.public_profiles to anon, authenticated;
