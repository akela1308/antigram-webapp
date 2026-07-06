-- Moment visibility foundation for future public / followers / private privacy.
-- Current UI still publishes public moments; this prepares RLS and schema.

alter table public.moments
  add column if not exists visibility text;

update public.moments
set visibility = case when coalesce(is_public, true) then 'public' else 'private' end
where visibility is null;

alter table public.moments
  alter column visibility set default 'public',
  alter column visibility set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.moments'::regclass
      and conname = 'moments_visibility_check'
  ) then
    alter table public.moments
      add constraint moments_visibility_check
      check (visibility in ('public', 'followers', 'private'));
  end if;
end $$;

update public.moments
set is_public = (visibility = 'public')
where is_public is distinct from (visibility = 'public');

create index if not exists moments_visibility_created_at_idx
  on public.moments(visibility, created_at desc);

create index if not exists moments_user_visibility_created_at_idx
  on public.moments(user_id, visibility, created_at desc);

create or replace function public.sync_moment_visibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.visibility is not distinct from old.visibility
    and new.is_public is distinct from old.is_public then
    new.visibility := case when coalesce(new.is_public, true) then 'public' else 'private' end;
  elsif new.visibility is null then
    new.visibility := case when coalesce(new.is_public, true) then 'public' else 'private' end;
  end if;

  new.is_public := (new.visibility = 'public');
  return new;
end;
$$;

drop trigger if exists sync_moment_visibility_before_write on public.moments;
create trigger sync_moment_visibility_before_write
  before insert or update of visibility, is_public on public.moments
  for each row execute function public.sync_moment_visibility();

drop function if exists public.can_view_moment(uuid, text, uuid);

create or replace function public.can_view_moment(
  p_owner_id uuid,
  p_visibility text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_owner_id = auth.uid()
    or (auth.uid() is not null and public.is_admin_user(auth.uid()))
    or (
      not exists (
        select 1
        from public.profiles p
        where p.id = p_owner_id
          and coalesce(p.is_banned, false) = true
      )
      and (
        p_visibility = 'public'
        or (
          p_visibility = 'followers'
          and auth.uid() is not null
          and exists (
            select 1
            from public.follows f
            where f.follower_id = auth.uid()
              and f.following_id = p_owner_id
          )
        )
      )
    )
$$;

grant execute on function public.can_view_moment(uuid, text) to anon, authenticated;

alter table public.moments enable row level security;

drop policy if exists "Публичные моменты видны всем" on public.moments;
drop policy if exists "Публичные моменты видны всем (учёт банов)" on public.moments;
drop policy if exists "Свои моменты видны всегда" on public.moments;
drop policy if exists "Moments visible by privacy" on public.moments;
drop policy if exists "Public moments visible by privacy" on public.moments;
drop policy if exists "Follower moments visible by privacy" on public.moments;
drop policy if exists "Own moments visible by privacy" on public.moments;
drop policy if exists "Admin moments visible by privacy" on public.moments;

create policy "Public moments visible by privacy"
  on public.moments
  for select
  to anon, authenticated
  using (
    visibility = 'public'
    and not exists (
      select 1
      from public.profiles p
      where p.id = moments.user_id
        and coalesce(p.is_banned, false) = true
    )
  );

create policy "Follower moments visible by privacy"
  on public.moments
  for select
  to authenticated
  using (
    visibility = 'followers'
    and exists (
      select 1
      from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = moments.user_id
    )
  );

create policy "Own moments visible by privacy"
  on public.moments
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admin moments visible by privacy"
  on public.moments
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Публиковать могут только авторизованные" on public.moments;
drop policy if exists "Moments can be inserted by owner" on public.moments;
create policy "Moments can be inserted by owner"
  on public.moments
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and visibility in ('public', 'followers', 'private')
    and is_public = (visibility = 'public')
  );

drop policy if exists "Редактировать можно только свои" on public.moments;
drop policy if exists "Moments can be updated by owner or admin" on public.moments;
create policy "Moments can be updated by owner or admin"
  on public.moments
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user(auth.uid()))
  with check (
    (auth.uid() = user_id or public.is_admin_user(auth.uid()))
    and visibility in ('public', 'followers', 'private')
    and is_public = (visibility = 'public')
  );

drop policy if exists "Удалять можно только свои" on public.moments;
drop policy if exists "Удалять можно свои или быть админом" on public.moments;
drop policy if exists "Moments can be deleted by owner or admin" on public.moments;
create policy "Moments can be deleted by owner or admin"
  on public.moments
  for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

do $$
begin
  if to_regclass('public.comments') is not null then
    drop policy if exists "Comments are readable on public moments" on public.comments;
    create policy "Comments are readable on public moments"
      on public.comments
      for select
      to anon, authenticated
      using (
        exists (
          select 1
          from public.moments m
          where m.id = comments.moment_id
            and m.visibility = 'public'
            and not exists (
              select 1
              from public.profiles p
              where p.id = m.user_id
                and coalesce(p.is_banned, false) = true
            )
        )
      );

    drop policy if exists "Comments are readable by owner or admin" on public.comments;
    drop policy if exists "Comments are readable by moment viewers" on public.comments;
    create policy "Comments are readable by moment viewers"
      on public.comments
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.moments m
          where m.id = comments.moment_id
            and public.can_view_moment(m.user_id, m.visibility)
        )
      );

    drop policy if exists "Comments can be created by owner" on public.comments;
    create policy "Comments can be created by owner"
      on public.comments
      for insert
      to authenticated
      with check (
        auth.uid() = user_id
        and length(trim(text)) > 0
        and char_length(text) <= 1000
        and exists (
          select 1
          from public.moments m
          where m.id = comments.moment_id
            and public.can_view_moment(m.user_id, m.visibility)
        )
      );
  end if;
end $$;
