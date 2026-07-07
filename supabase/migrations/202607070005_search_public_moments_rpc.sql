-- Search V1 foundation: public-safe ranked moment search.
-- Keeps the client on a narrow RPC surface instead of broad ilike queries.

create or replace function public.search_public_moments(
  p_query text,
  p_limit integer default 24
)
returns table (
  id uuid,
  user_id uuid,
  photo_url text,
  image_variants jsonb,
  caption text,
  mood text,
  custom_mood_emoji text,
  custom_mood_label text,
  film_preset_id text,
  is_public boolean,
  visibility text,
  created_at timestamptz,
  profile_id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  website text,
  profile_created_at timestamptz,
  search_rank real
)
language sql
stable
set search_path = public
as $$
  with normalized as (
    select
      nullif(trim(p_query), '') as query_text,
      greatest(1, least(coalesce(p_limit, 24), 60)) as safe_limit
  ),
  prepared as (
    select
      query_text,
      safe_limit,
      plainto_tsquery('simple', query_text) as ts_query,
      '%' || replace(replace(query_text, '%', ' '), ',', ' ') || '%' as like_query
    from normalized
    where length(query_text) >= 2
  )
  select
    pm.id,
    pm.user_id,
    pm.photo_url,
    pm.image_variants,
    pm.caption,
    pm.mood,
    pm.custom_mood_emoji,
    pm.custom_mood_label,
    pm.film_preset_id,
    pm.is_public,
    pm.visibility,
    pm.created_at,
    pm.profile_id,
    pm.username,
    pm.display_name,
    pm.bio,
    pm.avatar_url,
    pm.website,
    pm.profile_created_at,
    (
      ts_rank_cd(
        setweight(to_tsvector('simple', coalesce(pm.caption, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(pm.custom_mood_label, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(pm.mood, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(pm.display_name, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(pm.username, '')), 'C'),
        prepared.ts_query
      )
      + case when pm.mood ilike prepared.like_query then 0.35 else 0 end
      + case when pm.custom_mood_label ilike prepared.like_query then 0.25 else 0 end
      + case when pm.caption ilike prepared.like_query then 0.15 else 0 end
      + case when pm.username ilike prepared.like_query then 0.10 else 0 end
      + case when pm.display_name ilike prepared.like_query then 0.10 else 0 end
    )::real as search_rank
  from public.public_moments pm
  cross join prepared
  where
    (
      setweight(to_tsvector('simple', coalesce(pm.caption, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(pm.custom_mood_label, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(pm.mood, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(pm.display_name, '')), 'C') ||
      setweight(to_tsvector('simple', coalesce(pm.username, '')), 'C')
    ) @@ prepared.ts_query
    or pm.caption ilike prepared.like_query
    or pm.custom_mood_label ilike prepared.like_query
    or pm.mood ilike prepared.like_query
    or pm.username ilike prepared.like_query
    or pm.display_name ilike prepared.like_query
  order by search_rank desc, pm.created_at desc
  limit (select safe_limit from prepared);
$$;

grant execute on function public.search_public_moments(text, integer) to anon, authenticated;
