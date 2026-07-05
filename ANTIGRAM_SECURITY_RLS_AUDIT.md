# Antigram Security / RLS Audit

Дата: 2026-07-05

## Цель

P0-аудит Supabase-политик перед ростом приложения: проверить, кто может читать фото, редактировать данные, видеть уведомления, админить moderation/support и работать с платежными таблицами.

## Что проверено

### Public content

- `profiles` публично читаются. Это ожидаемо для социальной сети: профиль, username, имя, аватар, счетчики.
- `moments` публично читаются только если `is_public = true`; после moderation-миграции публичная выдача скрывает посты забаненных авторов для всех, кроме автора и админов.
- `reactions` публично читаются. Это соответствует текущему UX: счетчики и популярная реакция видны в ленте, подборках и профилях.
- `follows` публично читаются. Это соответствует открытым счетчикам и спискам подписчиков/подписок.

### Owner-only data

- `push_tokens`: `FOR ALL` только свои строки.
- `notifications`: `FOR ALL` только свои строки. Пользователь не должен читать или отмечать чужие уведомления.
- `saved_moments`: доступ только к своим сохраненным моментам.
- `premium_subscriptions`: пользователь видит только свои подписки, полный доступ остается у `service_role`.

### Moderation / support

- `reports`: создавать может авторизованный reporter, читать и обновлять могут только админы.
- `support_requests`: создавать может владелец обращения, читать и обновлять могут только админы.
- `support-attachments`: bucket приватный, чтение разрешено только админам.

### Payments

- `star_payments`: пользователь видит платеж только если он payer или author.
- `moment_star_totals` и `profile_star_totals`: публичные totals. Это ок, потому что это агрегированные публичные счетчики без платежных деталей.
- `complete_star_payment` работает через `SECURITY DEFINER` и уже задает `search_path = public`.

## Исправлено миграцией

Добавлена миграция:

`supabase/migrations/202607050002_security_hardening_policies.sql`

Она делает три вещи:

1. Закрывает storage upload gap для bucket `moments`.
   Раньше любой авторизованный пользователь мог загрузить файл в `moments` под любым путем. Теперь upload разрешен только в папку, где первый сегмент пути равен `auth.uid()`.

2. Добавляет `WITH CHECK` к update-политикам `profiles` и `moments`.
   Это защищает от сценария, где пользователь обновляет свою строку, но пытается поменять owner-поле или стать владельцем чужих данных.

3. Усиливает update-политики для `highlights`, `albums`, `reports`, если эти таблицы существуют в окружении.

## Важные найденные риски

### 1. Миграции разбросаны по нескольким местам

SQL лежит минимум в трех местах:

- `/supabase/schema.sql`
- `/supabase/migrations/*`
- `/telegram-webapp/supabase/migrations/*`
- отдельные файлы вроде `supabase_migration_profile.sql`

Риск: продовая база может отличаться от локального представления. Нужно постепенно собрать актуальную схему в один Supabase migrations flow.

### 2. `comments` используется в notification trigger, но миграция таблицы не найдена

В `20260614_notifications.sql` есть trigger на `public.comments`, но в репозитории не найдена миграция создания `comments`.

Нужно проверить в Supabase:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'comments';
```

Если таблица существует, нужно добавить ее canonical migration в репозиторий. Если нет, notification migration для comments сейчас неполная.

### 3. Публичный bucket `moments`

Bucket публичный по продуктовой логике: фото должны открываться в ленте, профилях и share cards. Это нормально для текущего Antigram, но важно помнить:

- любые URL из public bucket можно открыть без авторизации;
- приватные/ограниченные фото в будущем нельзя хранить в таком же публичном режиме;
- если появится private/friends-only visibility, нужны signed URLs или отдельный private bucket.

### 4. Admin-флаги в публичном `profiles`

`profiles` публично читается, а `is_admin`, `is_banned`, `is_blocked` могут попадать клиенту при `select('*')`.

Это не критический взлом, но лучше перейти на public-safe view или явно выбирать поля профиля в клиенте, чтобы служебные флаги не были частью обычного публичного API.

## Что проверить в Supabase руками

1. Применены ли свежие миграции:
   - `202607050001_moment_image_variants.sql`
   - `202607050002_security_hardening_policies.sql`

2. Storage policies:

```sql
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
```

Ожидаем для `moments`: upload policy с проверкой `(storage.foldername(name))[1] = auth.uid()::text`.

3. Public tables and policies:

```sql
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

4. Не осталось ли таблиц без RLS:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

## Следующий security backlog

1. Собрать canonical Supabase migrations в одном месте.
2. Добавить public-safe profile view или убрать `select('*')` там, где не нужны служебные поля.
3. Проверить фактическую таблицу `comments` и добавить миграцию, если она создана вручную.
4. Подготовить privacy model на будущее: public / followers / private.
5. Добавить smoke-тесты RLS через Supabase local или SQL fixtures.
