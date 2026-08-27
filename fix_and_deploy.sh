#!/bin/bash
# ============================================================
# ANTIGRAM — доводка выкатки после сбоя миграций.
#
# Что случилось: Supabase не знал, что миграции с 202607060002
# по 202607070007 уже применены к базе, и попытался накатить их
# заново. Одна из них пересоздаёт вьюху public_profiles, а от неё
# зависят другие — поэтому push остановился.
#
# Объекты из этих миграций в базе проверены и присутствуют, так что
# здесь мы просто помечаем их как применённые и накатываем только
# два новых файла (premium_activation и admin_payment_refunds).
#
# Запускать из папки ANTIGRAM/telegram-webapp.
# Повторный запуск безопасен.
# ============================================================

set -e

PROJECT_REF="kwjjwmpcnukfxmwhjwed"
WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/telegram-stars-webhook"

# Секреты не дублируем — берём из deploy_stars.sh, который лежит рядом.
BOT_TOKEN=$(grep -m1 '^BOT_TOKEN=' deploy_stars.sh | cut -d'"' -f2)
WEBHOOK_SECRET=$(grep -m1 '^WEBHOOK_SECRET=' deploy_stars.sh | cut -d'"' -f2)

if [ -z "$BOT_TOKEN" ] || [ -z "$WEBHOOK_SECRET" ]; then
  echo "❌  Не нашёл BOT_TOKEN или WEBHOOK_SECRET в deploy_stars.sh"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ANTIGRAM — доводка выкатки                 ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Помечаем уже применённые миграции ─────────────────────
ALREADY_APPLIED="
202607060002
202607060003
202607060004
202607060005
202607060006
202607060007
202607060008
202607060009
202607060010
202607070001
202607070002
202607070003
202607070004
202607070005
202607070006
202607070007
"

echo "▶  Помечаю как применённые то, что уже есть в базе..."
for VERSION in $ALREADY_APPLIED; do
  echo "   • $VERSION"
  npx supabase migration repair --status applied "$VERSION" > /dev/null
done
echo "✅  История миграций приведена в порядок"

# ── 2. Накатываем только новое ───────────────────────────────
echo ""
echo "▶  Применяю новые миграции (premium + возвраты)..."
echo "   Спросит подтверждение — ответь Yes."
npx supabase db push

echo "✅  Миграции применены"

# ── 3. Edge Functions ────────────────────────────────────────
echo ""
echo "▶  Деплою create-star-invoice..."
npx supabase functions deploy create-star-invoice --no-verify-jwt

echo ""
echo "▶  Деплою telegram-stars-webhook..."
npx supabase functions deploy telegram-stars-webhook --no-verify-jwt

echo ""
echo "▶  Деплою admin-refund-payment..."
npx supabase functions deploy admin-refund-payment --no-verify-jwt

echo "✅  Функции задеплоены"

# ── 4. Telegram webhook ──────────────────────────────────────
echo ""
echo "▶  Настраиваю webhook у Telegram..."
RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"callback_query\", \"pre_checkout_query\"]
  }")

echo "$RESPONSE"

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅  Webhook настроен"
else
  echo "⚠️   Проверь ответ выше"
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Готово. Бэкенд выкачен.                    ║"
echo "║                                              ║"
echo "║   Дальше: git add -A && git commit && push   ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
