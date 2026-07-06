-- Safe highlight moment read surface.
-- The view relies on highlights/moments RLS and avoids nested PostgREST joins.

drop view if exists public.highlight_moment_details;

create view public.highlight_moment_details
with (security_invoker = true)
as
select
  h.id,
  h.user_id,
  h.moment_id,
  h.position,
  h.created_at,
  m.id as moment_detail_id,
  m.photo_url as moment_photo_url,
  m.image_variants as moment_image_variants
from public.highlights h
join public.moments m on m.id = h.moment_id;

grant select on public.highlight_moment_details to anon, authenticated;
