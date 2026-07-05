# Antigram Product and Technical Deep Research Prompt

Use this prompt with ChatGPT Deep Research or another research-capable model. Attach or paste `ANTIGRAM_ARCHITECTURE_DEEP_DIVE.md` as the main context document.

---

## Prompt

Ты выступаешь как senior product strategist, technical architect, growth lead и исследователь consumer social apps. Мне нужно провести глубокое исследование и составить практический план развития Antigram.

Antigram - это Telegram-first социальная сеть про атмосферные фото, пленочную камеру, эмоции, реакции, настроение, уютную ностальгическую эстетику и casual social discovery. Это не просто клон Instagram. Продукт должен ощущаться как теплое, камерное, немного аналоговое приложение: пользователь загружает/делает момент, выбирает пленку, эмоцию/настроение, получает реакции, собирает профиль, альбомы, подписки и может поддерживать авторов через Telegram Stars. Важная идея: приложение должно быть приятным, вирусным, технически надежным и монетизируемым, но не агрессивным и не перегруженным.

К этому запросу приложен архитектурный документ `ANTIGRAM_ARCHITECTURE_DEEP_DIVE.md`. Сначала внимательно прочитай его и используй как обязательный технический контекст. Если в документе встречаются названия Fungram или Integram, считай их рабочими/разговорными alias текущего продукта Antigram, если отдельно не указано иное.

Текущий стек и ограничения:

- Telegram Mini App как основной runtime;
- Vite + React + TypeScript frontend;
- Supabase Auth/Postgres/Storage;
- Supabase Edge Functions для Telegram auth, Stars, webhook/onboarding, support;
- Telegram bot как входной и growth surface;
- Telegram Stars как один из возможных способов монетизации;
- продукт photo-first, не video-first;
- важен camera-first / film-first ритуал;
- важно учитывать ограничения Telegram WebView, Supabase, storage egress, RLS/security, image pipeline, feed ranking, moderation, notifications;
- приложение должно оставаться уютным, атмосферным и быстрым, не превращаться в тяжелый комбайн.

Дата исследования: июль 2026 года. Обязательно проверь актуальность трендов и фактов на момент исследования. Используй свежие источники, отраслевые отчеты, app store/product references, публичные разборы конкурентов, новости, документацию платформ и, где уместно, официальные источники. Для каждого важного факта или вывода указывай источники и дату/актуальность.

Главная цель: понять, как сделать Antigram одной из самых сильных и обсуждаемых новых социальных сетей в своей нише, сохранив уникальность: фото, пленка, настроение, эмоции, Telegram-native distribution, уютная casual атмосфера, понятная монетизация и хорошая техническая архитектура.

---

## Что нужно исследовать

### 1. Рынок и тренды social apps на июль 2026

Исследуй актуальные тренды в consumer social:

- что пользователи ожидают от новых соцсетей в 2026 году;
- какие форматы устали/перегреты, а какие снова растут;
- camera-first, authenticity, private social, cozy social, mood-based discovery, micro-communities, creator monetization, AI-assisted creation, gamification, streaks, rituals, collectibles;
- как меняется поведение Gen Z / young adults / Telegram-native аудитории;
- какие механики повышают retention без токсичного давления;
- какие новые продукты или фичи начали выделяться после BeReal, Lapse, Dispo, Poparazzi, Snapchat, Instagram, TikTok, Pinterest, Lemon8 и других визуальных/social apps;
- какие Telegram Mini Apps или bot-native products показывают сильный рост и почему.

Не ограничивайся очевидным "надо сделать сторис/реелс". Найди тренды, которые подходят именно Antigram.

### 2. Конкурентный анализ

Проанализируй конкурентов и близкие референсы:

- BeReal;
- Instagram;
- Snapchat;
- TikTok / Lemon8 / Pinterest как discovery references;
- Lapse, Dispo и другие analog/camera/photo-first apps;
- Telegram Mini Apps и bot-first social/gaming/utility apps;
- нишевые moodboard, aesthetic photo, casual social, private social приложения.

Для каждого важного конкурента опиши:

- core loop;
- onboarding;
- social graph;
- creation flow;
- discovery/feed;
- reactions/comments;
- retention mechanics;
- monetization;
- что у них получилось;
- что у них сломалось или стало слабым;
- что Antigram может взять, а что нельзя копировать.

### 3. Позиционирование Antigram

Сформулируй несколько возможных стратегий позиционирования:

- "analog camera inside Telegram";
- "mood-first photo social network";
- "cozy anti-Instagram";
- "film diary with friends";
- "visual emotional network";
- другие варианты, если найдешь лучше.

Для каждой стратегии оцени:

- кому это нужно;
- почему люди будут возвращаться;
- почему это может стать вирусным;
- как это отличается от Instagram/BeReal/Snapchat;
- какие фичи должны поддерживать именно это позиционирование;
- какие фичи будут вредить позиционированию.

В конце выбери 1-2 самые сильные стратегии и объясни почему.

### 4. Продуктовые фичи

Предложи сильные продуктовые фичи, которые подходят Antigram. Нужны не абстрактные идеи, а конкретные фичи с механикой, UX, технической реализацией, рисками и эффектом на метрики.

Раздели фичи на категории:

- camera / film ritual;
- feed and discovery;
- search / collections / mood discovery;
- profile identity;
- reactions and emotional feedback;
- albums / film strips / personal archive;
- social graph and following;
- notifications and retention;
- Telegram bot / Telegram-native growth;
- creator support and Stars;
- Premium / monetization;
- safety, privacy, moderation;
- AI features, но только если они реально усиливают продукт, а не превращают его в generic AI app.

Для каждой фичи дай:

- название;
- краткое описание;
- какой пользовательский инсайт или тренд она закрывает;
- почему она подходит именно Antigram;
- UX flow;
- нужные backend/frontend изменения;
- какие таблицы/индексы/Edge Functions/storage changes могут понадобиться;
- влияние на activation, retention, sharing, monetization;
- сложность внедрения;
- риски;
- MVP-версию;
- advanced-версию.

### 5. Техническая стратегия

На основе архитектурного документа предложи техническую дорожную карту улучшения Antigram.

Особенно важно исследовать и предложить решения для:

- image pipeline: thumbnails, responsive images, compression, cached egress reduction, old image backfill, storage organization;
- feed ranking: from random/simple feed to personalized ranking, cold start, diversity, freshness, social graph, emotion-based ranking;
- reactions: aggregation, deduplication, real-time or near-real-time updates, anti-spam, UX consistency;
- notifications: event model, unread counts, batching, relevance, Telegram bot notifications;
- Supabase architecture: RLS, policies, RPCs, Edge Functions, migrations, indexes;
- security: Telegram auth validation, webhook security, Stars/payment validation, secrets, abuse prevention, rate limiting;
- moderation: reports, hidden content, blocked users, NSFW/image moderation, admin tooling;
- observability: analytics events, PostHog funnels, logs, error tracking, product metrics;
- performance: bundle size, lazy loading, WebView constraints, low-end devices;
- data model evolution: users, moments, reactions, follows, albums, highlights, notifications, support, premium;
- offline/poor-network behavior inside Telegram;
- native mobile repo alignment if relevant.

Дай архитектурные варианты там, где есть выбор: простое MVP-решение, среднесрочное решение, масштабируемое решение. Не предлагай чрезмерно сложную инфраструктуру без причины.

### 6. Монетизация

Предложи монетизацию, которая не ломает уютный продукт:

- Telegram Stars creator support;
- Premium;
- paid films / rare films;
- profile customization;
- albums / archive features;
- advanced discovery;
- creator tools;
- seasonal drops;
- referrals;
- limited aesthetic items;
- возможные подписки.

Для каждой идеи оцени:

- willingness to pay;
- насколько это честно и приятно для пользователя;
- как не превратить продукт в paywall;
- какие технические изменения нужны;
- какие риски с Telegram, App Store/Google Play и вебом;
- какие метрики отслеживать.

### 7. Growth и вирусность

Сделай отдельный Telegram-native growth plan:

- как бот должен встречать пользователя;
- какие команды/кнопки/онбординг нужны;
- как приглашать друзей;
- как делиться моментами в Telegram;
- какие share cards делать;
- как использовать каналы/группы;
- какие механики могут стать вирусными без спама;
- какие notification loops уместны;
- какие referral mechanics можно внедрить.

Важно: рост не должен выглядеть как агрессивный спам. Он должен ощущаться естественно для Telegram.

### 8. Целевая аудитория и психология

Опиши основные user personas:

- кто будет любить Antigram;
- почему они будут снимать/публиковать;
- чего они устали видеть в Instagram/TikTok;
- какие эмоции продукт должен давать;
- какие барьеры могут мешать публикации;
- какие social anxieties нужно снять;
- какие моменты должны давать "вау".

Особенно важно понять аудиторию, которой нравится:

- пленочная/ретро-эстетика;
- камерность;
- Telegram;
- реакции и эмоции;
- визуальные дневники;
- настроение вместо показной идеальности.

### 9. Roadmap

Составь приоритизированный план внедрения.

Нужны горизонты:

- 0-2 недели: быстрые улучшения, которые дадут видимый эффект;
- 1-2 месяца: foundational product/technical work;
- 3-6 месяцев: сильные differentiating features;
- 6-12 месяцев: масштабирование, монетизация, growth loops.

Для каждого этапа дай:

- список фич;
- почему именно сейчас;
- ожидаемый эффект;
- технические зависимости;
- риски;
- effort estimate;
- какие метрики должны измениться.

Добавь таблицу приоритизации по методике RICE или Impact/Effort/Confidence.

### 10. Метрики

Предложи North Star Metric и набор product/technical metrics:

- activation;
- D1/D7/D30 retention;
- creation rate;
- reaction rate;
- follow rate;
- feed/session depth;
- share/invite rate;
- Stars conversion;
- Premium conversion;
- image egress per active user;
- upload success rate;
- time to first moment;
- notification open rate;
- report/moderation rate.

Опиши, какие события нужно трекать в PostHog и как строить funnels.

### 11. Что НЕ делать

Составь anti-roadmap:

- какие фичи не стоит делать сейчас;
- какие тренды вредны для Antigram;
- какие решения превратят продукт в generic Instagram clone;
- какие технические усложнения преждевременны;
- какие монетизационные идеи могут испортить доверие.

---

## Формат результата

Сделай итоговый отчет на русском языке.

Структура ответа:

1. Executive Summary
2. Key Market Trends as of July 2026
3. Competitive Landscape
4. Best Positioning for Antigram
5. User Personas and Jobs-To-Be-Done
6. Feature Opportunity Map
7. Technical Architecture Improvement Plan
8. Monetization Strategy
9. Telegram-Native Growth Plan
10. Safety, Trust, Moderation, Privacy
11. Metrics and Analytics Plan
12. Prioritized Roadmap
13. Anti-Roadmap
14. Open Questions / Assumptions
15. Source List

Обязательные требования к качеству:

- Не пиши общие советы уровня "улучшить UX" или "добавить AI".
- Каждая рекомендация должна быть привязана к Antigram, его стеку, аудитории и ограничениям.
- Отличай факты от гипотез.
- Указывай источники для рыночных фактов и трендов.
- Для технических решений объясняй trade-offs.
- Не предлагай фичу без MVP-версии.
- Не предлагай монетизацию, которая делает базовый опыт бедным.
- Не предлагай video-first pivot, если он не обоснован как отдельный experiment.
- Учитывай, что приложение должно оставаться быстрым внутри Telegram WebView.
- Учитывай текущую проблему Supabase cached egress и необходимость image optimization.
- Учитывай security/RLS/payment/webhook/moderation как важные зоны риска.

В конце дай:

- top 10 most important actions;
- top 10 highest-leverage product features;
- top 10 technical architecture tasks;
- 5 bold bets that could make Antigram truly talked-about;
- 5 boring but critical engineering tasks that must not be ignored.

