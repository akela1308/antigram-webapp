import { Link } from 'react-router-dom'

const sectionStyle: React.CSSProperties = { marginTop: 20 }
const headingStyle: React.CSSProperties = { fontSize: 16, margin: '0 0 8px', color: 'var(--text)' }
const textStyle: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }

export function PrivacyPage() {
  return (
    <div style={{ padding: '20px 16px 110px', maxWidth: 600, margin: '0 auto', color: 'var(--text, #fff)', paddingTop: 'var(--tg-top, 56px)' }}>
      <Link to="/me" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
        ← Назад
      </Link>

      <h1 style={{ fontSize: 20, margin: '16px 0 8px', color: 'var(--amber)' }}>Политика конфиденциальности</h1>
      <p style={textStyle}>Последнее обновление: 28 июня 2026.</p>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Что мы собираем</h2>
        <p style={textStyle}>
          Мы можем хранить Telegram ID, имя, username, аватар, опубликованные фотографии, подписи, реакции, комментарии, альбомы,
          жалобы, настройки профиля и технические данные, нужные для работы приложения.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Платежи и Stars</h2>
        <p style={textStyle}>
          Если вы используете Telegram Stars, мы можем хранить сумму, связанную фотографию, получателя внутренней поддержки,
          Telegram payment charge ID и статус платежа или возврата. Данные банковских карт и внешние платёжные реквизиты мы не храним:
          платежи обрабатываются Telegram.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Аналитика</h2>
        <p style={textStyle}>
          Мы можем использовать анонимную или псевдонимную аналитику, чтобы понимать, какие функции работают, находить ошибки и улучшать
          продукт. Аналитика не используется для продажи ваших персональных данных.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Кто видит контент</h2>
        <p style={textStyle}>
          Публичные фотографии, подписи, реакции, счётчики Stars, альбомы и профиль могут быть видны другим пользователям Antigram.
          Не публикуйте личную информацию, которую не хотите показывать.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Хранение и удаление</h2>
        <p style={textStyle}>
          Данные хранятся в сервисах, которые используются Antigram, включая Supabase. Вы можете запросить удаление аккаунта и связанных
          данных через поддержку. Часть записей о платежах, модерации или безопасности может храниться дольше, если это нужно для отчётности,
          споров, возвратов или соблюдения правил.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Условия</h2>
        <p style={textStyle}>
          Правила использования приложения и Stars описаны здесь: <Link to="/terms" style={{ color: 'var(--amber)' }}>Условия Antigram</Link>.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>Контакт</h2>
        <p style={textStyle}>
          support@antigram.app
        </p>
      </section>
    </div>
  )
}
