#!/bin/bash
# ============================================================
# ANTIGRAM — обновить токен бота и настроить webhook.
#
# Токен, записанный в deploy_stars.sh, Telegram больше не принимает
# (отвечает 401 Unauthorized) — судя по всему, его перевыпускали
# в BotFather, а в файл новый не попал.
#
# Скрипт спросит актуальный токен, проверит его, пропишет в Supabase
# и в deploy_stars.sh, и настроит webhook.
#
# Запускать из папки ANTIGRAM/telegram-webapp.
# ============================================================

set -e

PROJECT_REF="kwjjwmpcnukfxmwhjwed"
WEBHOOK_URL="https://${PROJECT_REF}.supabase.co/functions/v1/telegram-stars-webhook"
WEBHOOK_SECRET=$(grep -m1 '^WEBHOOK_SECRET=' deploy_stars.sh | cut -d'"' -f2)

if [ -z "$WEBHOOK_SECRET" ]; then
  echo "❌  Не нашёл WEBHOOK_SECRET в deploy_stars.sh"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   ANTIGRAM — токен бота и webhook            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Где взять токен: в Telegram напиши @BotFather → /mybots →"
echo "выбери @antigramapp_bot → API Token → скопируй строку."
echo ""
echo "🔑  Вставь токен бота (на экране ничего не появится — так надо):"
read -r -s BOT_TOKEN
echo ""

if [ -z "$BOT_TOKEN" ]; then
  echo "❌  Пусто. Запусти скрипт ещё раз."
  exit 1
fi

# ── 1. Проверяем токен ───────────────────────────────────────
echo "▶  Проверяю токен у Telegram..."
ME=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe")

if ! echo "$ME" | grep -q '"ok":true'; then
  echo ""
  echo "❌  Telegram не принял этот токен:"
  echo "$ME"
  echo ""
  echo "Проверь, что скопировал строку целиком, без пробелов по краям."
  exit 1
fi

BOT_NAME=$(echo "$ME" | sed -n 's/.*"username":"\([^"]*\)".*/\1/p')
echo "✅  Токен рабочий, бот: @${BOT_NAME}"

if [ "$BOT_NAME" != "antigramapp_bot" ]; then
  echo ""
  echo "⚠️   Ожидался @antigramapp_bot, а это @${BOT_NAME}."
  echo "    Если это правильный бот — просто продолжай."
  echo "    Если нет — нажми Ctrl+C и возьми токен нужного бота."
  echo ""
  printf "Продолжить? (y/n) "
  read -r ANSWER
  [ "$ANSWER" = "y" ] || exit 1
fi

# ── 2. Кладём токен в Supabase ───────────────────────────────
echo ""
echo "▶  Прописываю токен в Supabase..."
npx supabase secrets set BOT_TOKEN="$BOT_TOKEN" TELEGRAM_WEBHOOK_SECRET="$WEBHOOK_SECRET" > /dev/null
echo "✅  Секреты обновлены"

# ── 3. Обновляем deploy_stars.sh, чтобы не спотыкаться впредь ─
python3 - "$BOT_TOKEN" <<'PY'
import re, sys
token = sys.argv[1]
path = 'deploy_stars.sh'
src = open(path, encoding='utf-8').read()
new = re.sub(r'^BOT_TOKEN="[^"]*"', 'BOT_TOKEN="%s"' % token, src, count=1, flags=re.M)
if new != src:
    open(path, 'w', encoding='utf-8').write(new)
    print("✅  Актуальный токен записан в deploy_stars.sh")
else:
    print("⚠️   Не смог обновить deploy_stars.sh — впиши токен туда вручную")
PY

# ── 4. Webhook ───────────────────────────────────────────────
echo ""
echo "▶  Настраиваю webhook..."
RESPONSE=$(curl -s -X POST \
  "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"secret_token\": \"${WEBHOOK_SECRET}\",
    \"allowed_updates\": [\"message\", \"callback_query\", \"pre_checkout_query\"]
  }")

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅  Webhook настроен"
else
  echo "❌  Не получилось:"
  echo "$RESPONSE"
  exit 1
fi

# ── 5. Показываем итог ───────────────────────────────────────
echo ""
echo "▶  Текущее состояние webhook:"
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" \
  | python3 -m json.tool 2>/dev/null || curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Готово. Бэкенд полностью настроен.         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
