#!/bin/bash
# ============================================================
# ANTIGRAM Stars — backend deploy script
# Запускай из папки: ANTIGRAM/telegram-webapp/
# ============================================================

set -e

PROJECT_REF="kwjjwmpcnukfxmwhjwed"
BOT_TOKEN="8901424423:AAGuhd767jD5lYi1i1lH3RFX7VVP-fTkr0E"
WEBHOOK_SECRET="0783eea872f852d02abf4e0d2c9eead367e002cc6701df62cfcb32288e4351db"
WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/telegram-stars-webhook"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ANTIGRAM Stars — deploy                    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Personal Access Token ─────────────────────────────────
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "🔑  Вставь Supabase Personal Access Token (dashboard.supabase.com/account/tokens):"
  read -r -s SUPABASE_ACCESS_TOKEN
  echo ""
fi

# ── 2. Авторизация ───────────────────────────────────────────
echo "▶  Авторизация в Supabase CLI..."
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"

# ── 3. Линковка проекта ──────────────────────────────────────
echo ""
echo "▶  Линковка с проектом ${PROJECT_REF}..."
npx supabase link --project-ref "$PROJECT_REF"

# ── 4. Миграция БД ───────────────────────────────────────────
echo ""
echo "▶  Применяю миграцию star_support..."
npx supabase db push --include-all

echo "✅  Миграция применена"

# ── 5. Секреты ───────────────────────────────────────────────
echo ""
echo "▶  Устанавливаю секреты Edge Functions..."
npx supabase secrets set \
  BOT_TOKEN="$BOT_TOKEN" \
  TELEGRAM_WEBHOOK_SECRET="$WEBHOOK_SECRET"

echo "✅  Секреты установлены"

# ── 6. Deploy Edge Functions ─────────────────────────────────
echo ""
echo "▶  Деплою create-star-invoice..."
npx supabase functions deploy create-star-invoice --no-verify-jwt

echo ""
echo "▶  Деплою telegram-stars-webhook..."
npx supabase functions deploy telegram-stars-webhook --no-verify-jwt

echo "✅  Edge Functions задеплоены"

# ── 7. Telegram webhook ──────────────────────────────────────
echo ""
echo "▶  Устанавливаю Telegram webhook..."
RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"pre_checkout_query\"]
  }")

echo "$RESPONSE"

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅  Telegram webhook установлен: $WEBHOOK_URL"
else
  echo "⚠️   Проверь ответ выше — что-то пошло не так с webhook"
fi

# ── 8. Проверка ──────────────────────────────────────────────
echo ""
echo "▶  Проверяю webhook..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool 2>/dev/null || \
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Готово! Всё задеплоено.                    ║"
echo "║                                              ║"
echo "║   Следующий шаг: протестировать Stars        ║"
echo "║   в мини-аппе (открой кадр → тапни ☆)       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
