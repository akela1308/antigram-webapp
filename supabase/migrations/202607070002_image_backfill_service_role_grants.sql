grant usage on schema public to service_role;

grant select (
  id,
  user_id,
  photo_url,
  image_variants,
  created_at
) on table public.moments to service_role;

grant update (
  image_variants
) on table public.moments to service_role;
