import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

const sectionStyle: React.CSSProperties = { marginTop: 20 }
const headingStyle: React.CSSProperties = { fontSize: 16, margin: '0 0 8px', color: 'var(--text)' }
const textStyle: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }
const listStyle: React.CSSProperties = { ...textStyle, paddingLeft: 18, marginTop: 6 }

export function TermsPage() {
  const { language, t } = useLanguage()
  const isRu = language === 'ru'

  return (
    <div style={{ padding: '20px 16px 110px', maxWidth: 600, margin: '0 auto', color: 'var(--text)', paddingTop: 'var(--tg-top, 56px)' }}>
      <Link to="/me" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
        ← {t('common.back')}
      </Link>

      <h1 style={{ fontSize: 20, margin: '16px 0 8px', color: 'var(--amber)' }}>
        {isRu ? 'Условия Antigram' : 'Antigram Terms'}
      </h1>
      <p style={textStyle}>
        {isRu
          ? 'Эти условия описывают использование Antigram, публикацию фотографий и будущую механику поддержки авторов через Telegram Stars. Последнее обновление: 28 июня 2026.'
          : 'These terms describe the use of Antigram, photo publishing, and the future creator support mechanics through Telegram Stars. Last updated: June 28, 2026.'}
      </p>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '1. Что такое Antigram' : '1. What Antigram Is'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Antigram — социальное приложение для публикации фотографий, реакций, альбомов и творческого статуса. Пользователь сам отвечает за фотографии, подписи и другие материалы, которые публикует.'
            : 'Antigram is a social app for publishing photos, reactions, albums, and creative status. Users are responsible for the photos, captions, and other materials they publish.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '2. Публикации и лимиты' : '2. Publishing and Limits'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Мы можем вводить лимиты на публикацию кадров, хранение альбомов, продвижение и другие функции. Лимиты могут зависеть от версии продукта, статуса аккаунта, правил модерации и внутренних бонусов. Если лимит влияет на оплату или платную функцию, мы покажем это до покупки.'
            : 'We may apply limits to frame publishing, album storage, promotion, and other features. Limits may depend on the product version, account status, moderation rules, and internal bonuses. If a limit affects a paid feature, we will show it before purchase.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '3. Stars под фотографиями' : '3. Stars Under Photos'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Stars под фотографией — добровольная платная поддержка, реакция и сигнал признания автора внутри Antigram. Они могут отображаться публично рядом с фотографией и в профиле автора как часть рейтинга или статуса.'
            : 'Stars under a photo are voluntary paid support, a reaction, and a recognition signal for the author inside Antigram. They may be shown publicly near the photo and in the author profile as part of rating or status.'}
        </p>
        <ul style={listStyle}>
          <li>{isRu ? 'Stars не являются банковским счётом, вкладом, инвестицией, ценной бумагой или гарантированным доходом.' : 'Stars are not a bank account, deposit, investment, security, or guaranteed income.'}</li>
          <li>{isRu ? 'Stars, отправленные через Antigram, сначала поступают на баланс бота/приложения в Telegram.' : 'Stars sent through Antigram first arrive on the Telegram bot/app balance.'}</li>
          <li>{isRu ? 'Внутренний счётчик Stars автора показывает поддержку, полученную в Antigram, но сам по себе не гарантирует выплату.' : 'The internal author Stars counter shows support received in Antigram, but does not by itself guarantee a payout.'}</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '4. Возможные бонусы и выплаты' : '4. Possible Bonuses and Payouts'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'В будущем Antigram может запускать внутренние бонусы для авторов: бейджи, дополнительный лимит кадров, premium-доступ, продвижение, участие в подборках или программу ручных выплат. Такие возможности не считаются обещанными до их официального запуска и могут иметь отдельные условия.'
            : 'In the future, Antigram may launch internal creator bonuses: badges, extra frame limits, premium access, promotion, collection placement, or a manual payout program. These features are not promised until officially launched and may have separate terms.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '5. Комиссия' : '5. Commission'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Если Antigram запустит программу выплат авторам, приложение может удерживать сервисную комиссию. Размер комиссии и правила расчёта будут показаны до участия в программе выплат. Для продуктового планирования ориентиром может быть комиссия около 20%, но окончательные условия будут опубликованы отдельно.'
            : 'If Antigram launches a creator payout program, the app may retain a service commission. The commission amount and calculation rules will be shown before participation. A 20% commission may be used for product planning, but final terms will be published separately.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '6. Оплаты и возвраты' : '6. Payments and Refunds'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Цифровые покупки внутри Telegram выполняются через Telegram Stars. Возвраты рассматриваются через поддержку Antigram и технические инструменты Telegram, если возврат применим. Мы не храним данные банковских карт и не обрабатываем внешние платёжные реквизиты.'
            : 'Digital purchases inside Telegram are processed through Telegram Stars. Refunds are reviewed through Antigram support and Telegram technical tools where applicable. We do not store bank card data or process external payment credentials.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '7. Модерация' : '7. Moderation'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Мы можем скрывать, ограничивать или удалять материалы, которые нарушают правила сообщества, права других людей, закон или правила Telegram. Платная поддержка Stars не защищает публикацию от модерации.'
            : 'We may hide, restrict, or remove materials that violate community rules, other people’s rights, law, or Telegram rules. Paid Stars support does not protect a post from moderation.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '8. Поддержка' : '8. Support'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'По вопросам платежей, Stars, удаления аккаунта и модерации напишите в поддержку: support@antigram.app.'
            : 'For payments, Stars, account deletion, and moderation questions, contact support: support@antigram.app.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? '9. Политика конфиденциальности' : '9. Privacy Policy'}</h2>
        <p style={textStyle}>
          {isRu ? 'То, какие данные мы собираем и как их используем, описано отдельно: ' : 'What data we collect and how we use it is described separately: '}
          <Link to="/privacy" style={{ color: 'var(--amber)' }}>
            {isRu ? 'Политика конфиденциальности' : 'Privacy Policy'}
          </Link>.
        </p>
      </section>
    </div>
  )
}
