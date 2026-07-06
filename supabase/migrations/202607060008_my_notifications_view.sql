-- Owner-only notifications read surface.
-- The view relies on notifications RLS and returns safe actor/moment preview fields.

drop view if exists public.my_notifications;

create view public.my_notifications
with (security_invoker = true)
as
select
  n.id,
  n.user_id,
  n.type,
  n.actor_id,
  n.moment_id,
  n.payload,
  n.read,
  n.created_at,
  p.id as actor_profile_id,
  p.username as actor_username,
  p.display_name as actor_display_name,
  p.bio as actor_bio,
  p.avatar_url as actor_avatar_url,
  p.website as actor_website,
  p.created_at as actor_profile_created_at,
  m.photo_url as moment_photo_url,
  m.image_variants as moment_image_variants
from public.notifications n
left join public.public_profiles p on p.id = n.actor_id
left join public.moments m on m.id = n.moment_id;

grant select on public.my_notifications to authenticated;
