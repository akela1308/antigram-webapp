-- Telegram referral attribution foundation.
-- Adds stable per-profile referral codes and first-touch invite attribution.

alter table public.profiles
  add column if not exists referral_code text;

update public.profiles
set referral_code = lower(substr(md5(id::text), 1, 10))
where referral_code is null;

alter table public.profiles
  alter column referral_code set default lower(substr(md5(gen_random_uuid()::text), 1, 10));

create unique index if not exists profiles_referral_code_key
  on public.profiles(referral_code)
  where referral_code is not null;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  referral_code text not null,
  start_param text,
  opened_at timestamptz not null default now(),
  first_post_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referrals_no_self_invite check (inviter_id <> invitee_id),
  constraint referrals_invitee_unique unique (invitee_id)
);

alter table public.referrals enable row level security;

drop policy if exists "Referrals visible to participants or admin" on public.referrals;
create policy "Referrals visible to participants or admin"
on public.referrals
for select
using (
  auth.uid() = inviter_id
  or auth.uid() = invitee_id
  or public.is_admin_user(auth.uid())
);

drop policy if exists "Referrals service role writes only" on public.referrals;
create policy "Referrals service role writes only"
on public.referrals
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.record_referral_open(
  p_invitee_id uuid,
  p_referral_code text,
  p_start_param text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inviter_id uuid;
begin
  if p_invitee_id is null or nullif(trim(p_referral_code), '') is null then
    return false;
  end if;

  select id
  into v_inviter_id
  from public.profiles
  where referral_code = lower(trim(p_referral_code))
  limit 1;

  if v_inviter_id is null or v_inviter_id = p_invitee_id then
    return false;
  end if;

  insert into public.referrals (inviter_id, invitee_id, referral_code, start_param)
  values (v_inviter_id, p_invitee_id, lower(trim(p_referral_code)), p_start_param)
  on conflict (invitee_id) do nothing;

  return true;
end;
$$;

create or replace function public.mark_my_referral_first_post()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.referrals
  set first_post_at = coalesce(first_post_at, now())
  where invitee_id = auth.uid();

  return found;
end;
$$;

grant execute on function public.record_referral_open(uuid, text, text) to service_role;
grant execute on function public.mark_my_referral_first_post() to authenticated;
