import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [demoDay,setDemoDay]=useState(keyOf(new Date()))
  const [demoSlot,setDemoSlot]=useState('')
  const [demoName,setDemoName]=useState('')
  const [demoPhone,setDemoPhone]=useState('')
  const [demoRules,setDemoRules]=useState(false)
  const [dateWindow,setDateWindow]=useState(0)

  const [modalOpen,setModalOpen]=useState(false)
  const coverTitleRef=useRef<HTMLHeadingElement|null>(null)
  const heroCopyRef=useRef<HTMLDivElement|null>(null)
  useEffect(()=>{
    const heading=coverTitleRef.current
    const container=heroCopyRef.current
    if(!heading||!container)return
    let frame=0
    const fitTitle=()=>{
      cancelAnimationFrame(frame)
      frame=requestAnimationFrame(()=>{
        heading.style.fontSize=''
        heading.style.maxHeight='none'
        heading.style.overflow='visible'
        const baseSize=parseFloat(getComputedStyle(heading).fontSize)||56
        let size=baseSize
        const minSize=8
        const fits=()=>{
          const lineHeight=parseFloat(getComputedStyle(heading).lineHeight)||size
          return heading.scrollHeight<=lineHeight*4+2
        }
        heading.style.fontSize=size+'px'
        while(!fits()&&size>minSize){
          size=Math.max(minSize,size-.5)
          heading.style.fontSize=size+'px'
        }
        const lineHeight=parseFloat(getComputedStyle(heading).lineHeight)||size
        heading.style.maxHeight=(lineHeight*4)+'px'
        heading.style.overflow='hidden'
      })
    }
    fitTitle()
    const observer=new ResizeObserver(fitTitle)
    observer.observe(container)
    observer.observe(heading)
    window.addEventListener('load',fitTitle)
    return ()=>{
      observer.disconnect()
      window.removeEventListener('load',fitTitle)
      cancelAnimationFrame(frame)
    }
  },[props.coverTitle,props.preview])
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
  return <main className={'mp-page mp-theme-'+props.theme+(props.preview?' mp-is-preview':'')}>
    
    <section id="mp-top" className="mp-hero" style={props.coverImage?{backgroundImage:'url('+props.coverImage+')'}:undefined}>
      <a className="mp-hero-wordmark" href="#mp-top"><span>W.</span><b>WORKFLOWS<small>PERSONAL PRACTICE</small></b></a><div className="mp-hero-copy" ref={heroCopyRef}><span className="mp-kicker"><i/> {props.specialty||'НЕЗАВИСИМЫЙ СПЕЦИАЛИСТ'}</span><h1 ref={coverTitleRef}>{props.coverTitle.trim()||'Время для себя.'}<em>{props.coverTitle.trim()?'':'Искусство быть собой.'}</em></h1></div>
      <div className="mp-hero-visual">{photo?<img src={photo} alt={props.name}/>:<div className="mp-photo-placeholder">{(props.name||'W').slice(0,1)}</div>}<div className="mp-portrait-caption"><b>{props.name||'Ваше имя'}</b><small>{props.specialty||'Индивидуальная практика'}</small></div><div className="mp-hero-stamp">01 <i>/</i> PERSONAL SPACE</div></div>
      <div className="mp-hero-bottom">{props.tags.length>0&&<div className="mp-hero-tags">{props.tags.map((tag,index)=><span key={index}>• {tag}</span>)}</div>}</div>
    </section>
    <section className="mp-intro"><div className="mp-intro-index">01 / ИНФОРМАЦИЯ</div><h2>О <em>{props.name||"Личная практика"}</em></h2><p>{props.description||"Информация о специалисте пока не добавлена."}</p></section>
    <section id="mp-booking" className="mp-booking-section"><div className="mp-booking-intro"><span className="mp-kicker">02 / ОНЛАЙН-ЗАПИСЬ</span></div><div className="mp-booking-workspace"><div className="mp-calendar-panel">
<section className="mp-booking-step mp-booking-services"><div className="mp-panel-title"><div><span>ШАГ 01 / 03</span><h3>Выберите услугу</h3></div></div><div className="mp-service-grid">{props.services.map((service,index)=><button type="button" key={service.id} onClick={()=>{props.preview?(setDemoService(service.id),setDemoSlot('')):props.onServiceChange?.(service.id)}} className={'mp-service-card '+(selectedId===service.id?'is-selected':'')} aria-pressed={selectedId===service.id}><span className="mp-service-top"><i>0{index+1}</i><b>{selectedId===service.id?'ВЫБРАНО':'УСЛУГА'}</b></span><strong>{service.name}</strong><p>{service.description||'Индивидуальная услуга с вниманием к деталям.'}</p><span className="mp-service-bottom"><small>{service.duration} МИНУТ</small><b>{money(service.price)}</b></span></button>)}</div>{!props.services.length&&<p className="mp-empty">Услуги пока не добавлены.</p>}</section>
<section className="mp-booking-step mp-booking-dates"><div className="mp-panel-title"><div><span>ШАГ 02 / 03</span><h3>Выберите дату</h3></div></div><div className="mp-date-toolbar"><button type="button" aria-label="Предыдущий месяц" disabled={!selectedId||!canGoBack} onClick={()=>setDateWindow(v=>Math.max(0,v-1))}>‹</button><span>{calendarMonth.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}</span><button type="button" aria-label="Следующий месяц" disabled={!selectedId||!canGoForward} onClick={()=>setDateWindow(v=>v+1)}>›</button></div><div className="mp-calendar-weekdays">{["ПН","ВТ","СР","ЧТ","ПТ","СБ","ВС"].map(day=><span key={day}>{day}</span>)}</div><div className="mp-date-grid">{Array.from({length:monthOffset},(_,i)=><span className="mp-calendar-blank" key={"blank-"+i}/>)}{visibleDays.map(day=>{const past=day.key<todayKey;return <button type="button" key={day.key} disabled={!selectedId||past} className={(selectedDate===day.key?"is-active ":"")+(past?"is-past":"")} onClick={()=>{props.preview?(setDemoDay(day.key),setDemoSlot('')):props.onDateChange?.(day.key)}}><b>{day.date.getDate()}</b></button>})}</div>{!selectedId&&<p className="mp-step-hint">Сначала выберите услугу выше.</p>}</section>
<section className="mp-booking-step mp-booking-times"><div className="mp-panel-title"><div><span>ШАГ 03 / 03</span><h3>Выберите время</h3></div></div><p className="mp-stage-date">{selectedDate?dateLabel:'Сначала выберите дату в календаре'}</p><div className={'mp-slot-grid '+(!selectedDate?'is-disabled':'')}>{visibleSlots.map(slot=><button type="button" key={slot} disabled={!selectedDate} className={selectedSlot===slot?'is-active':''} onClick={()=>{props.preview?setDemoSlot(slot):props.onSlotChange?.(slot)}}>{props.formatSlot&&!props.preview?props.formatSlot(slot):slot}</button>)}</div>{selectedDate&&!slots.length&&<p className="mp-empty">На эту дату свободного времени нет. Выберите другой день.</p>}{!selectedDate&&<p className="mp-step-hint">Доступное время появится после выбора даты.</p>}</section>
</div><aside className="mp-order-card" id="mp-order-summary"><span className="mp-kicker">ВАША ВСТРЕЧА</span><h3>Детали<br/>записи</h3><div className="mp-order-person">{photo?<img src={photo} alt=""/>:<span>{(props.name||'W').slice(0,1)}</span>}<div><b>{props.name||'Ваш специалист'}</b><small>{props.specialty||'Personal practice'}</small></div></div><div className="mp-order-row"><small>ВЫБРАННАЯ УСЛУГА</small><b>{selectedService?.name??'Не выбрана'}</b></div><div className="mp-order-row"><small>ДАТА</small><b>{dateLabel||'Выберите день'}</b></div><div className="mp-order-row"><small>ВРЕМЯ</small><b>{selectedSlot?(props.formatSlot&&!props.preview?props.formatSlot(selectedSlot):selectedSlot):'Выберите слот'}</b></div><div className="mp-order-total"><span>ИТОГО</span><b>{money(selectedService?.price??0)}</b></div><div className="mp-secure-note">✦ <span>Ваши данные используются только для оформления записи.</span></div><button type="button" className="mp-submit mp-order-submit" disabled={!selectedSlot} onClick={()=>setModalOpen(true)}>ЗАБРОНИРОВАТЬ ВРЕМЯ <b>↗</b></button></aside></div></section>
    <section className="mp-final-cta"><span>ВАШЕ ВРЕМЯ НАЧИНАЕТСЯ ЗДЕСЬ</span><h2>Готовы уделить<br/><em>время себе?</em></h2><a href="#mp-booking" className="mp-button">Записаться на встречу <b>↗</b></a></section>
    <>{modalOpen&&<div className="mp-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModalOpen(false)}}><section className="mp-booking-modal" role="dialog" aria-modal="true" aria-labelledby="mp-modal-title"><button type="button" className="mp-modal-close" onClick={()=>setModalOpen(false)} aria-label="Закрыть">×</button><span className="mp-kicker">ПОСЛЕДНИЙ ШАГ</span><h3 id="mp-modal-title">Подтвердите запись</h3><p>{selectedService?.name} · {dateLabel} · {selectedSlot?(props.formatSlot&&!props.preview?props.formatSlot(selectedSlot):selectedSlot):""}</p><label>ФИО<input autoFocus value={props.preview?demoName:(props.clientName??"")} onChange={e=>props.preview?setDemoName(e.target.value):props.onClientNameChange?.(e.target.value)} placeholder="Имя и фамилия"/></label><label>НОМЕР ТЕЛЕФОНА{props.preview?<input value={demoPhone} onChange={e=>setDemoPhone(e.target.value)} placeholder="+7 (___) ___-__-__"/>:<PhoneInput value={props.clientPhone??""} onChange={props.onClientPhoneChange??(()=>{})} required/>}</label><label className="mp-check"><input type="checkbox" checked={props.preview?demoRules:(props.rulesAccepted??false)} onChange={e=>props.preview?setDemoRules(e.target.checked):props.onRulesAcceptedChange?.(e.target.checked)}/>Согласен(на) с правилами записи</label>{props.error&&!props.preview&&<p className="mp-error">{props.error}</p>}<button type="button" className="mp-submit" disabled={props.preview?(!demoName.trim()||!demoPhone.trim()||!demoRules):(!props.clientName?.trim()||!isValidRussianPhone(props.clientPhone??"")||!props.rulesAccepted||props.saving)} onClick={()=>{if(!props.preview)props.onSubmit?.()}}>{props.saving?"БРОНИРУЕМ…":"ПОДТВЕРДИТЬ БРОНЬ"} <b>↗</b></button></section></div>}</>
    <footer className="mp-footer"><a className="mp-wordmark" href="#mp-top"><span className="mp-mark">W.</span><span>WORKFLOWS<small>PERSONAL PRACTICE</small></span></a><span>ПРОСТРАНСТВО ДЛЯ ВАС</span><a href="#mp-top">НАВЕРХ ↑</a></footer>
  </main>
}
