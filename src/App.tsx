import { Link, Route, Routes, useParams } from 'react-router-dom'

function Home() {
  return (
    <main className="page-shell">
      <section className="welcome-card">
        <div className="eyebrow">СИСТЕМА ОНЛАЙН-ЗАПИСИ</div>
        <h1>Запись к мастеру —<br />просто и удобно</h1>
        <p className="lead">Персональные страницы мастеров, удобный выбор услуги и свободного времени.</p>
        <div className="notice">
          <span className="notice-dot" />
          Платформа создаётся. Скоро здесь можно будет записаться онлайн.
        </div>
        <Link className="text-link" to="/admin">Вход для администратора <span aria-hidden="true">→</span></Link>
      </section>
      <footer>Онлайн-запись · Платформа для мастеров</footer>
    </main>
  )
}

function MasterPage() {
  const { slug } = useParams()
  return (
    <main className="page-shell">
      <section className="welcome-card">
        <div className="eyebrow">ПЕРСОНАЛЬНАЯ СТРАНИЦА</div>
        <h1>Страница мастера</h1>
        <p className="lead">Адрес страницы: <strong>/{slug}</strong></p>
        <p className="muted">Когда подключим базу данных, здесь появятся описание мастера, услуги, цены и календарь записи.</p>
        <Link className="text-link" to="/">На главную <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  )
}

function AdminPage() {
  return (
    <main className="page-shell">
      <section className="welcome-card">
        <div className="eyebrow">АДМИНИСТРИРОВАНИЕ</div>
        <h1>Панель управления</h1>
        <p className="lead">Вход в систему будет подключён после настройки авторизации.</p>
        <Link className="text-link" to="/">На главную <span aria-hidden="true">→</span></Link>
      </section>
    </main>
  )
}

function NotFound() {
  return (
    <main className="page-shell">
      <section className="welcome-card">
        <h1>Страница не найдена</h1>
        <Link className="text-link" to="/">Вернуться на главную</Link>
      </section>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin/*" element={<AdminPage />} />
      <Route path="/:slug" element={<MasterPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}