create extension if not exists pgcrypto;

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

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '',
  attachment_bucket text,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  attachment_size integer,
  page_url text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_reporter_id_idx on public.support_requests(reporter_id);
create index if not exists support_requests_status_idx on public.support_requests(status);
create index if not exists support_requests_created_at_idx on public.support_requests(created_at desc);

alter table public.support_requests enable row level security;

drop policy if exists "Support requests can be created by owner" on public.support_requests;
create policy "Support requests can be created by owner"
  on public.support_requests
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists "Support requests visible to admins" on public.support_requests;
create policy "Support requests visible to admins"
  on public.support_requests
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Support requests can be updated by admins" on public.support_requests;
create policy "Support requests can be updated by admins"
  on public.support_requests
  for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

create or replace function public.set_support_request_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_support_requests_updated_at on public.support_requests;
create trigger set_support_requests_updated_at
  before update on public.support_requests
  for each row
  execute function public.set_support_request_updated_at();

insert into storage.buckets (id, name, public, file_size_limit)
values ('support-attachments', 'support-attachments', false, 8388608)
on conflict (id) do update
  set public = false,
      file_size_limit = 8388608;

drop policy if exists "Support attachments visible to admins" on storage.objects;
create policy "Support attachments visible to admins"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and public.is_admin_user(auth.uid())
  );
