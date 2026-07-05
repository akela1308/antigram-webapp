create table if not exists public.account_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_identities_provider_check
    check (provider in ('telegram', 'email', 'google', 'apple')),
  constraint account_identities_unique_provider_external unique (provider, external_id),
  constraint account_identities_unique_user_provider_external unique (user_id, provider, external_id)
);

create index if not exists account_identities_user_id_idx
  on public.account_identities(user_id);

alter table public.account_identities enable row level security;

drop policy if exists "Account identities visible to owner or admin" on public.account_identities;
create policy "Account identities visible to owner or admin"
  on public.account_identities
  for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

drop policy if exists "Account identities writable by owner" on public.account_identities;
create policy "Account identities writable by owner"
  on public.account_identities
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Account identities update by owner" on public.account_identities;
create policy "Account identities update by owner"
  on public.account_identities
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.account_identities to authenticated;
