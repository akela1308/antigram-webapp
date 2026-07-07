-- Canonical album RLS.
-- Public albums are discoverable; private albums and saved-like collections stay owner-only.

do $$
declare
  policy_record record;
begin
  if to_regclass('public.albums') is not null then
    alter table public.albums enable row level security;

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'albums'
    loop
      execute format('drop policy if exists %I on public.albums', policy_record.policyname);
    end loop;

    create policy "Albums visible when public or owned"
      on public.albums
      for select
      to anon, authenticated
      using (
        coalesce(is_public, false) = true
        or user_id = auth.uid()
      );

    create policy "Albums can be created by owner"
      on public.albums
      for insert
      to authenticated
      with check (user_id = auth.uid());

    create policy "Albums can be updated by owner"
      on public.albums
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());

    create policy "Albums can be deleted by owner"
      on public.albums
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

do $$
declare
  policy_record record;
begin
  if to_regclass('public.album_moments') is not null then
    alter table public.album_moments enable row level security;

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'album_moments'
    loop
      execute format('drop policy if exists %I on public.album_moments', policy_record.policyname);
    end loop;

    create policy "Album moments visible when album visible"
      on public.album_moments
      for select
      to anon, authenticated
      using (
        exists (
          select 1
          from public.albums a
          where a.id = album_moments.album_id
            and (
              coalesce(a.is_public, false) = true
              or a.user_id = auth.uid()
            )
        )
      );

    create policy "Album moments can be created by album owner"
      on public.album_moments
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.albums a
          where a.id = album_moments.album_id
            and a.user_id = auth.uid()
        )
        and exists (
          select 1
          from public.moments m
          where m.id = album_moments.moment_id
            and m.user_id = auth.uid()
        )
      );

    create policy "Album moments can be deleted by album owner"
      on public.album_moments
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.albums a
          where a.id = album_moments.album_id
            and a.user_id = auth.uid()
        )
      );
  end if;
end $$;
