create table if not exists public.saved_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  moment_id uuid not null references public.moments(id) on delete cascade,
  saved_at timestamptz not null default now(),
  constraint saved_moments_unique_user_moment unique (user_id, moment_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_moments_unique_user_moment'
      and conrelid = 'public.saved_moments'::regclass
  ) then
    alter table public.saved_moments
      add constraint saved_moments_unique_user_moment
      unique (user_id, moment_id);
  end if;
end $$;

create index if not exists saved_moments_user_id_saved_at_idx
  on public.saved_moments(user_id, saved_at desc);

create index if not exists saved_moments_moment_id_idx
  on public.saved_moments(moment_id);

alter table public.saved_moments enable row level security;

drop policy if exists "Saved moments visible to owner" on public.saved_moments;
create policy "Saved moments visible to owner"
  on public.saved_moments
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can save moments" on public.saved_moments;
create policy "Users can save moments"
  on public.saved_moments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can unsave moments" on public.saved_moments;
create policy "Users can unsave moments"
  on public.saved_moments
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.saved_moments to authenticated;
