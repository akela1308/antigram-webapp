create or replace function public.get_moment_reaction_summaries(p_moment_ids uuid[])
returns table (
  moment_id uuid,
  counts jsonb,
  top_type text,
  top_count bigint,
  my_reaction text
)
language sql
stable
security invoker
set search_path = public
as $$
  with requested as (
    select distinct unnest(p_moment_ids) as moment_id
  ),
  grouped as (
    select
      r.moment_id,
      r.type,
      count(*)::bigint as count
    from public.reactions r
    where r.moment_id = any(p_moment_ids)
    group by r.moment_id, r.type
  ),
  count_json as (
    select
      g.moment_id,
      jsonb_object_agg(g.type, g.count) as counts
    from grouped g
    group by g.moment_id
  ),
  top_rows as (
    select
      g.moment_id,
      g.type,
      g.count,
      row_number() over (
        partition by g.moment_id
        order by g.count desc, g.type asc
      ) as rank
    from grouped g
  ),
  mine as (
    select r.moment_id, r.type
    from public.reactions r
    where auth.uid() is not null
      and r.user_id = auth.uid()
      and r.moment_id = any(p_moment_ids)
  )
  select
    requested.moment_id,
    coalesce(count_json.counts, '{}'::jsonb) as counts,
    top_rows.type as top_type,
    coalesce(top_rows.count, 0) as top_count,
    mine.type as my_reaction
  from requested
  left join count_json on count_json.moment_id = requested.moment_id
  left join top_rows on top_rows.moment_id = requested.moment_id and top_rows.rank = 1
  left join mine on mine.moment_id = requested.moment_id;
$$;

grant execute on function public.get_moment_reaction_summaries(uuid[]) to anon, authenticated;

create or replace function public.get_unread_notification_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.notifications n
  where auth.uid() is not null
    and n.user_id = auth.uid()
    and n.read = false;
$$;

grant execute on function public.get_unread_notification_count() to authenticated;
