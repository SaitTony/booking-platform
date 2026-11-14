import { useEffect, useMemo, useState } from 'react'
import PhoneInput, { isValidRussianPhone } from '../lib/PhoneInput'
import './MasterProPublicPage.css'

type Service = { id:string; name:string; description:string; duration:number; price:number }
type Day = { key:string; date:Date; label:string; weekday:string; month:string }
type Props = {
  name:string; specialty:string; description:string; photo:string; coverImage:string; coverTitle:string; tags:string[]; theme:string
  services:Service[]; selectedServiceId?:string; onServiceChange?:(id:string)=>void
  days?:Date[]; selectedDate?:string; onDateChange?:(value:string)=>void
  slots?:string[]; selectedSlot?:string; onSlotChange?:(value:string)=>void
  formatSlot?:(slot:string)=>string; formattedDate?:string
  clientName?:string; onClientNameChange?:(value:string)=>void
  clientPhone?:string; onClientPhoneChange?:(value:string)=>void
  rulesAccepted?:boolean; onRulesAcceptedChange?:(value:boolean)=>void
  saving?:boolean; error?:string; onSubmit?:()=>void
  preview?:boolean
}
const money=(value:number)=>new Intl.NumberFormat('ru-RU').format(value)+' ₽'
const keyOf=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-')
export default function MasterProPublicPage(props:Props){
  const previewDays=useMemo(()=>Array.from({length:30},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i);return d}),[])
  const [demoService,setDemoService]=useState(props.services[0]?.id??'')
  const [demoDay,setDemoDay]=useState(keyOf(previewDays[0]))
  const [demoSlot,setDemoSlot]=useState('')
  const [demoName,setDemoName]=useState('')
  const [demoPhone,setDemoPhone]=useState('')
  const [demoRules,setDemoRules]=useState(false)
  const [dateWindow,setDateWindow]=useState(0)
  const [showAllSlots,setShowAllSlots]=useState(false)
  const [modalOpen,setModalOpen]=useState(false)
  const days:Day[]=(props.days??(props.preview?previewDays:[])).map((date,index)=>({key:keyOf(date),date,label:index===0?'СЕГОДНЯ':date.toLocaleDateString('ru-RU',{weekday:'short'}).toUpperCase(),weekday:date.toLocaleDateString('ru-RU',{weekday:'short'}).toUpperCase(),month:date.toLocaleDateString('ru-RU',{month:'short'}).replace('.','').toUpperCase()}))
  const baseMonth=days[0]?.date??previewDays[0]
  const calendarMonth=new Date(baseMonth.getFullYear(),baseMonth.getMonth()+dateWindow,1,12)
  const visibleDays=days.filter(day=>day.date.getFullYear()===calendarMonth.getFullYear()&&day.date.getMonth()===calendarMonth.getMonth())
  const monthOffset=(calendarMonth.getDay()+6)%7
  const todayKey=keyOf(new Date())
  const canGoBack=dateWindow>0
  const canGoForward=days.some(day=>day.date.getFullYear()===calendarMonth.getFullYear()&&day.date.getMonth()>calendarMonth.getMonth())
  const selectedId=props.preview?demoService:(props.selectedServiceId??'')
  const selectedService=props.services.find(s=>s.id===selectedId)??props.services[0]
  const selectedDate=props.preview?demoDay:(props.selectedDate??'')
  const selectedSlot=props.preview?demoSlot:(props.selectedSlot??'')
  const sampleSlots=['09:30','10:45','12:00','13:30','15:00','16:15']
  const slots=props.preview?sampleSlots:(props.slots??[])
  const visibleSlots=slots
  const dateLabel=props.preview?new Date(selectedDate+'T12:00:00').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'}):(props.formattedDate??'')
  const photo=props.photo
  const firstName=props.name.trim().split(/\s+/)[0]||'специалист'
  useEffect(()=>{if(selectedSlot)document.getElementById('mp-booking-summary')?.scrollIntoView({behavior:'smooth',block:'center'})},[selectedSlot])
  return <main className={'mp-page mp-theme-'+props.theme+(props.preview?' mp-is-preview':'')}>
    <header className="mp-header"><a className="mp-wordmark" href="#mp-top"><span className="mp-mark">W.</span><span>WORKFLOWS<small>PERSONAL PRACTICE</small></span></a><nav><a href="#mp-services">УСЛУГИ</a><a href="#mp-about">ОБО МНЕ</a></nav><a className="mp-header-cta" href="#mp-booking">ЗАПИСАТЬСЯ <b>↗</b></a></header>
    <section id="mp-top" className="mp-hero" style={props.coverImage?{backgroundImage:'linear-gradient(90deg,rgba(9,13,26,.88),rgba(9,13,26,.25)),url('+props.coverImage+')'}:undefined}>
      <div className="mp-hero-copy"><span className="mp-kicker"><i/> {props.specialty||'НЕЗАВИСИМЫЙ СПЕЦИАЛИСТ'} <b>·</b> PRIVATE PRACTICE</span><h1>{props.coverTitle.trim()||'Время для себя.'}<em>{props.coverTitle.trim()?'':'Искусство быть собой.'}</em></h1><p>{props.description||'Персональный подход, внимание к деталям и пространство, в котором всё начинается с вас.'}</p><a href="#mp-booking" className="mp-button">Выбрать время <b>↗</b></a><span className="mp-hero-note">ПЕРСОНАЛЬНАЯ ЗАПИСЬ · БЕЗ ОЖИДАНИЯ</span></div>
      <div className="mp-hero-visual">{photo?<img src={photo} alt={props.name}/>:<div className="mp-photo-placeholder">{(props.name||'W').slice(0,1)}</div>}<div className="mp-portrait-caption"><span>ВАШ СПЕЦИАЛИСТ</span><b>{props.name||'Ваше имя'}</b><small>{props.specialty||'Индивидуальная практика'}</small></div><div className="mp-hero-stamp">01 <i>/</i> PERSONAL SPACE</div></div>
      <div className="mp-hero-bottom"><span>ПРОСТРАНСТВО ДЛЯ ВАС</span><span>SCROLL TO EXPLORE ↓</span><span>01 — 04</span></div>
    </section>
    <section className="mp-intro"><div className="mp-intro-index">01 / ПОДХОД</div><h2>Не просто услуга.<br/><em>Время, созданное для вас.</em></h2><p>Выбирайте то, что подходит именно вам. Вся информация о специалисте, услугах и свободном времени — в одном месте.</p></section>
    <section id="mp-services" className="mp-services-section"><div className="mp-section-head"><div><span className="mp-kicker">02 / МОИ УСЛУГИ</span><h2>Выберите свой<br/><em>формат заботы.</em></h2></div><p>Каждая встреча начинается с вашего запроса. Выберите услугу, чтобы перейти к календарю записи.</p></div><div className="mp-service-grid">{props.services.map((service,index)=><button type="button" key={service.id} onClick={()=>{props.preview?setDemoService(service.id):props.onServiceChange?.(service.id);document.getElementById("mp-booking")?.scrollIntoView({behavior:"smooth",block:"start"})}} className={'mp-service-card '+(selectedId===service.id?'is-selected':'')}><span className="mp-service-top"><i>0{index+1}</i><b>{selectedId===service.id?'ВЫБРАНО':'УСЛУГА'}</b></span><strong>{service.name}</strong><p>{service.description||'Индивидуальная услуга с вниманием к деталям.'}</p><span className="mp-service-bottom"><small>{service.duration} МИНУТ</small><b>{money(service.price)}</b><i>↗</i></span></button>)}</div>{!props.services.length&&<p className="mp-empty">Услуги пока не добавлены.</p>}</section>
    <section id="mp-booking" className="mp-booking-section"><div className="mp-booking-intro"><span className="mp-kicker">03 / ОНЛАЙН-ЗАПИСЬ</span><h2>Ваше время.<br/><em>Ваш выбор.</em></h2><p>Выберите дату и удобное время. Подтверждение займёт всего пару минут.</p><div className="mp-booking-steps"><span><b>01</b> Услуга</span><span><b>02</b> Дата и время</span><span><b>03</b> Контакты</span></div></div>
      <div className="mp-booking-workspace"><div className="mp-calendar-panel"><div className="mp-panel-title"><div><span>ШАГ 01</span><h3>Когда вам удобно?</h3></div><small>{dateLabel}</small></div><div className="mp-date-toolbar"><button type="button" aria-label="Предыдущий месяц" disabled={!canGoBack} onClick={()=>setDateWindow(v=>Math.max(0,v-1))}>‹</button><span>{calendarMonth.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</span><button type="button" aria-label="Следующий месяц" disabled={!canGoForward} onClick={()=>setDateWindow(v=>v+1)}>›</button></div><div className="mp-calendar-weekdays">{["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"].map(day=><span key={day}>{day}</span>)}</div><div className="mp-date-grid">{Array.from({length:monthOffset},(_,i)=><span className="mp-calendar-blank" key={"blank-"+i}/>)}{visibleDays.map(day=>{const past=day.key<todayKey;return <button type="button" key={day.key} disabled={past} className={(selectedDate===day.key?"is-active ":"")+(past?"is-past":"")} onClick={()=>{setShowAllSlots(false);props.preview?setDemoDay(day.key):props.onDateChange?.(day.key);document.getElementById("mp-time-slots")?.scrollIntoView({behavior:"smooth",block:"start"})}}><b>{day.date.getDate()}</b></button>})}</div></div><div className="mp-panel-title mp-time-title"><div><span>ШАГ 02</span><h3>Свободное время</h3></div><small>{slots.length} {slots.length===1?'ВАРИАНТ':'ВАРИАНТОВ'}</small></div><div className="mp-slot-grid" id="mp-time-slots">{visibleSlots.map(slot=><button type="button" key={slot} className={selectedSlot===slot?'is-active':''} onClick={()=>{props.preview?setDemoSlot(slot):props.onSlotChange?.(slot);document.getElementById("mp-booking-summary")?.scrollIntoView({behavior:"smooth",block:"center"})}}>{props.formatSlot&&!props.preview?props.formatSlot(slot):slot}</button>)}</div>{slots.length>8&&<button type="button" className="mp-show-slots" onClick={()=>setShowAllSlots(value=>!value)}>{showAllSlots?'Свернуть время':'Показать все '+slots.length+' вариантов'} <b>{showAllSlots?'↑':'↓'}</b></button>}{!slots.length&&<p className="mp-empty">На эту дату свободного времени нет. Выберите другой день.</p>}
      {selectedSlot?<div className="mp-booking-summary" id="mp-booking-summary"><span className="mp-kicker">ШАГ 03 / ВАШ ВЫБОР</span><h3>Ваша запись</h3><div className="mp-summary-line"><span>Услуга</span><b>{selectedService?.name??"—"}</b></div><div className="mp-summary-line"><span>Дата</span><b>{dateLabel}</b></div><div className="mp-summary-line"><span>Время</span><b>{props.formatSlot&&!props.preview?props.formatSlot(selectedSlot):selectedSlot}</b></div><div className="mp-summary-total"><span>К оплате</span><b>{money(selectedService?.price??0)}</b></div><button type="button" className="mp-submit" onClick={()=>setModalOpen(true)}>ЗАБРОНИРОВАТЬ ВРЕМЯ <b>↗</b></button></div></div>
      <aside className="mp-order-card" id="mp-order-summary"><span className="mp-kicker">ВАША ВСТРЕЧА</span><h3>Детали<br/>записи</h3><div className="mp-order-person">{photo?<img src={photo} alt=""/>:<span>{(props.name||'W').slice(0,1)}</span>}<div><b>{props.name||'Ваш специалист'}</b><small>{props.specialty||'Personal practice'}</small></div></div><div className="mp-order-row"><small>ВЫБРАННАЯ УСЛУГА</small><b>{selectedService?.name??'Не выбрана'}</b></div><div className="mp-order-row"><small>ДАТА</small><b>{dateLabel||'Выберите день'}</b></div><div className="mp-order-row"><small>ВРЕМЯ</small><b>{selectedSlot?(props.formatSlot&&!props.preview?props.formatSlot(selectedSlot):selectedSlot):'Выберите слот'}</b></div><div className="mp-order-total"><span>ИТОГО</span><b>{money(selectedService?.price??0)}</b></div><div className="mp-secure-note">✦ <span>Ваши данные используются только для оформления записи.</span></div></aside></div>
    </section>
    <section id="mp-about" className="mp-about-section"><div className="mp-about-image">{photo?<img src={photo} alt={props.name}/>:<span>{(props.name||'W').slice(0,1)}</span>}<small>PERSONAL PRACTICE / EST. {new Date().getFullYear()}</small></div><div className="mp-about-copy"><span className="mp-kicker">04 / ЗНАКОМСТВО</span><h2>Здравствуйте,<br/><em>я {firstName}.</em></h2><p>{props.description||'Я верю, что качественная работа начинается с внимания к человеку. Для меня важны детали, комфорт и результат, который подходит именно вам.'}</p><div className="mp-tag-list">{(props.tags.length?props.tags:['Индивидуальный подход','Внимание к деталям','Комфортная атмосфера']).map(tag=><span key={tag}>{tag}</span>)}</div><a href="#mp-booking" className="mp-text-link">Давайте знакомиться <b>↗</b></a></div></section>
    <section className="mp-final-cta"><span>ВАШЕ ВРЕМЯ НАЧИНАЕТСЯ ЗДЕСЬ</span><h2>Готовы уделить<br/><em>время себе?</em></h2><a href="#mp-booking" className="mp-button">Записаться на встречу <b>↗</b></a></section>
    <>{modalOpen&&<div className="mp-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModalOpen(false)}}><section className="mp-booking-modal" role="dialog" aria-modal="true" aria-labelledby="mp-modal-title"><button type="button" className="mp-modal-close" onClick={()=>setModalOpen(false)} aria-label="Закрыть">×</button><span className="mp-kicker">ПОСЛЕДНИЙ ШАГ</span><h3 id="mp-modal-title">Подтвердите запись</h3><p>{selectedService?.name} · {dateLabel} · {selectedSlot?(props.formatSlot&&!props.preview?props.formatSlot(selectedSlot):selectedSlot):""}</p><label>ФИО<input autoFocus value={props.preview?demoName:(props.clientName??"")} onChange={e=>props.preview?setDemoName(e.target.value):props.onClientNameChange?.(e.target.value)} placeholder="Имя и фамилия"/></label><label>НОМЕР ТЕЛЕФОНА{props.preview?<input value={demoPhone} onChange={e=>setDemoPhone(e.target.value)} placeholder="+7 (___) ___-__-__"/>:<PhoneInput value={props.clientPhone??""} onChange={props.onClientPhoneChange??(()=>{})} required/>}</label><label className="mp-check"><input type="checkbox" checked={props.preview?demoRules:(props.rulesAccepted??false)} onChange={e=>props.preview?setDemoRules(e.target.checked):props.onRulesAcceptedChange?.(e.target.checked)}/>Согласен(на) с правилами записи</label>{props.error&&!props.preview&&<p className="mp-error">{props.error}</p>}<button type="button" className="mp-submit" disabled={props.preview?(!demoName.trim()||!demoPhone.trim()||!demoRules):(!props.clientName?.trim()||!isValidRussianPhone(props.clientPhone??"")||!props.rulesAccepted||props.saving)} onClick={()=>{if(!props.preview)props.onSubmit?.()}}>{props.saving?"БРОНИРУЕМ…":"ПОДТВЕРДИТЬ БРОНЬ"} <b>↗</b></button></section></div>}</>
    <footer className="mp-footer"><a className="mp-wordmark" href="#mp-top"><span className="mp-mark">W.</span><span>WORKFLOWS<small>PERSONAL PRACTICE</small></span></a><span>ПРОСТРАНСТВО ДЛЯ ВАС</span><a href="#mp-top">НАВЕРХ ↑</a></footer>
  </main>
}
