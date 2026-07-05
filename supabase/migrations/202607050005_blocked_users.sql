create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_users_no_self_block check (blocker_id <> blocked_id),
  constraint blocked_users_unique_pair unique (blocker_id, blocked_id)
);

create index if not exists blocked_users_blocker_id_idx
  on public.blocked_users(blocker_id);

create index if not exists blocked_users_blocked_id_idx
  on public.blocked_users(blocked_id);

alter table public.blocked_users enable row level security;

drop policy if exists "Blocked relationships visible to participants" on public.blocked_users;
create policy "Blocked relationships visible to participants"
  on public.blocked_users
  for select
  to authenticated
  using (auth.uid() = blocker_id or auth.uid() = blocked_id);

drop policy if exists "Users can block others" on public.blocked_users;
create policy "Users can block others"
  on public.blocked_users
  for insert
  to authenticated
  with check (auth.uid() = blocker_id and blocker_id <> blocked_id);

drop policy if exists "Users can unblock their own blocks" on public.blocked_users;
create policy "Users can unblock their own blocks"
  on public.blocked_users
  for delete
  to authenticated
  using (auth.uid() = blocker_id);

grant select, insert, delete on public.blocked_users to authenticated;
