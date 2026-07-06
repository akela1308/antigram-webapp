-- Public-safe moment feed surface.
-- Flattens moment + public profile fields and relies on moments RLS via security_invoker.

drop view if exists public.public_moments;

create view public.public_moments
with (security_invoker = true)
as
select
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
from public.moments m
join public.public_profiles p on p.id = m.user_id;

grant select on public.public_moments to anon, authenticated;
