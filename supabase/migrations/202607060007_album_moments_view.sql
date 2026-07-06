-- Safe album moment read surface.
-- The view relies on album_moments/moments RLS and avoids nested PostgREST joins.

drop view if exists public.album_moment_details;

create view public.album_moment_details
with (security_invoker = true)
as
select
  am.album_id,
  am.added_at,
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
  m.created_at
from public.album_moments am
join public.moments m on m.id = am.moment_id;

grant select on public.album_moment_details to anon, authenticated;
