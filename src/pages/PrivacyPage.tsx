import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'

const sectionStyle: React.CSSProperties = { marginTop: 20 }
const headingStyle: React.CSSProperties = { fontSize: 16, margin: '0 0 8px', color: 'var(--text)' }
const textStyle: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }

export function PrivacyPage() {
  const { language, t } = useLanguage()
  const isRu = language === 'ru'

  return (
    <div style={{ padding: '20px 16px 110px', maxWidth: 600, margin: '0 auto', color: 'var(--text, #fff)', paddingTop: 'var(--tg-top, 56px)' }}>
      <Link to="/me" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
        ← {t('common.back')}
      </Link>

      <h1 style={{ fontSize: 20, margin: '16px 0 8px', color: 'var(--amber)' }}>
        {isRu ? 'Политика конфиденциальности' : 'Privacy Policy'}
      </h1>
      <p style={textStyle}>{isRu ? 'Последнее обновление: 28 июня 2026.' : 'Last updated: June 28, 2026.'}</p>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? 'Что мы собираем' : 'What We Collect'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Мы можем хранить Telegram ID, имя, username, аватар, опубликованные фотографии, подписи, реакции, комментарии, альбомы, жалобы, настройки профиля и технические данные, нужные для работы приложения.'
            : 'We may store Telegram ID, name, username, avatar, published photos, captions, reactions, comments, albums, reports, profile settings, and technical data needed for the app to work.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? 'Платежи и Stars' : 'Payments and Stars'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Если вы используете Telegram Stars, мы можем хранить сумму, связанную фотографию, получателя внутренней поддержки, Telegram payment charge ID и статус платежа или возврата. Данные банковских карт и внешние платёжные реквизиты мы не храним: платежи обрабатываются Telegram.'
            : 'If you use Telegram Stars, we may store the amount, related photo, internal support recipient, Telegram payment charge ID, and payment or refund status. We do not store bank card data or external payment credentials: payments are processed by Telegram.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? 'Аналитика' : 'Analytics'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Мы можем использовать анонимную или псевдонимную аналитику, чтобы понимать, какие функции работают, находить ошибки и улучшать продукт. Аналитика не используется для продажи ваших персональных данных.'
            : 'We may use anonymous or pseudonymous analytics to understand which features work, find bugs, and improve the product. Analytics are not used to sell your personal data.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? 'Кто видит контент' : 'Who Can See Content'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Публичные фотографии, подписи, реакции, счётчики Stars, альбомы и профиль могут быть видны другим пользователям Antigram. Не публикуйте личную информацию, которую не хотите показывать.'
            : 'Public photos, captions, reactions, Stars counters, albums, and profile information may be visible to other Antigram users. Do not publish personal information you do not want to show.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? 'Хранение и удаление' : 'Storage and Deletion'}</h2>
        <p style={textStyle}>
          {isRu
            ? 'Данные хранятся в сервисах, которые используются Antigram, включая Supabase. Вы можете запросить удаление аккаунта и связанных данных через поддержку. Часть записей о платежах, модерации или безопасности может храниться дольше, если это нужно для отчётности, споров, возвратов или соблюдения правил.'
            : 'Data is stored in services used by Antigram, including Supabase. You may request deletion of your account and related data through support. Some payment, moderation, or security records may be retained longer when needed for reporting, disputes, refunds, or compliance.'}
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? 'Условия' : 'Terms'}</h2>
        <p style={textStyle}>
          {isRu ? 'Правила использования приложения и Stars описаны здесь: ' : 'App rules and Stars usage are described here: '}
          <Link to="/terms" style={{ color: 'var(--amber)' }}>
            {isRu ? 'Условия Antigram' : 'Antigram Terms'}
          </Link>.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>{isRu ? 'Контакт' : 'Contact'}</h2>
        <p style={textStyle}>support@antigram.app</p>
      </section>
    </div>
  )
}
