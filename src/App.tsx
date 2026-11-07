import { useMemo, useState } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'

type Service = { id: number; name: string; description: string; duration: number; price: number }

const demoServices: Service[] = [
  { id: 1, name: 'Консультация', description: 'Знакомство, обсуждение задачи и подбор решения', duration: 30, price: 1200 },
  { id: 2, name: 'Основная услуга', description: 'Полноценная процедура с индивидуальным подходом', duration: 60, price: 2500 },
  { id: 3, name: 'Расширенная услуга', description: 'Больше времени и внимания к деталям', duration: 90, price: 3500 },
]

const demoTimes = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00']

function formatPrice(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value) + ' ₽'
}

function makeDates() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() + index)
    return date
  })
}

function DemoHome() {
  return (
    <main className="home-shell">
      <div className="home-card">
        <div className="brand-mark">b.</div>
        <div className="eyebrow">ПЛАТФОРМА ОНЛАЙН-ЗАПИСИ</div>
        <h1>Запись без лишних звонков</h1>
        <p>Это техническая главная страница платформы. У каждого специалиста будет своя персональная ссылка для клиентов.</p>
        <Link className="primary-link" to="/anna">Посмотреть демо-страницу мастера <span>→</span></Link>
        <div className="home-foot">Демонстрационный режим · Данные пока не сохраняются</div>
      </div>
    </main>
  )
}

function MasterPage() {
  const { slug } = useParams()
  const [selectedService, setSelectedService] = useState(2)
  const [selectedDate, setSelectedDate] = useState(0)
  const [selectedTime, setSelectedTime] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const dates = useMemo(makeDates, [])
  const service = demoServices.find(item => item.id === selectedService) ?? demoServices[0]
  const masterName = slug === 'anna' ? 'Анна Смирнова' : 'Ваш мастер'
  const formattedDate = dates[selectedDate].toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })

  function chooseDate(index: number) {
    setSelectedDate(index)
    setSelectedTime('')
  }

  if (confirmed) {
    return (
      <main className="booking-shell">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <div className="eyebrow">ДЕМО-БРОНИРОВАНИЕ</div>
          <h1>Вы записаны!</h1>
          <p className="success-lead">Спасибо, {clientName}. Ваша демонстрационная запись выглядит так:</p>
          <div className="receipt">
            <div><span>Мастер</span><strong>{masterName}</strong></div>
            <div><span>Услуга</span><strong>{service.name}</strong></div>
            <div><span>Дата и время</span><strong>{formattedDate}, {selectedTime}</strong></div>
            <div><span>Стоимость</span><strong>{formatPrice(service.price)}</strong></div>
            <div><span>Телефон</span><strong>{clientPhone}</strong></div>
          </div>
          <p className="demo-note">Это демонстрация интерфейса. Запись пока не отправлена мастеру и не сохранена в базе.</p>
          <button className="secondary-button full-button" onClick={() => { setConfirmed(false); setSelectedTime(''); setClientName(''); setClientPhone('') }}>Создать ещё одну демо-запись</button>
        </div>
      </main>
    )
  }

  return (
    <main className="booking-shell">
      <header className="topbar">
        <Link to="/" className="brand"><span className="brand-mark">b.</span><span>booking<span className="brand-light">space</span></span></Link>
        <span className="demo-label"><i /> ДЕМО-РЕЖИМ</span>
      </header>

      <section className="master-hero">
        <div className="master-avatar">А</div>
        <div className="master-copy">
          <div className="eyebrow">ПЕРСОНАЛЬНАЯ СТРАНИЦА МАСТЕРА</div>
          <h1>{masterName}</h1>
          <p>Помогаю найти время для себя. Индивидуальный подход, внимание к деталям и комфорт на каждом этапе.</p>
          <div className="master-meta"><span>✦ Частная практика</span><span>⌖ По предварительной записи</span></div>
        </div>
        <div className="hero-decoration" aria-hidden="true"><span>your time</span><b>is now.</b></div>
      </section>

      <div className="booking-layout">
        <section className="booking-main">
          <div className="section-heading">
            <div><div className="step-label">ШАГ 1</div><h2>Выберите услугу</h2></div>
            <span className="section-caption">Что будем делать?</span>
          </div>
          <div className="service-list">
            {demoServices.map(item => (
              <button key={item.id} className={`service-card ${selectedService === item.id ? 'selected' : ''}`} onClick={() => setSelectedService(item.id)}>
                <span className="service-radio">{selectedService === item.id ? '✓' : ''}</span>
                <span className="service-info"><strong>{item.name}</strong><small>{item.description}</small><em>{item.duration} минут</em></span>
                <span className="service-price">{formatPrice(item.price)}</span>
              </button>
            ))}
          </div>

          <div className="section-heading date-heading">
            <div><div className="step-label">ШАГ 2</div><h2>Выберите дату</h2></div>
            <span className="section-caption">Ближайшие 7 дней</span>
          </div>
          <div className="date-strip">
            {dates.map((date, index) => (
              <button key={date.toISOString()} className={`date-card ${selectedDate === index ? 'active' : ''}`} onClick={() => chooseDate(index)}>
                <small>{index === 0 ? 'Сегодня' : date.toLocaleDateString('ru-RU', { weekday: 'short' })}</small>
                <strong>{date.getDate()}</strong>
                <small>{date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}</small>
              </button>
            ))}
          </div>

          <div className="section-heading time-heading">
            <div><div className="step-label">ШАГ 3</div><h2>Свободное время</h2></div>
            <span className="section-caption">{formattedDate}</span>
          </div>
          <div className="time-grid">
            {demoTimes.map(time => (
              <button key={time} className={`time-button ${selectedTime === time ? 'active' : ''}`} onClick={() => setSelectedTime(time)}>{time}</button>
            ))}
          </div>

          {selectedTime && (
            <section className="client-section">
              <div className="section-heading">
                <div><div className="step-label">ШАГ 4</div><h2>Ваши контакты</h2></div>
                <span className="section-caption">Остался последний шаг</span>
              </div>
              <label className="field-label">Ваше имя<input value={clientName} onChange={event => setClientName(event.target.value)} placeholder="Как к вам обращаться?" autoComplete="name" /></label>
              <label className="field-label">Номер телефона<input value={clientPhone} onChange={event => setClientPhone(event.target.value)} placeholder="+7 (___) ___-__-__" type="tel" autoComplete="tel" /></label>
              <div className="booking-summary"><span>{service.name} · {service.duration} мин.</span><strong>{formatPrice(service.price)}</strong><small>{formattedDate}, {selectedTime}</small></div>
              <button className="primary-button full-button" disabled={!clientName.trim() || clientPhone.replace(/\D/g, '').length < 7} onClick={() => setShowRules(true)}>Продолжить <span>→</span></button>
              <p className="privacy-hint">Нажимая «Продолжить», вы сможете ознакомиться с правилами записи.</p>
            </section>
          )}
        </section>

        <aside className="booking-aside">
          <div className="aside-card">
            <div className="aside-top"><span>ВАША ЗАПИСЬ</span><span className="aside-spark">✳</span></div>
            <div className="aside-master"><div className="mini-avatar">А</div><div><strong>{masterName}</strong><small>Ваш специалист</small></div></div>
            <div className="aside-divider" />
            <div className="aside-detail"><span>Услуга</span><strong>{service.name}</strong></div>
            <div className="aside-detail"><span>Длительность</span><strong>{service.duration} минут</strong></div>
            <div className="aside-detail"><span>Дата</span><strong>{formattedDate}</strong></div>
            <div className="aside-detail"><span>Время</span><strong>{selectedTime || 'Не выбрано'}</strong></div>
            <div className="aside-divider" />
            <div className="aside-total"><span>Итого</span><strong>{formatPrice(service.price)}</strong></div>
            <p className="aside-foot">Выберите услугу, дату и время — и мы подготовим вашу запись.</p>
          </div>
          <div className="secure-note"><span>♧</span><p><strong>Ваше время — ваша ценность</strong><br />Запись занимает всего пару минут.</p></div>
        </aside>
      </div>
      <footer className="page-footer"><span>booking space</span><span>Онлайн-запись без ожидания</span></footer>

      {showRules && (
        <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowRules(false) }}>
          <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
            <button className="modal-close" onClick={() => setShowRules(false)} aria-label="Закрыть">×</button>
            <div className="eyebrow">ПОЖАЛУЙСТА, ОЗНАКОМЬТЕСЬ</div>
            <h2 id="rules-title">Правила записи</h2>
            <p>Пожалуйста, приходите вовремя. Если планы изменились, заранее свяжитесь с мастером по указанным контактам.</p>
            <ul><li>Запись подтверждается автоматически.</li><li>Изменить или отменить запись можно, связавшись с мастером.</li><li>Выбранное время резервируется после подтверждения.</li></ul>
            <div className="modal-booking"><strong>{service.name}</strong><span>{formattedDate}, {selectedTime} · {formatPrice(service.price)}</span></div>
            <button className="primary-button full-button" onClick={() => { setShowRules(false); setConfirmed(true) }}>Согласен, подтвердить запись <span>→</span></button>
            <button className="modal-back" onClick={() => setShowRules(false)}>Вернуться и проверить данные</button>
            <p className="demo-note">Демо: подтверждение не создаёт реальную бронь.</p>
          </section>
        </div>
      )}
    </main>
  )
}

function AdminPage() {
  return <main className="home-shell"><div className="home-card"><div className="eyebrow">АДМИНИСТРИРОВАНИЕ</div><h1>Панель управления</h1><p>Вход для администратора появится после подключения авторизации.</p><Link className="primary-link" to="/">Вернуться на главную <span>→</span></Link></div></main>
}

function NotFound() {
  return <main className="home-shell"><div className="home-card"><h1>Страница не найдена</h1><Link className="primary-link" to="/anna">Открыть демо-страницу мастера →</Link></div></main>
}

export default function App() {
  return <Routes><Route path="/" element={<DemoHome />} /><Route path="/admin/*" element={<AdminPage />} /><Route path="/:slug" element={<MasterPage />} /><Route path="*" element={<NotFound />} /></Routes>
}
