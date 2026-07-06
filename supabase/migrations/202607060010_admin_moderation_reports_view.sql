-- Admin-only moderation report read surface.
-- The view relies on reports RLS and keeps profile service flags out of the client shape.

drop view if exists public.admin_moderation_reports;

create view public.admin_moderation_reports
with (security_invoker = true)
as
select
  r.id,
  r.reporter_id,
  r.reported_moment_id,
  r.reported_user_id,
  r.reason,
  r.status,
  r.admin_note,
  r.reviewed_by,
  r.reviewed_at,
  r.created_at,

  reporter.username as reporter_username,
  reporter.display_name as reporter_display_name,
  reporter.bio as reporter_bio,
  reporter.avatar_url as reporter_avatar_url,
  reporter.website as reporter_website,
  reporter.created_at as reporter_created_at,

  reported_user.username as reported_user_username,
  reported_user.display_name as reported_user_display_name,
  reported_user.bio as reported_user_bio,
  reported_user.avatar_url as reported_user_avatar_url,
  reported_user.website as reported_user_website,
  reported_user.created_at as reported_user_created_at,

  m.id as moment_id,
  m.user_id as moment_user_id,
  m.photo_url as moment_photo_url,
  m.image_variants as moment_image_variants,
  m.caption as moment_caption,
  m.mood as moment_mood,
  m.custom_mood_emoji as moment_custom_mood_emoji,
  m.custom_mood_label as moment_custom_mood_label,
  m.film_preset_id as moment_film_preset_id,
  m.is_public as moment_is_public,
  m.visibility as moment_visibility,
  m.created_at as moment_created_at,

  moment_author.username as moment_author_username,
  moment_author.display_name as moment_author_display_name,
  moment_author.bio as moment_author_bio,
  moment_author.avatar_url as moment_author_avatar_url,
  moment_author.website as moment_author_website,
  moment_author.created_at as moment_author_created_at
from public.reports r
join public.profiles reporter on reporter.id = r.reporter_id
left join public.profiles reported_user on reported_user.id = r.reported_user_id
left join public.moments m on m.id = r.reported_moment_id
left join public.profiles moment_author on moment_author.id = m.user_id;

grant select on public.admin_moderation_reports to authenticated;
