import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import PhoneInput, { isValidRussianPhone } from '../lib/PhoneInput'

type MasterRecord = {
  id: string; display_name: string; slug: string; public_description: string; timezone: string
  kind: 'individual' | 'company'; company_id: string | null; photo_url: string | null; cover_url: string | null; theme: { id?: string; specialty?: string; cover_title?: string; tags?: string[] } | null
}
type ServiceRecord = { id: string; name: string; description: string; duration: number; price: number }
type CompanyRecord = { id: string; name: string; slug: string; is_active: boolean; theme: { id?: string } | null }

const money = (value: number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'
const dateKey = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-')
const dateKeyInZone = (date: Date, zone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
  const values = Object.fromEntries(parts.map(part=>[part.type,part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export default function BookingPage({ individual = false }: { individual?: boolean }) {
  const params = useParams()
  const [master, setMaster] = useState<MasterRecord | null>(null)
  const [company, setCompany] = useState<CompanyRecord | null>(null)
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [serviceId, setServiceId] = useState('')
  const [days, setDays] = useState<Date[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [selectedSlot, setSelectedSlot] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [bookingId, setBookingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedService = services.find(item => item.id === serviceId)
  const pageTheme = company?.theme?.id ?? master?.theme?.id ?? 'natural'

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) { setLoading(false); return }
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      let companyRecord: CompanyRecord | null = null
      if (individual) {
        const { data, error: queryError } = await supabase!.from('masters')
          .select('id,display_name,slug,public_description,timezone,kind,company_id,photo_url,cover_url,theme')
          .eq('slug', params.slug ?? '').eq('kind','individual').eq('is_active',true).is('archived_at',null).maybeSingle()
        if (queryError) throw queryError
        if (!data) throw new Error('Страница мастера не найдена или временно недоступна')
        if (!cancelled) setMaster(data as MasterRecord)
      } else {
        const { data: companyData, error: companyError } = await supabase!.from('companies')
          .select('id,name,slug,is_active,theme').eq('slug',params.companySlug ?? '').eq('is_active',true).maybeSingle()
        if (companyError) throw companyError
        if (!companyData) throw new Error('Компания не найдена или временно недоступна')
        companyRecord = companyData as CompanyRecord
        const { data, error: masterError } = await supabase!.from('masters')
          .select('id,display_name,slug,public_description,timezone,kind,company_id,photo_url,cover_url,theme')
          .eq('company_id',companyRecord.id).eq('slug',params.masterSlug ?? '').eq('kind','company')
          .eq('is_active',true).is('archived_at',null).maybeSingle()
        if (masterError) throw masterError
        if (!data) throw new Error('Страница мастера не найдена или временно недоступна')
        if (!cancelled) { setCompany(companyRecord); setMaster(data as MasterRecord) }
      }
      const masterId = individual
        ? (await supabase!.from('masters').select('id').eq('slug',params.slug ?? '').eq('kind','individual').maybeSingle()).data?.id
        : (await supabase!.from('masters').select('id').eq('company_id',companyRecord!.id).eq('slug',params.masterSlug ?? '').maybeSingle()).data?.id
      if (!masterId) throw new Error('Не удалось загрузить страницу мастера')
      const { data: serviceData, error: serviceError } = await supabase!.from('services')
        .select('id,name,description,duration,price').eq('master_id',masterId).eq('is_active',true).order('sort_order')
      if (serviceError) throw serviceError
      if (!cancelled) {
        setServices((serviceData ?? []) as ServiceRecord[])
        setServiceId(serviceData?.[0]?.id ?? '')
        const {data:zoneData}=await supabase!.from('masters').select('timezone').eq('id',masterId).single()
        const [year,month,day]=dateKeyInZone(new Date(),zoneData?.timezone??'UTC').split('-').map(Number)
        const nextDays=Array.from({length:30},(_,index)=>new Date(year,month-1,day+index,12,0,0))
        setDays(nextDays);setSelectedDate(dateKey(nextDays[0]))
      }
    }
    load().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Не удалось загрузить страницу')})
      .finally(()=>{if(!cancelled)setLoading(false)})
    return ()=>{cancelled=true}
  },[individual,params.slug,params.companySlug,params.masterSlug])

  useEffect(() => {
    if (!supabase || !master || !serviceId || !selectedDate) { setSlots([]); return }
    let cancelled = false
    supabase.rpc('get_available_slots',{p_master_id:master.id,p_service_id:serviceId,p_date:selectedDate})
      .then(({data,error:slotError})=>{
        if(cancelled)return
        if(slotError){setError(slotError.message);setSlots([]);return}
        setSlots((data??[]).map((row:{slot_start:string})=>row.slot_start))
      })
    return ()=>{cancelled=true}
  },[master?.id,serviceId,selectedDate])

  const formattedDate = useMemo(()=>{
    if(!selectedDate)return ''
    const [y,m,d]=selectedDate.split('-').map(Number)
    return new Date(y,m-1,d,12).toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'})
  },[selectedDate])

  function formatSlot(slot:string) {
    return new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:master?.timezone ?? 'UTC'}).format(new Date(slot))
  }

  async function submitBooking() {
    if(!supabase || !master || !selectedService || !selectedSlot)return
    const phone=clientPhone.trim()
    if(!isValidRussianPhone(phone)){setError('Введите номер в формате +7 и ровно 10 цифр после кода страны.');return}
    if(!clientName.trim()){setError('Укажите имя');return}
    setSaving(true);setError('')
    const {data,error:bookingError}=await supabase.rpc('create_booking',{
      p_master_id:master.id,p_service_id:selectedService.id,p_starts_at:selectedSlot,
      p_client_name:clientName.trim(),p_client_phone_e164:phone,p_rules_accepted:rulesAccepted
    })
    if(bookingError)setError(bookingError.message)
    else setBookingId(data as string)
    setSaving(false)
  }

  if(!isSupabaseConfigured || !supabase)return <main className="booking-shell"><header className="topbar"><span className="brand" aria-hidden="true"><span className="brand-mark">✦</span></span></header><section className="admin-card"><h1>Подключение онлайн-записи</h1><p>Для загрузки реальных страниц необходимо настроить подключение к базе данных.</p></section></main>
  if(loading)return <main className="booking-shell"><div className="admin-card">Загрузка страницы…</div></main>
  if(error && !master)return <main className="booking-shell"><div className="admin-card"><h1>Не удалось открыть страницу</h1><p>{error}</p></div></main>
  if(bookingId)return <main className="booking-shell"><section className="success-card"><div className="success-icon">✓</div><span className="eyebrow">ЗАПИСЬ ПОДТВЕРЖДЕНА</span><h1>Вы записаны!</h1><p>Спасибо, {clientName}. Запись сохранена.</p><p className="demo-note">Номер записи: {bookingId}</p></section></main>
  if(!master)return null

  if(individual) return <main className="editorial-public" data-theme={pageTheme}>
    <header className="editorial-masthead"><span className="editorial-wordmark">PERSONAL<br/>PRACTICE</span><span className="editorial-masthead-note">ПРОСТРАНСТВО ДЛЯ ВАС</span><span className="editorial-masthead-index">ОНЛАЙН-ЗАПИСЬ&nbsp; / &nbsp;01</span></header>
    {master.cover_url||master.theme?.cover_title ? <section className="editorial-cover" style={master.cover_url?{backgroundImage:`linear-gradient(90deg,rgba(24,22,19,.08),rgba(24,22,19,.34)),url("${master.cover_url}")`}:undefined}><span>{master.theme?.cover_title||'ВРЕМЯ ДЛЯ СЕБЯ'}</span><small>YOUR TIME · YOUR STYLE</small></section> : <section className="editorial-cover editorial-cover-empty"><span>{master.theme?.cover_title||'ВРЕМЯ ДЛЯ СЕБЯ'}</span><small>YOUR TIME · YOUR STYLE</small></section>}
    <section className="editorial-profile">
      <div className="editorial-portrait">{master.photo_url?<img src={master.photo_url} alt={master.display_name}/>:<span>{master.display_name.slice(0,1).toUpperCase()}</span>}</div>
      <div className="editorial-profile-copy"><span className="editorial-kicker">{master.theme?.specialty||'ИНДИВИДУАЛЬНЫЙ СПЕЦИАЛИСТ'}</span><h1>{master.display_name}</h1><p>{master.public_description}</p>{Array.isArray(master.theme?.tags)&&master.theme.tags.length>0&&<div className="editorial-tags">{master.theme.tags.map(tag=><span key={tag}>{tag}</span>)}</div>}</div>
      <div className="editorial-profile-aside"><span>ЧАСТНАЯ ПРАКТИКА</span><b>01 — 04</b><small>Запись онлайн<br/>в удобное время</small></div>
    </section>
    <div className="editorial-booking-grid">
      <section className="editorial-booking-main">
        <div className="editorial-section-head"><span>01 / УСЛУГИ</span><h2>Выберите<br/>свою услугу</h2><p>Внимание к деталям начинается с правильного выбора.</p></div>
        <div className="editorial-service-list">{services.map((service,index)=><button key={service.id} className={'editorial-service '+(serviceId===service.id?'is-selected':'')} onClick={()=>{setServiceId(service.id);setSelectedSlot('')}}><span className="editorial-service-number">0{index+1}</span><span className="editorial-service-copy"><strong>{service.name}</strong><small>{service.description}</small><em>{service.duration} МИНУТ</em></span><b>{money(service.price)}</b><span className="editorial-service-arrow">↗</span></button>)}{!services.length&&<p className="demo-note">Пока нет доступных услуг.</p>}</div>
        <div className="editorial-section-head editorial-date-head"><span>02 / ДАТА И ВРЕМЯ</span><h2>Назначим<br/>встречу</h2><p>{formattedDate||'Выберите подходящий день в календаре'}</p></div>
        <div className="editorial-date-strip">{days.map((day,index)=><button key={dateKey(day)} className={selectedDate===dateKey(day)?'is-selected':''} onClick={()=>{setSelectedDate(dateKey(day));setSelectedSlot('')}}><small>{index===0?'СЕГОДНЯ':day.toLocaleDateString('ru-RU',{weekday:'short'})}</small><strong>{day.getDate()}</strong><small>{day.toLocaleDateString('ru-RU',{month:'short'}).replace('.','')}</small></button>)}</div>
        <div className="editorial-time-head"><span>ДОСТУПНОЕ ВРЕМЯ</span><small>{formattedDate}</small></div>
        <div className="editorial-time-grid">{slots.map(slot=><button key={slot} className={selectedSlot===slot?'is-selected':''} onClick={()=>setSelectedSlot(slot)}>{formatSlot(slot)}</button>)}{!slots.length&&<p className="demo-note">На выбранную дату свободного времени нет.</p>}</div>
        {selectedSlot&&<section className="editorial-contact"><div className="editorial-section-head"><span>03 / ПОДТВЕРЖДЕНИЕ</span><h2>Оставьте<br/>контакты</h2></div><label>ВАШЕ ИМЯ<input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Как к вам обращаться?"/></label><label>НОМЕР ТЕЛЕФОНА<PhoneInput value={clientPhone} onChange={setClientPhone} required/></label><div className="editorial-total"><span>{selectedService?.name} · {formattedDate}, {formatSlot(selectedSlot)}</span><strong>{money(selectedService?.price??0)}</strong></div><p className="editorial-rules">Запись подтверждается автоматически. Для переноса или отмены свяжитесь со специалистом.</p><label className="editorial-rules-check"><input type="checkbox" checked={rulesAccepted} onChange={e=>setRulesAccepted(e.target.checked)}/>Я ознакомился с правилами записи и отмены</label>{error&&<p className="admin-error">{error}</p>}<button className="editorial-submit" disabled={!clientName.trim()||!isValidRussianPhone(clientPhone)||!rulesAccepted||saving} onClick={()=>void submitBooking()}>{saving?'Подтверждаем…':'Подтвердить запись'} <span>↗</span></button></section>}
      </section>
      <aside className="editorial-booking-aside"><div className="editorial-summary-card"><span className="editorial-kicker">ВАША ВСТРЕЧА</span><div className="editorial-summary-person">{master.photo_url?<img src={master.photo_url} alt=""/>:<span>{master.display_name.slice(0,1)}</span>}<div><strong>{master.display_name}</strong><small>{master.theme?.specialty||'Индивидуальный специалист'}</small></div></div><div className="editorial-summary-line"><span>УСЛУГА</span><b>{selectedService?.name??'Не выбрана'}</b></div><div className="editorial-summary-line"><span>ДАТА</span><b>{formattedDate||'Не выбрана'}</b></div><div className="editorial-summary-line"><span>ВРЕМЯ</span><b>{selectedSlot?formatSlot(selectedSlot):'Не выбрано'}</b></div><div className="editorial-summary-total"><span>ИТОГО</span><strong>{money(selectedService?.price??0)}</strong></div><small className="editorial-summary-foot">Все детали встречи будут подтверждены после отправки формы.</small></div><div className="editorial-aside-note"><span>«</span><p>Ваше время — самое ценное пространство. Позаботьтесь о нём.</p></div></aside>
    </div>
    <footer className="editorial-footer"><span>PERSONAL PRACTICE</span><span>ОНЛАЙН-ЗАПИСЬ · WORKFLOWS</span></footer>
  </main>

  return <main className={`booking-shell${individual ? " public-page-editorial" : ""}`} data-theme={pageTheme}>
    <header className="topbar"><span className="brand" aria-hidden="true"><span className="brand-mark" aria-hidden="true">✦</span></span><span className="demo-label"><i/> ОНЛАЙН-ЗАПИСЬ</span></header>
    {company && <div className="breadcrumb"><Link to={'/'+company.slug}>{company.name}</Link><span>/</span>{master.display_name}</div>}
    {(master.cover_url||master.theme?.cover_title)&&<div className="master-cover-photo" style={master.cover_url?{backgroundImage:`linear-gradient(115deg,rgba(0,0,0,.12),rgba(0,0,0,.32)),url("${master.cover_url}")`,backgroundSize:'cover',backgroundPosition:'center'}:undefined}>{master.theme?.cover_title&&<span>{master.theme.cover_title}</span>}<b>YOUR TIME · YOUR STYLE</b></div>}
    <section className="master-hero"><div className="master-avatar">{master.photo_url?<img src={master.photo_url} alt={master.display_name}/>:master.display_name.slice(0,1).toUpperCase()}</div><div className="master-copy"><span className="eyebrow">{master.theme?.specialty || company?.name || 'ИНДИВИДУАЛЬНЫЙ МАСТЕР'}</span><h1>{master.display_name}</h1><p>{master.public_description}</p>{Array.isArray(master.theme?.tags)&&master.theme.tags.length>0&&<div className="master-meta">{master.theme.tags.map(tag=><span key={tag}>{tag}</span>)}</div>}</div></section>
    <div className="booking-layout"><section className="booking-main">
      <div className="section-heading"><div><span className="eyebrow">ШАГ 1</span><h2>Выберите услугу</h2></div></div>
      <div className="service-list">{services.map(service=><button key={service.id} className={'service-card '+(serviceId===service.id?'selected':'')} onClick={()=>{setServiceId(service.id);setSelectedSlot('')}}><span className="service-radio">{serviceId===service.id?'✓':''}</span><span className="service-info"><strong>{service.name}</strong><small>{service.description}</small><em>{service.duration} минут</em></span><b>{money(service.price)}</b></button>)}</div>
      <div className="section-heading date-heading"><div><span className="eyebrow">ШАГ 2</span><h2>Выберите дату</h2></div><span className="section-caption">30 дней</span></div>
      <div className="date-strip">{days.map((day,index)=><button key={dateKey(day)} className={'date-card '+(selectedDate===dateKey(day)?'active':'')} onClick={()=>{setSelectedDate(dateKey(day));setSelectedSlot('')}}><small>{index===0?'Сегодня':day.toLocaleDateString('ru-RU',{weekday:'short'})}</small><strong>{day.getDate()}</strong><small>{day.toLocaleDateString('ru-RU',{month:'short'}).replace('.','')}</small></button>)}</div>
      <div className="section-heading time-heading"><div><span className="eyebrow">ШАГ 3</span><h2>Свободное время</h2></div><span className="section-caption">{formattedDate}</span></div>
      <div className="time-grid">{slots.map(slot=><button key={slot} className={'time-button '+(selectedSlot===slot?'active':'')} onClick={()=>setSelectedSlot(slot)}>{formatSlot(slot)}</button>)}{!slots.length&&<p className="demo-note">На выбранную дату свободного времени нет.</p>}</div>
      {selectedSlot&&<section className="client-section"><div className="section-heading"><div><span className="eyebrow">ШАГ 4</span><h2>Ваши контакты</h2></div></div><label className="field-label">Ваше имя<input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Как к вам обращаться?"/></label><label className="field-label">Номер телефона<PhoneInput value={clientPhone} onChange={setClientPhone} required/></label><div className="booking-summary"><span>{selectedService?.name} · {selectedService?.duration} мин.</span><b>{money(selectedService?.price??0)}</b><small>{formattedDate}, {formatSlot(selectedSlot)}</small></div><div className="booking-summary"><strong>Правила записи</strong><small>Запись подтверждается автоматически. Самостоятельно отменить или перенести её нельзя — для изменения планов свяжитесь с мастером.</small></div><label className="field-label rules-check"><input type="checkbox" checked={rulesAccepted} onChange={e=>setRulesAccepted(e.target.checked)}/>Я ознакомился с правилами записи и отмены</label>{error&&<p className="admin-error">{error}</p>}<button className="primary-button full-button" disabled={!clientName.trim()||!isValidRussianPhone(clientPhone)||!rulesAccepted||saving} onClick={()=>void submitBooking()}>{saving?'Подтверждаем…':'Подтвердить запись →'}</button></section>}
    </section><aside className="booking-aside"><div className="aside-card"><span className="eyebrow">ВАША ЗАПИСЬ</span><div className="aside-master"><div className="mini-avatar">{master.photo_url?<img src={master.photo_url} alt=""/>:master.display_name.slice(0,1)}</div><div><strong>{master.display_name}</strong><small>{company?.name??'Индивидуальный мастер'}</small></div></div><hr/><div className="aside-detail"><span>Услуга</span><b>{selectedService?.name??'Не выбрана'}</b></div><div className="aside-detail"><span>Дата</span><b>{formattedDate||'Не выбрана'}</b></div><div className="aside-detail"><span>Время</span><b>{selectedSlot?formatSlot(selectedSlot):'Не выбрано'}</b></div><hr/><div className="aside-total"><span>Итого</span><strong>{money(selectedService?.price??0)}</strong></div></div></aside></div>
  </main>
}
