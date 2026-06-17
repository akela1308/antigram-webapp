# ANTIGRAM Telegram Mini App — Гайд по деплою

## 1. Деплой на Vercel

### 1.1 Подключить GitHub репозиторий
1. Открой [vercel.com](https://vercel.com) и войди в аккаунт
2. Нажми **"Add New... → Project"**
3. Найди репозиторий `antigram-webapp` (GitHub: `akela1308/antigram-webapp`)
4. Нажми **"Import"**

### 1.2 Настройка сборки
Vercel автоматически определит Vite. Убедись, что настройки такие:
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 1.3 Добавить переменные окружения
В разделе **"Environment Variables"** добавь:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://kwjjwmpcnukfxmwhjwed.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_J5ZbLQ1s7ExHzot7JzDXSg_cSLBuFzm` |

> ⚠️ `VITE_TELEGRAM_BOT_TOKEN` **НЕ добавляй** в Vercel — токен бота должен быть только в Supabase Edge Function как секрет.

### 1.4 Задеплоить
Нажми **"Deploy"**. Vercel выдаст URL вида `antigram-webapp.vercel.app`.

Запомни этот URL — он понадобится для BotFather.

---

## 2. Деплой Supabase Edge Function

### 2.1 Установить Supabase CLI (если не установлен)
```bash
brew install supabase/tap/supabase
```

### 2.2 Войти в Supabase
```bash
supabase login
```

### 2.3 Привязать проект
```bash
cd /path/to/antigram-webapp
supabase link --project-ref kwjjwmpcnukfxmwhjwed
```

### 2.4 Установить секреты для Edge Function
```bash
supabase secrets set BOT_TOKEN=8901424423:AAGuhd767jD5lYi1i1lH3RFX7VVP-fTkr0E
```

### 2.5 Задеплоить функцию
```bash
supabase functions deploy telegram-auth --no-verify-jwt
```

> Флаг `--no-verify-jwt` нужен, так как функция принимает запросы с anon key (не от аутентифицированного пользователя).

### 2.6 Проверить что функция работает
```bash
curl -X POST https://kwjjwmpcnukfxmwhjwed.supabase.co/functions/v1/telegram-auth \
  -H "Authorization: Bearer sb_publishable_J5ZbLQ1s7ExHzot7JzDXSg_cSLBuFzm" \
  -H "Content-Type: application/json" \
  -d '{"initData": "test"}'
```
Ожидаемый ответ: `{"error":"Invalid initData"}` — функция работает, просто initData не верный.

---

## 3. Регистрация Mini App в BotFather

### 3.1 Найти BotFather
Открой Telegram и найди [@BotFather](https://t.me/BotFather).

### 3.2 Создать Mini App
Отправь команду:
```
/newapp
```

BotFather спросит:
1. **Выбери бота** — выбери своего бота (созданного с токеном `8901424423:...`)
2. **Введи название приложения** — например: `Antigram`
3. **Введи описание** — например: `Реальные моменты, настоящие эмоции`
4. **Загрузи фото** — загрузи квадратное изображение 640×640px (иконка приложения)
5. **Загрузи GIF** (опционально) — можно пропустить, отправив `/empty`
6. **Введи URL** — вставь URL из Vercel: `https://antigram-webapp.vercel.app`

BotFather ответит ссылкой вида `https://t.me/ИмяБота/antigram`

### 3.3 Добавить кнопку Mini App в меню бота (опционально)
```
/setmenubutton
```
Выбери бота → введи URL приложения → введи текст кнопки, например: `Открыть Antigram`

---

## 4. Проверка что всё работает

1. Открой ссылку `https://t.me/ИмяБота/antigram` в Telegram на телефоне
2. Должно открыться приложение с лентой моментов
3. Авторизация происходит автоматически через Telegram — никакого логина не нужно
4. Нажми на любой момент — должен открыться детальный вид
5. Поставь реакцию — должна отображаться в счётчике

### Что проверить если не работает

| Симптом | Решение |
|---------|---------|
| Белый экран | Проверь переменные окружения в Vercel |
| Ошибка авторизации | Убедись что Edge Function задеплоена и BOT_TOKEN установлен |
| Нет данных в ленте | Проверь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY |
| Mini App не открывается | Убедись что URL в BotFather совпадает с Vercel URL |

---

## 5. Дополнительно

### Кастомный домен
В Vercel → Settings → Domains → добавь `app.antigram.ru` (или любой другой).
После этого обнови URL в BotFather через `/editapp`.

### Обновление приложения
После push в `main` ветку Vercel автоматически передеплоит приложение.

### Логи Edge Function
```bash
supabase functions logs telegram-auth
```
