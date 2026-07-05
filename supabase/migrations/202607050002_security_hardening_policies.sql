create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and is_admin = true
  );
$$;

grant execute on function public.is_admin_user(uuid) to authenticated;

drop policy if exists "Загружать могут авторизованные" on storage.objects;
drop policy if exists "Moments uploads must stay in own folder" on storage.objects;
create policy "Moments uploads must stay in own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'moments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Только сам пользователь редактирует профиль" on public.profiles;
drop policy if exists "Редактировать профиль: сам или админ" on public.profiles;
drop policy if exists "Profiles can be updated by owner or admin" on public.profiles;
create policy "Profiles can be updated by owner or admin"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin_user(auth.uid()))
  with check (auth.uid() = id or public.is_admin_user(auth.uid()));

drop policy if exists "Редактировать можно только свои" on public.moments;
drop policy if exists "Moments can be updated by owner or admin" on public.moments;
create policy "Moments can be updated by owner or admin"
  on public.moments
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user(auth.uid()))
  with check (auth.uid() = user_id or public.is_admin_user(auth.uid()));

do $$
begin
  if to_regclass('public.highlights') is not null then
    drop policy if exists "highlights_update" on public.highlights;
    drop policy if exists "Highlights can be updated by owner" on public.highlights;
    create policy "Highlights can be updated by owner"
      on public.highlights
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if to_regclass('public.albums') is not null then
    drop policy if exists "albums_update" on public.albums;
    drop policy if exists "Albums can be updated by owner" on public.albums;
    create policy "Albums can be updated by owner"
      on public.albums
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if to_regclass('public.reports') is not null then
    drop policy if exists "Только админы обновляют репорты" on public.reports;
    drop policy if exists "Reports can be updated by admins" on public.reports;
    create policy "Reports can be updated by admins"
      on public.reports
      for update
      to authenticated
      using (public.is_admin_user(auth.uid()))
      with check (public.is_admin_user(auth.uid()));
  end if;
end $$;
