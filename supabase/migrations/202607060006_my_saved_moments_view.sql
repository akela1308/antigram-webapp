-- Owner-only saved moments surface.
-- The view relies on saved_moments RLS and only grants access to authenticated users.

drop view if exists public.my_saved_moments;

create view public.my_saved_moments
with (security_invoker = true)
as
select
  sm.saved_at,
  sm.user_id as saved_by_user_id,
  m.id,
  m.user_id,
  m.photo_url,
  m.image_variants,
  m.caption,
  m.mood,
  m.custom_mood_emoji,
  m.custom_mood_label,
  m.film_preset_id,
  m.is_public,
  m.visibility,
  m.created_at,
  p.id as profile_id,
  p.username,
  p.display_name,
  p.bio,
  p.avatar_url,
  p.website,
  p.created_at as profile_created_at
from public.saved_moments sm
join public.moments m on m.id = sm.moment_id
join public.public_profiles p on p.id = m.user_id;

grant select on public.my_saved_moments to authenticated;
