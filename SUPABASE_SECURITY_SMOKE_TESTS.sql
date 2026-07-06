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
    'moments storage delete policy exists',
    exists (
      select 1
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'Moments files can be deleted from own folder or by admin'
        and cmd = 'DELETE'
    ),
    'deleting a moment should be able to clean owner storage files without allowing users to delete other users files'

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

  union all

  select
    'album_moment_details view exists',
    to_regclass('public.album_moment_details') is not null,
    'album detail should read moments through a safe view'

  union all

  select
    'album_moment_details exposes no profile service columns',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'album_moment_details'
        and column_name in ('is_admin', 'is_banned', 'is_blocked')
    ),
    'album moment view should not expose profile service flags'

  union all

  select
    'my_notifications view exists',
    to_regclass('public.my_notifications') is not null,
    'notifications should read through an owner-only safe view'

  union all

  select
    'my_notifications is not granted to anon',
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'my_notifications'
        and grantee = 'anon'
        and privilege_type = 'SELECT'
    ),
    'anonymous users must not be able to query notifications'

  union all

  select
    'my_notifications exposes only safe actor columns',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'my_notifications'
        and column_name in ('is_admin', 'is_banned', 'is_blocked')
    ),
    'notifications view should not expose actor service profile flags'

  union all

  select
    'mark_my_notifications_read function exists',
    exists (
      select 1
      from information_schema.routines
      where routine_schema = 'public'
        and routine_name = 'mark_my_notifications_read'
    ),
    'notification read state should be updated through auth.uid() RPC instead of trusting client user_id'

  union all

  select
    'highlight_moment_details view exists',
    to_regclass('public.highlight_moment_details') is not null,
    'profile film strip should read highlights through a safe view'

  union all

  select
    'highlight_moment_details exposes no profile service columns',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'highlight_moment_details'
        and column_name in ('is_admin', 'is_banned', 'is_blocked')
    ),
    'highlight view should not expose profile service flags'

  union all

  select
    'admin_moderation_reports view exists',
    to_regclass('public.admin_moderation_reports') is not null,
    'moderation queue should read through an admin safe view'

  union all

  select
    'admin_moderation_reports is not granted to anon',
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'admin_moderation_reports'
        and grantee = 'anon'
        and privilege_type = 'SELECT'
    ),
    'anonymous users must not be able to query moderation reports'

  union all

  select
    'admin_moderation_reports exposes no profile service columns',
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'admin_moderation_reports'
        and column_name in ('is_admin', 'is_banned', 'is_blocked')
    ),
    'moderation view should not expose raw profile service flags'

  union all

  select
    'star webhook events table exists',
    to_regclass('public.star_webhook_events') is not null,
    'telegram Stars webhook attempts should be ledgered for retries and duplicate handling'

  union all

  select
    'star webhook events RLS is enabled',
    exists (
      select 1
      from pg_tables
      where schemaname = 'public'
        and tablename = 'star_webhook_events'
        and rowsecurity = true
    ),
    'webhook ledger should not be public'

  union all

  select
    'complete_star_payment function exists',
    exists (
      select 1
      from information_schema.routines
      where routine_schema = 'public'
        and routine_name = 'complete_star_payment'
    ),
    'successful_payment should complete through a server-side idempotent function'

  union all

  select
    'star payments charge id is unique',
    exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'star_payments'
        and c.contype = 'u'
        and pg_get_constraintdef(c.oid) like '%telegram_payment_charge_id%'
    ),
    'telegram_payment_charge_id must be unique for duplicate webhook safety'

  union all

  select
    'star reconciliation is not granted to anon',
    not exists (
      select 1
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name = 'star_payment_reconciliation'
        and grantee = 'anon'
        and privilege_type = 'SELECT'
    ),
    'anonymous users must not be able to query payment reconciliation'

  union all

  select
    'service_role can run star payment surfaces',
    (
      select count(*)
      from information_schema.role_table_grants
      where table_schema = 'public'
        and table_name in ('star_payments', 'star_webhook_events', 'moment_star_totals', 'profile_star_totals')
        and grantee = 'service_role'
        and privilege_type in ('SELECT', 'INSERT', 'UPDATE')
    ) >= 12,
    'Stars Edge Functions need narrow service_role grants to create invoices, ledger webhooks, and complete payments'
)
select
  check_name,
  passed,
  case when passed then 'ok' else 'needs attention' end as status,
  details
from checks
order by passed asc, check_name asc;
