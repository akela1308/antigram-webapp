create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_moment_id uuid references public.moments(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null default 'reported',
  status text not null default 'open',
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reports
  add column if not exists reported_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists status text not null default 'open',
  add column if not exists admin_note text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_status_check'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_status_check
      check (status in ('open', 'reviewed', 'dismissed', 'actioned'));
  end if;
end $$;

create index if not exists reports_status_created_at_idx
  on public.reports(status, created_at desc);

create index if not exists reports_reported_user_id_idx
  on public.reports(reported_user_id);

create index if not exists reports_reported_moment_id_idx
  on public.reports(reported_moment_id);

alter table public.reports enable row level security;

drop policy if exists "Moments can be deleted by owner or admin" on public.moments;
create policy "Moments can be deleted by owner or admin"
  on public.moments
  for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
  on public.reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "Reports visible to admins" on public.reports;
create policy "Reports visible to admins"
  on public.reports
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Reports can be updated by admins" on public.reports;
create policy "Reports can be updated by admins"
  on public.reports
  for update
  to authenticated
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_moment_id uuid references public.moments(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_admin_id_created_at_idx
  on public.admin_audit_log(admin_id, created_at desc);

create index if not exists admin_audit_log_report_id_idx
  on public.admin_audit_log(report_id);

alter table public.admin_audit_log enable row level security;

drop policy if exists "Admin audit visible to admins" on public.admin_audit_log;
create policy "Admin audit visible to admins"
  on public.admin_audit_log
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists "Admins can write audit log" on public.admin_audit_log;
create policy "Admins can write audit log"
  on public.admin_audit_log
  for insert
  to authenticated
  with check (auth.uid() = admin_id and public.is_admin_user(auth.uid()));

grant select, insert, update on public.reports to authenticated;
grant select, insert on public.admin_audit_log to authenticated;
