# Supabase Pending Migrations

Дата: 2026-07-05

Supabase CLI сейчас подвисает на DB connection (`Initialising login role...` / `migration list` без ответа), поэтому эти миграции нужно применить через Supabase Dashboard -> SQL Editor или повторить CLI позже.

## Порядок применения

1. `supabase/migrations/202607050001_moment_image_variants.sql`
   - добавляет `moments.image_variants`;
   - включает хранение `thumb/feed/full/original` URL для новых моментов.

2. `supabase/migrations/202607050002_security_hardening_policies.sql`
   - закрывает upload в чужие storage-папки bucket `moments`;
   - добавляет `WITH CHECK` для update-политик;
   - усиливает optional policies для `highlights`, `albums`, `reports`.

3. `supabase/migrations/202607050003_star_payment_reliability.sql`
   - добавляет webhook ledger для Stars;
   - добавляет отметки `pre_checkout_seen_at`, `successful_payment_seen_at`;
   - добавляет статус уведомления автора;
   - обновляет `complete_star_payment`;
   - добавляет reconciliation view.

4. `supabase/migrations/202607050004_reaction_notification_aggregates.sql`
   - добавляет `get_moment_reaction_summaries(uuid[])`;
   - добавляет `get_unread_notification_count()`.

5. `supabase/migrations/202607050005_blocked_users.sql`
   - добавляет таблицу `blocked_users`;
   - включает RLS: читать могут только участники блокировки;
   - блокировать/разблокировать пользователь может только от своего имени.

6. `supabase/migrations/202607050006_moderation_queue.sql`
   - расширяет/создает `reports` для жалоб на кадры и профили;
   - добавляет статусы модерации `open/reviewed/dismissed/actioned`;
   - добавляет `admin_audit_log`;
   - разрешает админам удалять кадры через RLS policy.

7. `supabase/migrations/202607050007_saved_moments_policies.sql`
   - создает/фиксирует таблицу `saved_moments`;
   - добавляет unique на `user_id + moment_id`;
   - включает RLS: читать/сохранять/убирать сохранение может только владелец.

8. `supabase/migrations/202607050008_account_identities.sql`
   - добавляет `account_identities`;
   - хранит привязки `telegram/email/google/apple` к одному `user_id`;
   - позволяет Telegram-входу работать после привязки реального email/пароля.

9. `supabase/migrations/202607050009_user_entitlements_rpc.sql`
   - добавляет `get_user_entitlements(auth.uid())`;
   - возвращает серверные права пользователя: Premium, лимит кадров, лимит highlights и feature flags;
   - позволяет клиенту показывать лимиты из базы, а не решать доступ локально.

## Почему приложение не должно упасть до применения

- Image variants имеют fallback на старый `photo_url`.
- Insert публикации повторяется без `image_variants`, если колонка еще не создана.
- Select-запросы с `image_variants` имеют legacy fallback.
- Stars webhook логирование мягко пропускает новые таблицы/колонки, если миграция еще не применена.
- Reaction aggregate helper откатывается на старые queries, если RPC еще нет.
- Unread notification count откатывается на старый count query, если RPC еще нет.
- Block helpers мягко пропускают фильтрацию, если `blocked_users` еще нет.
- Moderation UI покажет пустую очередь/ошибку действия, если `reports` еще не расширена.
- Saved album будет пустым или покажет ошибку сохранения, если `saved_moments`/RLS еще не применены.
- Email/password linking будет недоступен, если `account_identities` еще не применена.
- Entitlements откатываются на локальный fallback и active subscription query, если `get_user_entitlements` еще не применена.

## Проверка после применения

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'moments'
  and column_name = 'image_variants';
```

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('get_moment_reaction_summaries', 'get_unread_notification_count', 'complete_star_payment');
```

```sql
select policyname, cmd, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'Moments uploads must stay in own folder';
```

```sql
select exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'blocked_users'
) as has_blocked_users;
```

```sql
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reports'
      and column_name = 'reported_user_id'
  ) as has_reported_user_id,
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'admin_audit_log'
  ) as has_admin_audit_log;
```

```sql
select exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'saved_moments'
) as has_saved_moments;
```

```sql
select exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'account_identities'
) as has_account_identities;
```

```sql
select exists (
  select 1
  from information_schema.routines
  where routine_schema = 'public'
    and routine_name = 'get_user_entitlements'
) as has_user_entitlements_rpc;
```
