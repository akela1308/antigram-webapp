# Antigram Security / RLS Audit

Дата: 2026-07-05

Обновление: 2026-07-06

## Цель

P0-аудит Supabase-политик перед ростом приложения: проверить, кто может читать фото, редактировать данные, видеть уведомления, админить moderation/support и работать с платежными таблицами.

## Что проверено

### Public content

- `profiles` публично читаются. Это ожидаемо для социальной сети: профиль, username, имя, аватар, счетчики.
- `moments` публично читаются через privacy model `visibility = public`; после moderation-миграции публичная выдача скрывает посты забаненных авторов для всех, кроме автора и админов.
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

Она делает четыре вещи:

1. Закрывает storage upload gap для bucket `moments`.
   Раньше любой авторизованный пользователь мог загрузить файл в `moments` под любым путем. Теперь upload разрешен только в папку, где первый сегмент пути равен `auth.uid()`.

2. Добавляет `WITH CHECK` к update-политикам `profiles` и `moments`.
   Это защищает от сценария, где пользователь обновляет свою строку, но пытается поменять owner-поле или стать владельцем чужих данных.

3. Усиливает update-политики для `highlights`, `albums`, `reports`, если эти таблицы существуют в окружении.

4. Закрывает storage cleanup gap: после удаления кадра клиент может удалить storage-файлы кадра, но только если это папка текущего пользователя или действие выполняет админ.

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

2026-07-06: добавлена canonical migration `202607060003_comments_canonical_rls.sql`. Она idempotent и безопасна для продовой таблицы, если она уже была создана вручную:

- создаёт `public.comments`, если таблицы нет;
- добавляет базовые колонки, индексы и ограничения на непустой текст до 1000 символов;
- включает RLS;
- читать можно комментарии к публичным моментам, владельцу момента и админу;
- создавать может только авторизованный пользователь от своего `auth.uid()` к публичному моменту;
- update/delete разрешены автору комментария или админу;
- если `notify_on_comment()` уже есть в базе, миграция подключает trigger `on_comment_notify`.

### 3. Публичный bucket `moments`

Bucket публичный по продуктовой логике: фото должны открываться в ленте, профилях и share cards. Это нормально для текущего Antigram, но важно помнить:

- любые URL из public bucket можно открыть без авторизации;
- приватные/ограниченные фото в будущем нельзя хранить в таком же публичном режиме;
- если появится private/friends-only visibility, нужны signed URLs или отдельный private bucket.

2026-07-06: добавлена migration `202607060004_moment_visibility_foundation.sql`.

- `moments.visibility` готовит модель `public / followers / private`;
- текущий UX продолжает публиковать `public`;
- `is_public` синхронизируется trigger'ом с `visibility = 'public'`, чтобы старый код не сломался;
- RLS `moments` переведён на visibility-aware политики;
- добавлена SQL-функция `can_view_moment(owner_id, visibility)`, привязанная к `auth.uid()`, для будущих RPC/view;
- comments insert/read обновлены под новую модель видимости.

### 4. Admin-флаги в публичном `profiles`

`profiles` публично читается, а `is_admin`, `is_banned`, `is_blocked` могут попадать клиенту при `select('*')`.

Это не критический взлом, но лучше перейти на public-safe view или явно выбирать поля профиля в клиенте, чтобы служебные флаги не были частью обычного публичного API.

2026-07-06: исправлено на клиенте. Массовые публичные join/list-запросы в `src/lib/db.ts` и `src/lib/support.ts` переведены на явный public-safe набор полей:

```text
id, username, display_name, bio, avatar_url, website, created_at
```

`getProfile(userId)` разделён на `getOwnProfile()` и `getPublicProfile()`: полный `select('*')` остался только для профиля текущего пользователя в `AuthContext`, а чужой `ProfilePage` грузит public-safe поля.

2026-07-06: добавлена миграция `202607060002_public_profiles_view.sql` с `public.public_profiles` view. Прямые публичные чтения профилей в клиенте переведены на этот view:

- чужой `ProfilePage`;
- поиск пользователей;
- списки followers/following;
- профили авторов комментариев.

В коде оставлен fallback на `profiles` с явным public-safe набором полей, чтобы прод не сломался, если Vercel задеплоится раньше ручного применения миграции.

2026-07-06: добавлена миграция `202607060005_public_moments_view.sql` с `public.public_moments` view. Основные публичные moment-запросы клиента переведены на этот слой с fallback:

- поиск моментов;
- following feed;
- random/for-you feed;
- подборки по эмоциям;
- публичный moment detail.

2026-07-06: добавлена миграция `202607060006_my_saved_moments_view.sql` с `public.my_saved_moments` view. Экран сохранённых моментов переведён на этот owner-only слой с fallback. View не выдаётся `anon`, опирается на RLS `saved_moments`, но возвращает момент и public-safe профиль в плоской структуре.

2026-07-06: добавлена миграция `202607060007_album_moments_view.sql` с `public.album_moment_details` view. Чтение превью альбомов и деталей альбома переведено на этот слой с fallback. View возвращает только поля момента и не делает profile join.

2026-07-06: добавлена миграция `202607060008_my_notifications_view.sql` с `public.my_notifications` view. Экран уведомлений переведён на owner-only слой с fallback. View не выдаётся `anon`, возвращает safe-поля actor profile и минимальное превью момента.

2026-07-06: добавлена миграция `202607060009_highlight_moments_view.sql` с `public.highlight_moment_details` view. Верхняя плёнка профиля (`highlights`) переведена на safe view с fallback. View возвращает только highlight-row и минимальное превью момента.

2026-07-06: добавлена миграция `202607060010_admin_moderation_reports_view.sql` с `public.admin_moderation_reports` view. Очередь модерации переведена на admin-only safe view с fallback. View опирается на RLS `reports`, не выдаётся `anon` и не возвращает raw service-флаги профилей.

2026-07-07: добавлена миграция `202607070003_star_service_role_grants.sql`. Она явно выдаёт `service_role` минимальные права для Stars Edge Functions: создание invoice rows, запись webhook ledger, завершение платежа через `complete_star_payment`, обновление totals и чтение reconciliation view. `star_payment_reconciliation` явно закрыта от `anon` и `authenticated`.

2026-07-07: добавлена миграция `202607070004_mark_my_notifications_read_rpc.sql`. Клиентский mark-read переведён на RPC `mark_my_notifications_read()`, где пользователь берётся из `auth.uid()`, а не из параметра `userId` с клиента. Старый прямой update оставлен только как fallback до применения миграции.

2026-07-07: добавлена миграция `202607070005_search_public_moments_rpc.sql`. Поиск моментов получает narrow RPC `search_public_moments(query, limit)`, который возвращает только `public_moments` safe surface, ранжирует совпадения по caption/mood/custom mood/author и ограничивает limit. Клиент использует RPC первым путём и оставляет старый `public_moments` query как fallback до применения миграции.

2026-07-07: добавлена миграция `202607070006_referral_attribution.sql`. Появились `profiles.referral_code`, приватная таблица `referrals`, service-role RPC `record_referral_open(...)` и owner-only RPC `mark_my_referral_first_post()`. Telegram share-ссылки на моменты теперь могут добавлять `ref_...` в `startapp`, а `telegram-auth` записывает first-touch attribution при входе.

Остаточный риск: отдельные admin actions всё ещё пишут напрямую в `profiles`, `moments`, `reports` и `admin_audit_log`, но чтение очереди модерации больше не собирается через клиентские FK-joins.

### 5. Client-writable `account_identities`

Миграция `202607050008_account_identities.sql` разрешала владельцу напрямую `insert/update` любых identity rows для своего `user_id`.

Риск: пользовательский клиент мог бы создать себе `provider = 'google' | 'apple' | 'telegram'` с произвольным `external_id`, если будущий код начнет доверять этой таблице как верифицированному identity source.

Исправлено миграцией:

`supabase/migrations/202607060001_account_identity_write_hardening.sql`

Теперь клиентская запись разрешена только для собственного `provider = 'email'`, где `external_id` совпадает с email из JWT и не является внутренним `@antigram.internal`. Telegram/Google/Apple identities должны создаваться только через trusted Edge Functions / service role.

## Что проверить в Supabase руками

1. Применены ли свежие миграции:
   - `202607050001_moment_image_variants.sql`
   - `202607050002_security_hardening_policies.sql`
   - `202607060001_account_identity_write_hardening.sql`

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
2. Сделано 2026-07-06: `getOwnProfile()` и `getPublicProfile()` разделены, чужие профили в клиенте больше не грузятся через `select('*')`.
3. Сделано 2026-07-06: добавлен `public_profiles` view, прямые публичные profile reads переведены на него.
4. Сделано 2026-07-06: добавлена canonical comments migration/RLS.
5. Сделано 2026-07-06: добавлен foundation для privacy model `public / followers / private`.
6. Сделано 2026-07-06: добавлен `public_moments` view, публичные ленты/поиск/подборки переведены на него.
7. Сделано 2026-07-06: добавлен `my_saved_moments` view, сохранёнки переведены на owner-only safe view.
8. Сделано 2026-07-06: добавлен `album_moment_details` view, альбомные moment reads переведены на safe view.
9. Сделано 2026-07-06: добавлен `my_notifications` view, уведомления переведены на owner-only safe view.
10. Сделано 2026-07-06: добавлен `highlight_moment_details` view, профильная плёнка переведена на safe view.
11. Сделано 2026-07-06: добавлен `admin_moderation_reports` view, очередь модерации переведена на admin safe view.
12. Сделано 2026-07-06: добавлен `SUPABASE_SECURITY_SMOKE_TESTS.sql` для ручной проверки ключевых RLS/schema гарантий в Supabase.
13. Добавить автоматические smoke-тесты RLS через Supabase local или SQL fixtures.
14. Сделано 2026-07-07: добавлены smoke checks для Stars ledger/function/charge uniqueness/service_role grants.
15. Сделано 2026-07-07: добавлен owner-only RPC для mark notifications read.
16. Сделано 2026-07-07: добавлен public-safe RPC `search_public_moments` и smoke checks для Search V1.
17. Сделано 2026-07-07: добавлен foundation для Telegram referral attribution.
