import { Link } from 'react-router-dom'

const sectionStyle: React.CSSProperties = { marginTop: 20 }
const headingStyle: React.CSSProperties = { fontSize: 16, margin: '0 0 8px', color: 'var(--text)' }
const textStyle: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: 'var(--text-muted)', margin: 0 }
const listStyle: React.CSSProperties = { ...textStyle, paddingLeft: 18, marginTop: 6 }

export function TermsPage() {
  return (
    <div style={{ padding: '20px 16px 110px', maxWidth: 600, margin: '0 auto', color: 'var(--text)', paddingTop: 'var(--tg-top, 56px)' }}>
      <Link to="/me" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>
        ← Назад
      </Link>

      <h1 style={{ fontSize: 20, margin: '16px 0 8px', color: 'var(--amber)' }}>
        Условия Antigram
      </h1>
      <p style={textStyle}>
        Эти условия описывают использование Antigram, публикацию фотографий и будущую механику поддержки авторов через Telegram Stars.
        Последнее обновление: 28 июня 2026.
      </p>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>1. Что такое Antigram</h2>
        <p style={textStyle}>
          Antigram — социальное приложение для публикации фотографий, реакций, альбомов и творческого статуса. Пользователь сам отвечает
          за фотографии, подписи и другие материалы, которые публикует.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>2. Публикации и лимиты</h2>
        <p style={textStyle}>
          Мы можем вводить лимиты на публикацию кадров, хранение альбомов, продвижение и другие функции. Лимиты могут зависеть от версии
          продукта, статуса аккаунта, правил модерации и внутренних бонусов. Если лимит влияет на оплату или платную функцию, мы покажем
          это до покупки.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>3. Stars под фотографиями</h2>
        <p style={textStyle}>
          Stars под фотографией — добровольная платная поддержка, реакция и сигнал признания автора внутри Antigram. Они могут отображаться
          публично рядом с фотографией и в профиле автора как часть рейтинга или статуса.
        </p>
        <ul style={listStyle}>
          <li>Stars не являются банковским счётом, вкладом, инвестицией, ценной бумагой или гарантированным доходом.</li>
          <li>Stars, отправленные через Antigram, сначала поступают на баланс бота/приложения в Telegram.</li>
          <li>Внутренний счётчик Stars автора показывает поддержку, полученную в Antigram, но сам по себе не гарантирует выплату.</li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>4. Возможные бонусы и выплаты</h2>
        <p style={textStyle}>
          В будущем Antigram может запускать внутренние бонусы для авторов: бейджи, дополнительный лимит кадров, premium-доступ,
          продвижение, участие в подборках или программу ручных выплат. Такие возможности не считаются обещанными до их официального
          запуска и могут иметь отдельные условия.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>5. Комиссия</h2>
        <p style={textStyle}>
          Если Antigram запустит программу выплат авторам, приложение может удерживать сервисную комиссию. Размер комиссии и правила
          расчёта будут показаны до участия в программе выплат. Для продуктового планирования ориентиром может быть комиссия около 20%,
          но окончательные условия будут опубликованы отдельно.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>6. Оплаты и возвраты</h2>
        <p style={textStyle}>
          Цифровые покупки внутри Telegram выполняются через Telegram Stars. Возвраты рассматриваются через поддержку Antigram и
          технические инструменты Telegram, если возврат применим. Мы не храним данные банковских карт и не обрабатываем внешние платёжные
          реквизиты.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>7. Модерация</h2>
        <p style={textStyle}>
          Мы можем скрывать, ограничивать или удалять материалы, которые нарушают правила сообщества, права других людей, закон или
          правила Telegram. Платная поддержка Stars не защищает публикацию от модерации.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>8. Поддержка</h2>
        <p style={textStyle}>
          По вопросам платежей, Stars, удаления аккаунта и модерации напишите в поддержку: support@antigram.app.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>9. Политика конфиденциальности</h2>
        <p style={textStyle}>
          То, какие данные мы собираем и как их используем, описано отдельно: <Link to="/privacy" style={{ color: 'var(--amber)' }}>Политика конфиденциальности</Link>.
        </p>
      </section>
    </div>
  )
}
