import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Member = { role:'admin'|'master'; company_id:string; master_id:string|null }
type StaffProfile = { id:string; platform_role:'owner'|'master_pro'|'pending'; company_members?:Member[] }
type Master = { id:string; display_name:string; slug:string; kind:'individual'|'company'; company_id:string|null; public_description:string; timezone:string; theme:{id?:string}|null; is_active:boolean; archived_at:string|null }
type Service = { id:string; name:string; description:string; duration:number; price:number; is_active:boolean }
type Hours = { id:string; weekday:number; opens_at:string; closes_at:string; is_day_off:boolean }
type Booking = { id:string; starts_at:string; ends_at:string; status:string; service_name_snapshot:string; price_snapshot:number; client_name_snapshot:string; client_phone_snapshot:string }

const weekdays=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота']

export default function StaffWorkspace({profile}:{profile:StaffProfile}) {
  const [masters,setMasters]=useState<Master[]>([])
  const [masterId,setMasterId]=useState('')
  const [services,setServices]=useState<Service[]>([])
  const [hours,setHours]=useState<Hours[]>([])
  const [bookings,setBookings]=useState<Booking[]>([])
  const [clients,setClients]=useState<{id:string;full_name:string;phone_e164:string}[]>([])
  const [newService,setNewService]=useState({name:'',description:'',duration:'60',price:'0'})
  const [editingServiceId,setEditingServiceId]=useState('')
  const [exceptionDate,setExceptionDate]=useState('')
  const [exceptionDayOff,setExceptionDayOff]=useState(true)
  const [exceptionOpens,setExceptionOpens]=useState('09:00')
  const [exceptionCloses,setExceptionCloses]=useState('18:00')
  const [pageName,setPageName]=useState('')
  const [pageDescription,setPageDescription]=useState('')
  const [photoUrl,setPhotoUrl]=useState('')
  const [timezone,setTimezone]=useState('Europe/Helsinki')
  const [theme,setTheme]=useState('natural')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const canEdit=profile.platform_role==='owner'||profile.platform_role==='master_pro'||profile.company_members?.some(m=>m.role==='admin')===true
  const canCancel=canEdit

  async function loadMasters(){
    if(!supabase)return
    let query=supabase.from('masters').select('id,display_name,slug,kind,company_id,public_description,photo_url,timezone,theme,is_active,archived_at').is('archived_at',null)
    if(profile.platform_role==='master_pro')query=query.eq('profile_id',profile.id)
    else if(profile.company_members?.some(m=>m.role==='master'))query=query.eq('id',profile.company_members.find(m=>m.role==='master')?.master_id??'')
    else if(profile.company_members?.some(m=>m.role==='admin'))query=query.eq('company_id',profile.company_members.find(m=>m.role==='admin')?.company_id??'')
    const {data,error:queryError}=await query.order('display_name')
    if(queryError){setError(queryError.message);return}
    setMasters((data??[]) as Master[])
    if(!masterId&&data?.[0])setMasterId(data[0].id)
  }

  async function loadMasterData(id:string){
    if(!supabase||!id)return
    const [serviceResult,hourResult,bookingResult,clientResult,masterResult]=await Promise.all([
      supabase.from('services').select('id,name,description,duration,price,is_active').eq('master_id',id).order('sort_order'),
      supabase.from('working_hours').select('id,weekday,opens_at,closes_at,is_day_off').eq('master_id',id).order('weekday'),
      supabase.from('bookings').select('id,starts_at,ends_at,status,service_name_snapshot,price_snapshot,client_name_snapshot,client_phone_snapshot').eq('master_id',id).order('starts_at',{ascending:false}).limit(50),
      supabase.from('clients').select('id,full_name,phone_e164').order('full_name').limit(100),
      supabase.from('masters').select('display_name,public_description,photo_url,theme,timezone').eq('id',id).single(),
    ])
    for(const result of [serviceResult,hourResult,bookingResult,clientResult,masterResult])if(result.error){setError(result.error.message);return}
    setServices((serviceResult.data??[]) as Service[])
    setHours((hourResult.data??[]) as Hours[])
    setBookings((bookingResult.data??[]) as Booking[])
    setClients((clientResult.data??[]) as {id:string;full_name:string;phone_e164:string}[])
    setPageName(masterResult.data?.display_name??'')
    setPageDescription(masterResult.data?.public_description??'')
    setPhotoUrl(masterResult.data?.photo_url??'')
    setTimezone(masterResult.data?.timezone??'Europe/Helsinki')
    setTheme(masterResult.data?.theme?.id??'natural')
  }

  useEffect(()=>{void loadMasters()},[profile.id,profile.platform_role])
  useEffect(()=>{if(masterId)void loadMasterData(masterId)},[masterId])

  async function addService(event:FormEvent){
    event.preventDefault()
    if(!supabase||!masterId)return
    setBusy(true);setError('');setNotice('')
    const payload={name:newService.name.trim(),description:newService.description,duration:Number(newService.duration),price:Number(newService.price)}
    const result=editingServiceId
      ? await supabase.from('services').update(payload).eq('id',editingServiceId)
      : await supabase.from('services').insert({...payload,master_id:masterId,is_active:true})
    if(result.error)setError(result.error.message)
    else{setNotice(editingServiceId?'Услуга обновлена.':'Услуга добавлена.');setEditingServiceId('');setNewService({name:'',description:'',duration:'60',price:'0'});await loadMasterData(masterId)}
    setBusy(false)
  }

  async function toggleService(service:Service){
    if(!supabase)return
    const {error:updateError}=await supabase.from('services').update({is_active:!service.is_active}).eq('id',service.id)
    if(updateError)setError(updateError.message);else await loadMasterData(masterId)
  }

  async function saveHours(day:number,opens:string,closes:string,dayOff:boolean,id?:string){
    if(!supabase||!masterId)return
    setBusy(true);setError('')
    const payload={master_id:masterId,weekday:day,opens_at:opens,closes_at:closes,is_day_off:dayOff}
    const result=id
      ? await supabase.from('working_hours').update(payload).eq('id',id)
      : await supabase.from('working_hours').insert(payload)
    if(result.error)setError(result.error.message)
    else{setNotice('Расписание сохранено.');await loadMasterData(masterId)}
    setBusy(false)
  }

  async function addDayOff(event:FormEvent){
    event.preventDefault()
    if(!supabase||!masterId||!exceptionDate)return
    setBusy(true);setError('')
    const {error:insertError}=await supabase.from('schedule_exceptions').upsert({
      master_id:masterId,exception_date:exceptionDate,is_day_off:exceptionDayOff,opens_at:exceptionDayOff?null:exceptionOpens,closes_at:exceptionDayOff?null:exceptionCloses,note:exceptionDayOff?'Выходной':'Изменённое расписание',
    },{onConflict:'master_id,exception_date'})
    if(insertError)setError(insertError.message);else{setNotice('Исключение расписания добавлено.');setExceptionDate('')}
    setBusy(false)
  }

  async function savePage(event:FormEvent){
    event.preventDefault()
    if(!supabase||!masterId)return
    setBusy(true);setError('')
    const current=masters.find(m=>m.id===masterId)
    const payload:Record<string,unknown>={display_name:pageName.trim(),public_description:pageDescription,photo_url:photoUrl.trim()||null,timezone}
    if(current?.kind==='individual')payload.theme={id:theme}
    const {error:updateError}=await supabase.from('masters').update(payload).eq('id',masterId)
    if(updateError)setError(updateError.message)
    else{
      if(current?.company_id&&profile.company_members?.some(m=>m.role==='admin')){
        // Company theme is stored once and inherited by all its master pages.
      }
      setNotice('Страница сохранена.');await loadMasterData(masterId)
    }
    setBusy(false)
  }

  async function cancelBooking(id:string){
    if(!supabase)return
    const {error:cancelError}=await supabase.rpc('cancel_booking',{p_booking_id:id})
    if(cancelError)setError(cancelError.message);else{setNotice('Запись отменена.');await loadMasterData(masterId)}
  }

  if(!masters.length)return <section className="admin-card"><h2>Рабочее пространство</h2><p>Пока нет доступных страниц мастеров. Проверьте назначение роли и связь с публичной страницей.</p></section>

  return <section className="workspace">
    <div className="admin-section-head"><div><span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span><h2>Мастер</h2></div>
      {masters.length>1&&<select value={masterId} onChange={e=>setMasterId(e.target.value)}>{masters.map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}</select>}
    </div>
    {error&&<p className="admin-error">{error}</p>}{notice&&<p className="admin-notice">{notice}</p>}
    {canEdit&&<form className="admin-card workspace-section" onSubmit={savePage}><h3>Страница мастера</h3>
      <label className="admin-field">Имя<input value={pageName} onChange={e=>setPageName(e.target.value)} required /></label>
      <label className="admin-field">Описание<textarea value={pageDescription} onChange={e=>setPageDescription(e.target.value)} rows={3}/></label>
      <label className="admin-field">Ссылка на фотографию<input value={photoUrl} onChange={e=>setPhotoUrl(e.target.value)} placeholder="https://…"/></label>\n      <label className="admin-field">Часовой пояс (IANA)<input value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="Europe/Helsinki" required/></label>
      {profile.platform_role==='master_pro'&&<label className="admin-field">Цветовая тема<select value={theme} onChange={e=>setTheme(e.target.value)}><option value="natural">Natural</option><option value="graphite">Graphite</option><option value="sand">Sand</option><option value="green">Deep Green</option><option value="blue">Midnight Blue</option><option value="dark">Dark</option></select></label>}
      <button className="primary-button" disabled={busy}>Сохранить страницу</button>
    </form>}
    {canEdit&&<section className="admin-card workspace-section"><h3>Услуги</h3>
      <form className="workspace-service-form" onSubmit={addService}>
        <label className="admin-field">Название<input value={newService.name} onChange={e=>setNewService({...newService,name:e.target.value})} required /></label>
        <label className="admin-field">Описание<input value={newService.description} onChange={e=>setNewService({...newService,description:e.target.value})}/></label>
        <label className="admin-field">Длительность, мин<input type="number" min="1" max="720" value={newService.duration} onChange={e=>setNewService({...newService,duration:e.target.value})}/></label>
        <label className="admin-field">Цена<input type="number" min="0" step="0.01" value={newService.price} onChange={e=>setNewService({...newService,price:e.target.value})}/></label>
        <button className="primary-button" disabled={busy}>{editingServiceId?'Сохранить изменения':'Добавить услугу'}</button>{editingServiceId&&<button type="button" className="secondary-button" onClick={()=>{setEditingServiceId('');setNewService({name:'',description:'',duration:'60',price:'0'})}}>Отмена</button>}
      </form>
      <div className="admin-account-list">{services.map(service=><article className="admin-account" key={service.id}><div><strong>{service.name}</strong><span>{service.duration} мин. · {new Intl.NumberFormat('ru-RU').format(service.price)} ₽</span></div><button className="secondary-button" onClick={()=>{setEditingServiceId(service.id);setNewService({name:service.name,description:service.description,duration:String(service.duration),price:String(service.price)})}}>Редактировать</button><button className="secondary-button" onClick={()=>void toggleService(service)}>{service.is_active?'Отключить':'Включить'}</button></article>)}</div>
    </section>}
    {canEdit&&<section className="admin-card workspace-section"><h3>Рабочее расписание</h3>
      <div className="workspace-hours">{weekdays.map((day,index)=>{const row=hours.find(h=>h.weekday===index);return <HoursRow key={index} label={day} row={row} disabled={busy} onSave={(opens,closes,off)=>void saveHours(index,opens,closes,off,row?.id)}/>})}</div>
      <form className="workspace-exception" onSubmit={addDayOff}><label className="admin-field">Дата исключения<input type="date" value={exceptionDate} onChange={e=>setExceptionDate(e.target.value)} required/></label><label className="admin-field">Тип<select value={exceptionDayOff?'off':'hours'} onChange={e=>setExceptionDayOff(e.target.value==='off')}><option value="off">Выходной</option><option value="hours">Изменить часы</option></select></label>{!exceptionDayOff&&<><label className="admin-field">Начало<input type="time" value={exceptionOpens} onChange={e=>setExceptionOpens(e.target.value)}/></label><label className="admin-field">Окончание<input type="time" value={exceptionCloses} onChange={e=>setExceptionCloses(e.target.value)}/></label></>}<button className="secondary-button" disabled={busy||(!exceptionDayOff&&exceptionCloses<=exceptionOpens)}>Сохранить исключение</button></form>
    </section>}
    <section className="admin-card workspace-section"><h3>Записи</h3>
      <div className="admin-account-list">{bookings.map(booking=><article className="admin-account" key={booking.id}><div><strong>{booking.client_name_snapshot} · {booking.service_name_snapshot}</strong><span>{new Date(booking.starts_at).toLocaleString('ru-RU')} · {booking.client_phone_snapshot}</span></div><span className="admin-role">{booking.status}</span>{canCancel&&booking.status==='confirmed'&&<button className="secondary-button" onClick={()=>void cancelBooking(booking.id)}>Отменить</button>}</article>)}</div>
    </section>
    <section className="admin-card workspace-section"><h3>Клиентская база</h3><div className="admin-account-list">{clients.map(client=><article className="admin-account" key={client.id}><div><strong>{client.full_name}</strong><span>{client.phone_e164}</span></div></article>)}</div></section>
  </section>
}

function HoursRow({label,row,disabled,onSave}:{label:string;row?:Hours;disabled:boolean;onSave:(opens:string,closes:string,off:boolean)=>void}){
  const [opens,setOpens]=useState(row?.opens_at?.slice(0,5)??'09:00')
  const [closes,setCloses]=useState(row?.closes_at?.slice(0,5)??'18:00')
  const [off,setOff]=useState(row?.is_day_off??true)
  useEffect(()=>{setOpens(row?.opens_at?.slice(0,5)??'09:00');setCloses(row?.closes_at?.slice(0,5)??'18:00');setOff(row?.is_day_off??true)},[row?.id,row?.opens_at,row?.closes_at,row?.is_day_off])
  return <div className="workspace-hour-row"><strong>{label}</strong><label><input type="checkbox" checked={!off} onChange={e=>setOff(!e.target.checked)}/>Рабочий день</label><input type="time" value={opens} onChange={e=>setOpens(e.target.value)} disabled={off}/><span>—</span><input type="time" value={closes} onChange={e=>setCloses(e.target.value)} disabled={off}/><button className="secondary-button" disabled={disabled||(!off&&closes<=opens)} onClick={()=>onSave(opens,closes,off)}>Сохранить</button></div>
}
