drop policy if exists "Account identities writable by owner" on public.account_identities;
drop policy if exists "Account identities update by owner" on public.account_identities;
drop policy if exists "Account email identities writable by owner" on public.account_identities;
drop policy if exists "Account email identities update by owner" on public.account_identities;

create policy "Account email identities writable by owner"
  on public.account_identities
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and provider = 'email'
    and external_id = lower(auth.jwt() ->> 'email')
    and external_id not like '%@antigram.internal'
  );

create policy "Account email identities update by owner"
  on public.account_identities
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and provider = 'email'
    and external_id = lower(auth.jwt() ->> 'email')
  )
  with check (
    auth.uid() = user_id
    and provider = 'email'
    and external_id = lower(auth.jwt() ->> 'email')
    and external_id not like '%@antigram.internal'
  );

revoke insert, update on public.account_identities from authenticated;
grant select, insert, update on public.account_identities to authenticated;
