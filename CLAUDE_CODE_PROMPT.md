# ANTIGRAM Telegram Mini App — Claude Code Fix Session

## Контекст проекта

Telegram Mini App на React + Vite + TypeScript + TailwindCSS.
Расположение кода: `/Users/maksimilin/Desktop/ANTIGRAM/telegram-webapp/`
Деплой: Vercel (auto-deploy из git main). URL регистрируется в BotFather.

Supabase проект: `https://kwjjwmpcnukfxmwhjwed.supabase.co`

---

## ПРОБЛЕМЫ КОТОРЫЕ НУЖНО ИСПРАВИТЬ

Проверено на Google Pixel 9a (Android, без вырезки). Приоритеты — P0 блокируют использование.

---

### P0-1: Приложение не разворачивается в полный экран при открытии через кнопку внизу чата

**Файл:** `src/main.tsx`

**Причина:** В функции `initTelegram()` стоит проверка:
```javascript
if (!tg || !tg.initData) {
  // return — expand() НЕ вызывается
  return
}
tg.expand?.()
```

`tg.initData` может быть пустой строкой `""` при открытии через кнопку клавиатуры/меню бота. Пустая строка — falsy в JS, поэтому `!tg.initData === true`, и функция уходит в return **до** вызова `expand()`. Результат: приложение остаётся в компактном (полуэкранном) режиме с огромной шапкой Telegram сверху.

**Фикс:**
1. Разделить логику: вызов `expand()`, `ready()`, `setHeaderColor()`, `setBackgroundColor()` должны выполняться ВСЕГДА при наличии объекта `tg`, независимо от `initData`.
2. Проверку `initData` использовать только для решения — применять ли safe area инсеты или нет (в браузере без Telegram — нет, в Telegram — да).
3. Правильный способ определить что мы внутри Telegram: `tg.platform !== undefined && tg.platform !== ''`, а не проверка `initData`.

Реализация:
```typescript
function initTelegram() {
  const tg = getTgWebApp()
  if (!tg) {
    document.documentElement.style.setProperty('--tg-top', '0px')
    document.documentElement.style.setProperty('--tg-bottom', '0px')
    return
  }

  // Эти вызовы должны быть БЕЗУСЛОВНЫМИ — всегда при наличии tg
  tg.setHeaderColor?.('#140E0A')
  tg.setBackgroundColor?.('#140E0A')
  tg.expand?.()

  // Safe area — только если реально в Telegram (не в браузере)
  // В браузере telegram-web-app.js создаёт tg объект но platform = 'unknown' или ''
  const isInsideTelegram = tg.platform && tg.platform !== 'unknown'
  if (!isInsideTelegram) {
    document.documentElement.style.setProperty('--tg-top', '0px')
    document.documentElement.style.setProperty('--tg-bottom', '0px')
    tg.ready?.()
    return
  }

  applyTelegramSafeArea(tg)

  tg.onEvent?.('contentSafeAreaChanged', () => applyTelegramSafeArea(tg))
  tg.onEvent?.('safeAreaChanged', () => applyTelegramSafeArea(tg))

  tg.ready?.()
}
```

---

### P0-2: Пленка (`CategoryFilmStrip`) слишком низко на Pixel 9a — неправильный `--tg-top`

**Файл:** `src/main.tsx`, функция `applyTelegramSafeArea`

**Причина:** Текущий fallback для случая когда ни `contentSafeAreaInset`, ни `safeAreaInset` недоступны:
```javascript
topValue = 'max(calc(env(safe-area-inset-top, 44px) + 54px), 94px)'
```

На Android (Pixel 9a): нет вырезки, `env(safe-area-inset-top)` = 0, `44px` — default fallback.
Формула даёт: `max(calc(44px + 54px), 94px)` = `max(98px, 94px)` = **98px**.

Это слишком много — шапка Telegram на Android занимает около **48-56px** (нет физической вырезки). Из-за этого контент начинается на 98px от верха вместо 56px, и пленка визуально "провалена" вниз.

**Фикс функции `applyTelegramSafeArea`:**
```typescript
function applyTelegramSafeArea(tg: TgWebApp) {
  let topValue: string

  const contentTop = tg.contentSafeAreaInset?.top ?? 0
  const deviceTop = tg.safeAreaInset?.top ?? 0

  if (contentTop > 0) {
    // Bot API 8.0+ / Telegram 11+: contentSafeAreaInset учитывает ВСЁ
    // (и нативный notch устройства, и шапку самого Telegram)
    topValue = `${contentTop}px`
  } else if (deviceTop > 0) {
    // Bot API 7.10+: safeAreaInset = только нативный notch устройства.
    // Добавляем 56px — стандартная высота шапки Telegram mini app.
    topValue = `${deviceTop + 56}px`
  } else {
    // Старые клиенты без API safe area.
    // Определяем платформу для правильного фолбека.
    const platform = tg.platform ?? ''
    if (platform === 'ios' || platform === 'macos') {
      // iOS: есть notch/Dynamic Island, env() работает
      topValue = `max(calc(env(safe-area-inset-top, 0px) + 56px), 96px)`
    } else if (platform === 'android' || platform === 'android_x') {
      // Android: нет env() safe area, только шапка Telegram
      topValue = '56px'
    } else {
      // desktop/tdesktop/weba — без шапки или она не мешает
      topValue = '0px'
    }
  }

  document.documentElement.style.setProperty('--tg-top', topValue)

  // Bottom safe area
  const contentBottom = tg.contentSafeAreaInset?.bottom ?? 0
  const deviceBottom = tg.safeAreaInset?.bottom ?? 0
  const bottomValue = Math.max(contentBottom, deviceBottom)
  document.documentElement.style.setProperty(
    '--tg-bottom',
    bottomValue > 0 ? `${bottomValue}px` : (platform === 'ios' ? 'env(safe-area-inset-bottom, 20px)' : '0px'),
  )
}
```

Также в TgWebApp интерфейс добавить поле `platform`:
```typescript
type TgWebApp = {
  // ... existing fields ...
  platform?: string
}
```

---

### P0-3: `UploadPage.tsx` — неверный insert в Supabase

**Файл:** `src/pages/UploadPage.tsx`, функция `publish()`

**Причина:** Текущий код:
```javascript
const { error: insErr } = await supabase.from('moments').insert({
  user_id:  user.id,
  photo_url: publicUrl,
  caption:   caption.trim() || null,
  mood:      mood ?? null,
  is_public: true,  // ← ОШИБКА: такого поля нет в схеме
})
```

В БД у таблицы `moments` поле называется `visibility` (значения: `'public'`, `'followers'`, `'private'`), а не `is_public`. Из-за этого публикация завершается с ошибкой.

**Фикс:**
```javascript
const { error: insErr } = await supabase.from('moments').insert({
  user_id:   user.id,
  photo_url: publicUrl,
  caption:   caption.trim() || null,
  mood:      mood ?? null,
  visibility: 'public',
})
```

---

### P1-1: Нижний навбар — проверить и убедиться в правильном виде

**Файл:** `src/components/BottomNav.tsx`

Dispatch обновил файл до 5 вкладок с кнопкой `[A]`. Проверь что текущий код файла содержит **именно это**:

1. 5 вкладок: `Лента (/)`  →  `Подборки (/search)`  →  `[A] FAB (/upload)`  →  `Уведомления (/notifications)`  →  `Я (/me)`
2. Центральная кнопка [A]:
   - Выступает над баром (отрицательный `marginTop` или `top: -12px`)
   - Внешний круг: `background: '#2E1A0A'`, `width: 56, height: 56`
   - Внутренний круг: `background: '#C4A882'`, `width: 44, height: 44`
   - Текст `[A]`: `fontFamily: "'JetBrains Mono', monospace"`, `fontSize: 15`, `fontWeight: 700`, `color: '#1A0F05'`
   - НЕ SVG иконка камеры
3. Бар: `height: 85px`, `paddingBottom: max(20px, env(safe-area-inset-bottom, 20px))`
4. Активный цвет: `#C9843E`, неактивный: `#8A6A50` с `opacity: 0.5`

Если текущий код уже соответствует — не трогай. Если нет — приведи к этому виду.

Убедись что в `App.tsx` есть роуты:
- `/search` → `<SearchPage />`
- `/notifications` → `<NotificationsPage />`

---

### P1-2: Страницы SearchPage и NotificationsPage должны существовать

**Файлы:** `src/pages/SearchPage.tsx`, `src/pages/NotificationsPage.tsx`

Если файлы уже есть — проверь что они рендерятся без ошибок и используют `paddingTop: 'var(--tg-top, 0px)'` в корневом div.

Если файлов нет — создай:

**SearchPage.tsx** — минимальный MVP: sticky шапка с input (placeholder "Поиск..."), пустое состояние с текстом "Начни вводить имя пользователя". Стиль: тёмный фон `var(--bg)`, цвета из `index.css`.

**NotificationsPage.tsx** — минимальный MVP: sticky шапка "Уведомления", пустое состояние с иконкой 🔔 и текстом "Пока нет уведомлений — когда кто-то подпишется или отреагирует, появится здесь".

---

### P1-3: Все страницы должны использовать `--tg-top` для отступа шапки

**Файлы:** все страницы в `src/pages/`

Пройди по каждому файлу в `src/pages/`. В корневом div каждой страницы должно быть:
```jsx
<div style={{ paddingTop: 'var(--tg-top, 0px)', ... }}>
```

А sticky заголовок (если есть) должен иметь:
```jsx
<div className="sticky z-40" style={{ top: 'var(--tg-top, 0px)', ... }}>
```

Проверь: `FeedPage`, `MomentPage`, `MyProfilePage`, `ProfilePage`, `AuthPage`, `ExplorePage`.

---

## ТЕХНИЧЕСКИЕ ОГРАНИЧЕНИЯ

- Используй ТОЛЬКО библиотеки уже в `package.json`. Не добавляй новые зависимости.
- Не трогай `src/lib/supabase.ts`, `src/contexts/AuthContext.tsx` — они работают.
- Не трогай роутинг в `App.tsx` кроме добавления новых роутов.
- Не удаляй существующие компоненты.
- TypeScript: нет `any` типов (кроме случаев где `window` нужно кастовать).

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

1. Прочитай `src/main.tsx` полностью перед правкой
2. Исправь P0-1 (expand)
3. Исправь P0-2 (--tg-top формула)
4. Исправь P0-3 (UploadPage insert)
5. Проверь/исправь P1-1 (BottomNav)
6. Создай/проверь P1-2 (SearchPage, NotificationsPage)
7. Пройдись по P1-3 (все страницы — tg-top отступ)
8. `npm run build` — убедись что 0 ошибок TypeScript
9. Сообщи список изменённых файлов

---

## КРИТЕРИИ УСПЕХА

После исправлений в Telegram на Android (Pixel 9a):
- [ ] При открытии через кнопку внизу чата — приложение разворачивается в полный экран
- [ ] Пленка с фильтрами видна сразу под нативными кнопками Telegram, без лишнего пустого пространства
- [ ] Кнопки Telegram (Закрыть, свернуть, ⋯) не перекрывают контент нашего приложения
- [ ] Нижний навбар: 5 вкладок, центральная кнопка `[A]` в стиле мобильного приложения
- [ ] Публикация фото через кнопку `[A]` не выдаёт ошибку БД
- [ ] `npm run build` проходит без ошибок

---

## СПРАВКА: КАК ПРОВЕРИТЬ РЕЗУЛЬТАТ

После `npm run build` задеплой на Vercel или используй `npm run preview` локально.
В Telegram открой бота и нажми кнопку открытия мини-аппа — проверь разворачивание.
Если нужен быстрый тест без деплоя — открой `dist/index.html` через ngrok и вбей URL в BotFather.
