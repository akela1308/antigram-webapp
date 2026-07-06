-- Canonical comments table and RLS policies.
-- Idempotent by design: safe to run against a production table created manually.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.comments
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists moment_id uuid,
  add column if not exists user_id uuid,
  add column if not exists text text,
  add column if not exists created_at timestamptz default now();

alter table public.comments
  alter column id set default gen_random_uuid(),
  alter column created_at set default now();

update public.comments
set created_at = now()
where created_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.comments'::regclass
      and conname = 'comments_text_not_blank'
  ) then
    alter table public.comments
      add constraint comments_text_not_blank
      check (length(trim(text)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.comments'::regclass
      and conname = 'comments_text_length'
  ) then
    alter table public.comments
      add constraint comments_text_length
      check (char_length(text) <= 1000);
  end if;
end $$;

create index if not exists comments_moment_created_idx
  on public.comments(moment_id, created_at asc);

create index if not exists comments_user_created_idx
  on public.comments(user_id, created_at desc);

alter table public.comments enable row level security;

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
        and m.is_public = true
    )
  );

drop policy if exists "Comments are readable by owner or admin" on public.comments;
create policy "Comments are readable by owner or admin"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.moments m
      where m.id = comments.moment_id
        and (m.user_id = auth.uid() or public.is_admin_user(auth.uid()))
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
        and m.is_public = true
    )
  );

drop policy if exists "Comments can be updated by owner or admin" on public.comments;
create policy "Comments can be updated by owner or admin"
  on public.comments
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user(auth.uid()))
  with check (
    (auth.uid() = user_id or public.is_admin_user(auth.uid()))
    and length(trim(text)) > 0
    and char_length(text) <= 1000
  );

drop policy if exists "Comments can be deleted by owner or admin" on public.comments;
create policy "Comments can be deleted by owner or admin"
  on public.comments
  for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;

do $$
begin
  if to_regprocedure('public.notify_on_comment()') is not null then
    drop trigger if exists on_comment_notify on public.comments;
    create trigger on_comment_notify
      after insert on public.comments
      for each row execute function public.notify_on_comment();
  end if;
end $$;
