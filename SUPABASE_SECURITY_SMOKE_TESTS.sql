-- Antigram Supabase security smoke tests.
-- Read-only verification pack: run in Supabase SQL Editor after manual migrations.

with checks as (
  select
    'moments.visibility column exists' as check_name,
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'moments'
        and column_name = 'visibility'
    ) as passed,
    'moments must have visibility for public/followers/private foundation' as details

  union all

  select
    'moments.visibility has no invalid values',
    not exists (
      select 1
      from public.moments
      where visibility is null
        or visibility not in ('public', 'followers', 'private')
    ),
    'all existing moments should be backfilled to valid visibility'

  union all

  select
    'moments.is_public is synced with visibility',
    not exists (
      select 1
      from public.moments
      where is_public is distinct from (visibility = 'public')
    ),
    'legacy is_public must match visibility = public'

  union all

  select
    'sync_moment_visibility trigger exists',
    exists (
      select 1
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'moments'
        and trigger_name = 'sync_moment_visibility_before_write'
    ),
    'trigger keeps is_public and visibility compatible'

  union all

  select
    'can_view_moment function exists',
    exists (
      select 1
      from information_schema.routines
      where routine_schema = 'public'
        and routine_name = 'can_view_moment'
    ),
    'helper is used by future RPC/view and comments policies'

  union all

  select
    'public_profiles view exists',
    to_regclass('public.public_profiles') is not null,
    'public profile surface should hide admin/moderation flags'

  union all

  select
    'public_profiles exposes only safe columns',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'public_profiles'
        and column_name not in ('id', 'username', 'display_name', 'bio', 'avatar_url', 'website', 'created_at')
    ),
    'view should not expose is_admin, is_banned, or other service fields'

  union all

  select
    'public_moments view exists',
    to_regclass('public.public_moments') is not null,
    'public moment feed surface should hide direct profile joins'

  union all

  select
    'public_moments exposes only safe profile columns',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'public_moments'
        and column_name in ('is_admin', 'is_banned', 'is_blocked')
    ),
    'public_moments should not expose service profile flags'

  union all

  select
    'moments privacy select policies exist',
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'moments'
        and policyname in (
          'Public moments visible by privacy',
          'Follower moments visible by privacy',
          'Own moments visible by privacy',
          'Admin moments visible by privacy'
        )
    ) = 4,
    'moments should have public/followers/own/admin select policies'

  union all

  select
    'old broad moments select policies removed',
    not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'moments'
        and policyname in (
          'Публичные моменты видны всем',
          'Публичные моменты видны всем (учёт банов)',
          'Свои моменты видны всегда',
          'Moments visible by privacy'
        )
    ),
    'old select policies should not coexist with visibility-aware policies'

  union all

  select
    'moments owner write policies exist',
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'moments'
        and policyname in (
          'Moments can be inserted by owner',
          'Moments can be updated by owner or admin',
          'Moments can be deleted by owner or admin'
        )
    ) = 3,
    'insert/update/delete policies should be explicit'

  union all

  select
    'comments table exists',
    to_regclass('public.comments') is not null,
    'comments table should be canonical in migrations'

  union all

  select
    'comments RLS is enabled',
    exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = 'comments'
        and rowsecurity = true
    ),
    'comments must be protected by RLS'

  union all

  select
    'comments policies exist',
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'comments'
        and policyname in (
          'Comments are readable on public moments',
          'Comments are readable by moment viewers',
          'Comments can be created by owner',
          'Comments can be updated by owner or admin',
          'Comments can be deleted by owner or admin'
        )
    ) = 5,
    'comments should have read/create/update/delete policies'

  union all

  select
    'account_identities hardened policies exist',
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'account_identities'
        and policyname in (
          'Account identities visible to owner or admin',
          'Account email identities writable by owner',
          'Account email identities update by owner'
        )
    ) = 3,
    'identity writes should only allow verified email rows from client'

  union all

  select
    'image variants column exists',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'moments'
        and column_name = 'image_variants'
    ),
    'image variants reduce storage egress and support responsive feeds'

  union all

  select
    'saved_moments owner policies exist',
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
        and tablename = 'saved_moments'
        and policyname in (
          'Saved moments visible to owner',
          'Users can save moments',
          'Users can unsave moments'
        )
    ) = 3,
    'saved album should remain private to the owner'

  union all

  select
    'my_saved_moments view exists',
    to_regclass('public.my_saved_moments') is not null,
    'saved album should read through an owner-only safe view'

  union all

  select
    'my_saved_moments is not granted to anon',
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'my_saved_moments'
        and grantee = 'anon'
        and privilege_type = 'SELECT'
    ),
    'anonymous users must not be able to query saved moments'

  union all

  select
    'my_saved_moments exposes only safe profile columns',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'my_saved_moments'
        and column_name in ('is_admin', 'is_banned', 'is_blocked')
    ),
    'saved moments view should not expose service profile flags'
)
select
  check_name,
  passed,
  case when passed then 'ok' else 'needs attention' end as status,
  details
from checks
order by passed asc, check_name asc;
