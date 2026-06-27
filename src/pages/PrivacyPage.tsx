export function PrivacyPage() {
  return (
    <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto', color: 'var(--text, #fff)', paddingTop: 'var(--tg-top, 56px)' }}>
      <h1 style={{ fontSize: 20, marginBottom: 16, color: 'var(--amber)' }}>Политика конфиденциальности</h1>

      <section>
        <h2 style={{ fontSize: 16, marginTop: 20, marginBottom: 8 }}>Что мы собираем</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
          Фотографии, которые вы публикуете. Telegram ID для идентификации аккаунта.
          Анонимная аналитика использования (через PostHog).
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginTop: 20, marginBottom: 8 }}>Контент</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
          Публикуемые фотографии видны другим пользователям. Не публикуйте личную
          информацию в описаниях.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginTop: 20, marginBottom: 8 }}>Модерация</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
          Мы оставляем за собой право удалять контент, нарушающий правила сообщества.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginTop: 20, marginBottom: 8 }}>Хранение данных</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
          Данные хранятся на серверах Supabase (EU). Вы можете запросить удаление
          аккаунта и всех данных, написав в поддержку.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginTop: 20, marginBottom: 8 }}>Контакт</h2>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }}>
          support@antigram.app
        </p>
      </section>
    </div>
  )
}
