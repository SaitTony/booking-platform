import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import './MasterProBuilder.css'

type Section = 'home' | 'profile' | 'design' | 'services' | 'schedule' | 'bookings' | 'settings'
type Theme = 'natural' | 'graphite' | 'sand' | 'green' | 'blue' | 'dark'
type Service = { id: string; name: string; description: string; duration: number; price: number; active: boolean }
type Booking = { id:string; starts_at:string; ends_at:string; status:string; service_name_snapshot:string; price_snapshot:number; client_name_snapshot:string; client_phone_snapshot:string }
type ScheduleException = { id:string; exception_date:string; is_day_off:boolean; opens_at:string|null; closes_at:string|null; note:string|null }

const themeNames: Record<Theme,string> = { natural:'Natural', graphite:'Graphite', sand:'Sand', green:'Deep Green', blue:'Midnight Blue', dark:'Dark' }
const week = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
const money = (value:number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'

export default function MasterProBuilder() {
  const [section,setSection] = useState<Section>('home')
  const [welcomeVisible,setWelcomeVisible] = useState(false)
  const [profileId,setProfileId] = useState('')
  const [bookings,setBookings] = useState<Booking[]>([])
  const [bookingSearch,setBookingSearch] = useState('')
  const [bookingStatus,setBookingStatus] = useState('all')
  const [bookingFrom,setBookingFrom] = useState('')
  const [bookingTo,setBookingTo] = useState('')
  const [bufferMinutes,setBufferMinutes] = useState('0')
  const [exceptions,setExceptions] = useState<ScheduleException[]>([])
  const [exceptionDate,setExceptionDate] = useState('')
  const [exceptionDayOff,setExceptionDayOff] = useState(true)
  const [exceptionOpens,setExceptionOpens] = useState('09:00')
  const [exceptionCloses,setExceptionCloses] = useState('18:00')
  const [name,setName] = useState('')
  const [specialty,setSpecialty] = useState('')
  const [description,setDescription] = useState('')
  const [photo,setPhoto] = useState('')
  const [coverImage,setCoverImage] = useState('')
  const [photoFile,setPhotoFile] = useState<File|null>(null)
  const [coverFile,setCoverFile] = useState<File|null>(null)
  const [coverTitle,setCoverTitle] = useState('')
  const [theme,setTheme] = useState<Theme>('natural')
  const [services,setServices] = useState<Service[]>([])
  const [pageTags,setPageTags] = useState<string[]>([])
  const [customTag,setCustomTag] = useState('')
  const availableTags = ['Частная практика','По записи','Онлайн-консультация','Выезд к клиенту','Принимаю новых клиентов','Оплата картой']
  const [selectedService,setSelectedService] = useState<string | null>(null)
  const [newService,setNewService] = useState({name:'',description:'',duration:'60',price:'0'})
  const [hours,setHours] = useState(week.map(()=>({enabled:false,opens:'09:00',closes:'18:00'})))
  const [timezone,setTimezone] = useState('Europe/Moscow')
  const [horizon,setHorizon] = useState('30')
  const [device,setDevice] = useState<'desktop'|'mobile'>('desktop')
  const [previewTab,setPreviewTab] = useState<'page'|'booking'>('page')
  const [,setSaved] = useState(false)
  const [showPublish,setShowPublish] = useState(false)
  const [masterId,setMasterId] = useState<string | null>(null)
  const [masterSlug,setMasterSlug] = useState('')
  const [pageActive,setPageActive] = useState(false)
  const [publishing,setPublishing] = useState(false)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [saveMessage,setSaveMessage] = useState('')
  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLocaleLowerCase('ru')
    return bookings.filter(item => {
      const day = item.starts_at.slice(0,10)
      const matchesStatus = bookingStatus === 'all' || item.status === bookingStatus
      const matchesDate = (!bookingFrom || day >= bookingFrom) && (!bookingTo || day <= bookingTo)
      const matchesText = !query || [item.client_name_snapshot,item.client_phone_snapshot,item.service_name_snapshot].some(value => String(value ?? '').toLocaleLowerCase('ru').includes(query))
      return matchesStatus && matchesDate && matchesText
    })
  },[bookings,bookingSearch,bookingStatus,bookingFrom,bookingTo])
  const confirmedBookings = bookings.filter(item=>item.status==='confirmed').length
  const completedBookings = bookings.filter(item=>item.status==='completed').length
  const todayKey = new Date().toLocaleDateString('en-CA')
  const todayBookings = bookings.filter(item=>item.starts_at.slice(0,10)===todayKey).length
  const moneyTotal = bookings.filter(item=>item.status==='completed').reduce((sum,item)=>sum+Number(item.price_snapshot||0),0)
  const activeServices = services.filter(item=>item.active)
  const currentService = activeServices.find(item=>item.id===selectedService) ?? activeServices[0]
  const activeDays = useMemo(()=>hours.filter(item=>item.enabled).length,[hours])
  const sections: {id:Section;number:string;symbol:string;title:string;sub:string}[] = [
    {id:'home',number:'01',symbol:'⌂',title:'Обзор',sub:'Сводка по странице и записям'},
    {id:'profile',number:'02',symbol:'●',title:'Моя страница',sub:'Профиль и оформление'},
    {id:'services',number:'03',symbol:'▤',title:'Услуги',sub:'Каталог, цены и длительность'},
    {id:'schedule',number:'04',symbol:'◷',title:'Расписание',sub:'Рабочие дни, паузы и исключения'},
    {id:'bookings',number:'05',symbol:'▦',title:'Записи',sub:'Клиенты, статусы и даты'},
    {id:'settings',number:'06',symbol:'⚙',title:'Настройки',sub:'Часовой пояс и параметры записи'},
  ]

  function addService(){
    if(!newService.name.trim())return
    const item={id:crypto.randomUUID(),name:newService.name.trim(),description:newService.description,duration:Math.max(1,Number(newService.duration)||60),price:Math.max(0,Number(newService.price)||0),active:true}
    setServices(current=>[...current,item]);setSelectedService(item.id);setNewService({name:'',description:'',duration:'60',price:'0'});setSaved(false)
  }

  useEffect(()=>{
    let cancelled=false
    async function loadPage(){
      try{
        if(!supabase) throw new Error('Supabase не настроен')
        const {data:{user},error:userError}=await supabase.auth.getUser()
        if(userError) throw userError
        if(!user) throw new Error('Войдите в систему через административную панель')
        setProfileId(user.id)
        setWelcomeVisible(localStorage.getItem('workflows-master-pro-welcome-'+user.id)!=='seen')
        const {data:master,error:masterError}=await supabase.from('masters').select('id,slug,is_active,display_name,public_description,photo_url,cover_url,timezone,theme').eq('profile_id',user.id).eq('kind','individual').maybeSingle()
        if(masterError) throw masterError
        if(!master) throw new Error('Для этой учётной записи не найдена индивидуальная страница Master_pro')
        const [serviceResult,hourResult,settingsResult,bookingResult,exceptionResult]=await Promise.all([
          supabase.from('services').select('id,name,description,duration,price,is_active').eq('master_id',master.id).order('sort_order'),
          supabase.from('working_hours').select('weekday,opens_at,closes_at,is_day_off').eq('master_id',master.id),
          supabase.from('booking_settings').select('booking_horizon_days,buffer_minutes').eq('master_id',master.id).maybeSingle(),
          supabase.from('bookings').select('id,starts_at,ends_at,status,service_name_snapshot,price_snapshot,client_name_snapshot,client_phone_snapshot').eq('master_id',master.id).order('starts_at',{ascending:false}).limit(500),
          supabase.from('schedule_exceptions').select('id,exception_date,is_day_off,opens_at,closes_at,note').eq('master_id',master.id).gte('exception_date',new Date().toLocaleDateString('en-CA')).order('exception_date').limit(100),
        ])
        for(const result of [serviceResult,hourResult,settingsResult,bookingResult,exceptionResult])if(result.error)throw result.error
        if(cancelled) return
        setMasterId(master.id)
        setMasterSlug(master.slug)
        setPageActive(master.is_active)
        setName(master.display_name||'')
        setDescription(master.public_description||'')
        setPhoto(master.photo_url||'')
        setCoverImage(master.cover_url||'')
        setTimezone(master.timezone||'Europe/Moscow')
        const metadata=(master.theme&&typeof master.theme==='object'?master.theme:{}) as Record<string,unknown>
        setTheme((metadata.id as Theme)||'natural')
        setSpecialty(typeof metadata.specialty==='string'?metadata.specialty:'')
        setCoverTitle(typeof metadata.cover_title==='string'?metadata.cover_title:'')
        setPageTags(Array.isArray(metadata.tags)?metadata.tags.filter((tag):tag is string=>typeof tag==='string'):[])
        setServices((serviceResult.data||[]).map(item=>({id:item.id,name:item.name,description:item.description,duration:item.duration,price:Number(item.price),active:item.is_active})))
        setHours(week.map((_,index)=>{
          const weekday=(index+1)%7
          const row=(hourResult.data||[]).find(item=>item.weekday===weekday)
          return row?{enabled:!row.is_day_off,opens:row.opens_at.slice(0,5),closes:row.closes_at.slice(0,5)}:{enabled:false,opens:'09:00',closes:'18:00'}
        }))
        if(settingsResult.data){setHorizon(String(settingsResult.data.booking_horizon_days));setBufferMinutes(String(settingsResult.data.buffer_minutes??0))}
        setBookings((bookingResult.data??[]) as Booking[])
        setExceptions((exceptionResult.data??[]) as ScheduleException[])
      }catch(error){if(!cancelled)setSaveMessage(error instanceof Error?error.message:'Не удалось загрузить страницу')}
      finally{if(!cancelled)setLoading(false)}
    }
    void loadPage()
    return ()=>{cancelled=true}
  },[])

  async function togglePagePublication(){
    if(!supabase||!masterId||publishing)return
    setPublishing(true);setSaveMessage('')
    try{
      const {data,error}=await supabase.from('masters').update({is_active:!pageActive}).eq('id',masterId).select('id,is_active').maybeSingle()
      if(error)throw error
      if(!data)throw new Error('Недостаточно прав для изменения статуса публикации страницы')
      setPageActive(data.is_active)
      setSaveMessage(data.is_active?'Страница опубликована.':'Страница отключена.')
    }catch(error){setSaveMessage(error instanceof Error?error.message:'Не удалось изменить статус страницы')}
    finally{setPublishing(false)}
  }

  async function savePage(){
    if(!supabase||!masterId)return
    if(!name.trim()){setSaveMessage('Укажите имя и фамилию перед сохранением');setSection('profile');return}
    if(services.some(item=>!item.name.trim()||item.duration<1||item.duration>720||item.price<0)){setSaveMessage('Проверьте названия, длительность и стоимость услуг');setSection('services');return}
    if(hours.some(item=>item.enabled&&item.closes<=item.opens)){setSaveMessage('Время окончания рабочего дня должно быть позже начала');setSection('schedule');return}
    if(!Number.isInteger(Number(bufferMinutes))||Number(bufferMinutes)<0||Number(bufferMinutes)>240){setSaveMessage('Пауза между записями должна быть от 0 до 240 минут');setSection('schedule');return}
    setSaving(true);setSaveMessage('')
    try{
      const uploadAsset=async(file:File,kind:'profile'|'cover')=>{
        const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'
        const path=`${masterId}/${kind}-${crypto.randomUUID()}.${extension}`
        const {error:uploadError}=await supabase!.storage.from('master-assets').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type})
        if(uploadError)throw uploadError
        return supabase!.storage.from('master-assets').getPublicUrl(path).data.publicUrl
      }
      const photoUrl=photoFile?await uploadAsset(photoFile,'profile'):photo
      const coverUrl=coverFile?await uploadAsset(coverFile,'cover'):coverImage
      const workingRows=hours.flatMap((item,index)=>item.enabled?[{weekday:(index+1)%7,opens_at:item.opens,closes_at:item.closes}]:[])
      const {error}=await supabase.rpc('save_master_pro_builder',{
        p_master_id:masterId,
        p_display_name:name.trim(),
        p_description:description.trim(),
        p_timezone:timezone,
        p_theme:{id:theme,specialty:specialty.trim(),cover_title:coverTitle.trim(),tags:pageTags},
        p_photo_url:photoUrl||null,
        p_cover_url:coverUrl||null,
        p_services:services.map((item,index)=>({id:item.id,name:item.name.trim(),description:item.description.trim(),duration:item.duration,price:item.price,active:item.active,sort_order:index})),
        p_working_hours:workingRows,
        p_booking_horizon_days:Number(horizon),
         p_buffer_minutes:Number(bufferMinutes),
      })
      if(error)throw error
      setPhoto(photoUrl);setCoverImage(coverUrl);setPhotoFile(null);setCoverFile(null)
      setSaveMessage('Изменения и изображения успешно сохранены в базе данных')
    }catch(error){setSaveMessage(error instanceof Error?error.message:'Не удалось сохранить изменения')}
    finally{setSaving(false)}
  }

  async function saveScheduleException(){
    if(!supabase||!masterId||!exceptionDate)return
    if(!exceptionDayOff&&exceptionCloses<=exceptionOpens){setSaveMessage('Время окончания должно быть позже начала');return}
    setSaving(true);setSaveMessage('')
    const {error}=await supabase.from('schedule_exceptions').upsert({master_id:masterId,exception_date:exceptionDate,is_day_off:exceptionDayOff,opens_at:exceptionDayOff?null:exceptionOpens,closes_at:exceptionDayOff?null:exceptionCloses,note:exceptionDayOff?'Выходной':'Особое расписание'},{onConflict:'master_id,exception_date'})
    if(error)setSaveMessage(error.message)
    else{setSaveMessage('Исключение расписания сохранено');setExceptionDate('');const {data}=await supabase.from('schedule_exceptions').select('id,exception_date,is_day_off,opens_at,closes_at,note').eq('master_id',masterId).gte('exception_date',new Date().toLocaleDateString('en-CA')).order('exception_date').limit(100);setExceptions((data??[]) as ScheduleException[])}
    setSaving(false)
  }
  async function deleteScheduleException(id:string){
    if(!supabase)return
    const {error}=await supabase.from('schedule_exceptions').delete().eq('id',id)
    if(error)setSaveMessage(error.message);else setExceptions(current=>current.filter(item=>item.id!==id))
  }
  async function cancelBooking(id:string){
    if(!supabase)return
    const {error}=await supabase.rpc('cancel_booking',{p_booking_id:id})
    if(error)setSaveMessage(error.message);else{setBookings(current=>current.map(item=>item.id===id?{...item,status:'cancelled'}:item));setSaveMessage('Запись отменена')}
  }
  function dismissWelcome(){
    if(profileId)localStorage.setItem('workflows-master-pro-welcome-'+profileId,'seen')
    setWelcomeVisible(false)
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>, setter: (value:string)=>void, fileSetter:(value:File|null)=>void){
    const file=event.target.files?.[0]
    if(!file)return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setSaveMessage('Поддерживаются только JPG, PNG и WebP');event.target.value='';return}
    if(file.size>5*1024*1024){setSaveMessage('Размер изображения не должен превышать 5 МБ');event.target.value='';return}
    setter(URL.createObjectURL(file));fileSetter(file);setSaved(false);setSaveMessage('')
  }


  if(loading)return <main className="mpb-shell"><div className="mpb-page-head"><h1>Загрузка страницы…</h1></div></main>
  if(!masterId)return <main className="mpb-shell"><div className="mpb-page-head"><div><h1>Нет доступа к конструктору</h1><p>{saveMessage||'Не удалось определить вашу страницу Master_pro.'}</p></div><Link to="/admin" className="mpb-secondary">Вернуться в Админ-панель</Link></div></main>
  return <main className="mpb-shell">
    <header className="mpb-topbar">
      <div className="mpb-brand"><span className="mpb-brand-mark">W</span><span>Workflows <small>· Конструктор Master_pro</small></span></div>
      <div className="mpb-top-actions"><span className={`mpb-draft-status ${pageActive?'is-published':''}`}><i/> {publishing?'Обновление статуса…':saving?'Сохранение…':pageActive?'Опубликована':'Черновик'}</span><button type="button" className="mpb-publication-toggle" onClick={()=>void togglePagePublication()} disabled={publishing||saving}>{publishing?(pageActive?'Отключаем…':'Публикуем…'):pageActive?'Отключить страницу':'Опубликовать страницу'}</button></div>
    </header>
    <div className="mpb-page-head">
      <div><span className="mpb-eyebrow">ЛИЧНЫЙ КАБИНЕТ MASTER_PRO</span><h1>Рабочее пространство</h1><p>Управляйте страницей, расписанием, услугами и записями клиентов в одном месте.</p></div>
      <div className="mpb-page-actions"><Link to="/admin" className="mpb-secondary">Вернуться в Админ-панель</Link><button className="mpb-primary" onClick={()=>void savePage()} disabled={loading||saving||!masterId}>{saving?'Сохраняем…':'Сохранить изменения'}</button></div>
    </div>
    {welcomeVisible&&<section className="mpb-welcome"><div><span className="mpb-eyebrow">ДОБРО ПОЖАЛОВАТЬ В WORKFLOWS</span><h2>Здравствуйте, {name||'рады видеть вас'}!</h2><p>Это ваше личное пространство. Здесь вы оформляете индивидуальную страницу, настраиваете рабочее расписание и управляете записями клиентов. Начните с заполнения страницы и добавления услуг.</p></div><button type="button" className="mpb-secondary" onClick={dismissWelcome}>Понятно, начать работу</button></section>}
    <div className="mpb-workspace">
      <aside className="mpb-sidebar">
        
        <nav>{sections.map(item=><button key={item.id} className={section===item.id?'is-active':''} onClick={()=>setSection(item.id)}><span className="mpb-step-symbol" aria-hidden="true">{item.symbol}</span><span className="mpb-step">{item.number}</span><span className="mpb-nav-copy"><strong>{item.title}</strong><small>{item.sub}</small></span></button>)}</nav>
        <div className="mpb-sidebar-bottom"><div className="mpb-completion"><div><strong>Готовность страницы</strong><b>60%</b></div><span><i/></span><small>Заполните разделы и проверьте предпросмотр</small></div><div className="mpb-help"><strong>Нужна помощь?</strong><span>Подсказки по настройке страницы</span></div></div>
      </aside>
      <section className="mpb-editor">
        {saveMessage&&<div className="mpb-tip" role="status"><span>{saveMessage}</span></div>}
        <div className="mpb-editor-heading"><div><span className="mpb-eyebrow">РАЗДЕЛ {sections.findIndex(x=>x.id===section)+1} ИЗ {sections.length}</span><h2>{sections.find(x=>x.id===section)?.title}</h2><p>{sections.find(x=>x.id===section)?.sub}</p></div><span className="mpb-live-indicator"><i/> Данные из вашей страницы</span></div>
        {section==='home'&&<div className="mpb-dashboard"><div className="mpb-dashboard-cards"><article><span>Активные записи</span><strong>{confirmedBookings}</strong><small>Ожидают визита</small></article><article><span>Сегодня</span><strong>{todayBookings}</strong><small>Записей на сегодня</small></article><article><span>Завершено</span><strong>{completedBookings}</strong><small>Вся история</small></article><article><span>Выручка</span><strong>{money(moneyTotal)}</strong><small>По завершённым записям</small></article></div><div className="mpb-dashboard-panels"><section><h3>Ваша страница</h3><p>{name||'Имя пока не указано'} · {pageActive?'Опубликована':'Не опубликована'}</p><a href={window.location.origin+import.meta.env.BASE_URL+'pro/'+masterSlug} target="_blank" rel="noreferrer">Открыть публичную страницу ↗</a><button type="button" className="mpb-secondary" onClick={()=>setSection('profile')}>Редактировать страницу</button></section><section><h3>Ближайшие записи</h3>{bookings.filter(item=>item.status==='confirmed'&&new Date(item.starts_at).getTime()>=Date.now()).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)).slice(0,4).map(item=><div className="mpb-upcoming-row" key={item.id}><strong>{new Date(item.starts_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</strong><span>{item.client_name_snapshot} · {item.service_name_snapshot}</span></div>)}{confirmedBookings===0&&<p>Активных записей пока нет.</p>}<button type="button" className="mpb-secondary" onClick={()=>setSection('bookings')}>Все записи</button></section></div></div>}
        {section==='profile'&&<div className="mpb-form-stack">
          <div className="mpb-field"><label>Специализация</label><input value={specialty} onChange={e=>{setSpecialty(e.target.value);setSaved(false)}} placeholder="Например, стилист"/><small>Коротко обозначьте направление вашей работы. На публичной странице она будет указана над именем.</small></div>
          <div className="mpb-field"><label>Имя и фамилия <em>Обязательно</em></label><input value={name} onChange={e=>{setName(e.target.value);setSaved(false)}} placeholder="Например, Анна Смирнова"/><small>Это имя будет отображаться в верхней части вашей страницы.</small></div>
          <div className="mpb-field"><label>О себе</label><textarea rows={5} value={description} onChange={e=>{setDescription(e.target.value);setSaved(false)}} placeholder="Расскажите о себе и своём подходе..."/><small>Несколько предложений, которые помогут клиенту познакомиться с вами.</small></div>
          <div className="mpb-field"><label>Теги страницы</label><small>Выберите отметки, которые будут отображаться в публичном профиле. Устанавливает владелец страницы.</small><div className="mpb-tag-options">{availableTags.map(tag=><label key={tag} className={pageTags.includes(tag)?'is-selected':''}><input type="checkbox" checked={pageTags.includes(tag)} onChange={e=>{setPageTags(current=>e.target.checked?[...current,tag]:current.filter(value=>value!==tag));setSaved(false)}}/><span>{tag}</span></label>)}</div><div className="mpb-custom-tag"><input value={customTag} onChange={e=>setCustomTag(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const tag=customTag.trim();if(tag&&!pageTags.includes(tag)){setPageTags(current=>[...current,tag]);setSaved(false)}setCustomTag('')}}} placeholder="Добавить свой тег"/><button type="button" className="mpb-secondary" disabled={!customTag.trim()||pageTags.includes(customTag.trim())} onClick={()=>{const tag=customTag.trim();if(tag&&!pageTags.includes(tag)){setPageTags(current=>[...current,tag]);setSaved(false)}setCustomTag('')}}>Добавить тег</button></div></div>
          <div className="mpb-field"><label>Текст на обложке</label><input value={coverTitle} onChange={e=>{setCoverTitle(e.target.value);setSaved(false)}} placeholder="Например, PERSONAL SPACE"/><small>Короткая фраза в верхней части публичной страницы.</small></div>

          <div className="mpb-tip"><strong>Совет</strong><span>Используйте портрет, на котором хорошо видно ваше лицо. Он будет показан рядом с именем на публичной странице.</span></div>
        </div>}
        {section==='profile'&&<div className="mpb-form-stack">
          <div className="mpb-field"><label>Фотография профиля</label><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,setPhoto,setPhotoFile)}/><small>JPG, PNG или WebP, до 5 МБ. Изображение будет сохранено вместе с изменениями страницы.</small>{photo&&<div className="mpb-upload-controls"><img className="mpb-upload-preview" src={photo} alt="Предпросмотр фотографии профиля"/><button type="button" className="mpb-text-button mpb-delete-button" onClick={()=>{setPhoto('');setPhotoFile(null);setSaved(false)}}>Удалить фотографию</button></div>}</div>
          <div className="mpb-field"><label>Изображение обложки</label><input type="file" accept="image/*" onChange={e=>handleImageUpload(e,setCoverImage,setCoverFile)}/><small>JPG, PNG или WebP, до 5 МБ. Изображение будет сохранено вместе с изменениями страницы.</small>{coverImage&&<div className="mpb-upload-controls"><img className="mpb-upload-preview mpb-cover-upload-preview" src={coverImage} alt="Предпросмотр изображения обложки"/><button type="button" className="mpb-text-button mpb-delete-button" onClick={()=>{setCoverImage('');setCoverFile(null);setSaved(false)}}>Удалить изображение</button></div>}</div>
          <div className="mpb-field"><label>Цветовая тема</label><small>Выберите оформление. Клиенты увидят готовую тему — переключателя на публичной странице не будет.</small></div>
          <div className="mpb-theme-grid">{(Object.keys(themeNames) as Theme[]).map(id=><button key={id} className={theme===id?'selected':''} onClick={()=>{setTheme(id);setSaved(false)}}><span className={'mpb-theme-swatch theme-'+id}><i/><i/><i/><i/></span><strong>{themeNames[id]}</strong>{theme===id&&<b>Выбрана</b>}</button>)}</div>
          <div className="mpb-tip"><strong>Предпросмотр</strong><span>Цветовая схема применяется ко всей публичной странице, включая карточки услуг, календарь и кнопки записи.</span></div>
        </div>}
        {section==='services'&&<div className="mpb-form-stack">
          <div className="mpb-section-line"><div><strong>Ваши услуги</strong><small>{activeServices.length} активные услуги</small></div><span>Порядок можно будет менять перетаскиванием</span></div>
          <div className="mpb-service-editor">{services.map(item=><article key={item.id} className={!item.active?'is-disabled':''}><div className="mpb-service-editor-main"><strong>{item.name}</strong><small>{item.duration} мин. · {money(item.price)}</small><p>{item.description}</p></div><div className="mpb-service-actions"><button className="mpb-text-button" onClick={()=>{setServices(all=>all.map(s=>s.id===item.id?{...s,active:!s.active}:s));setSaved(false)}}>{item.active?'Отключить':'Включить'}</button><button className="mpb-text-button mpb-delete-button" onClick={()=>{setServices(all=>all.filter(s=>s.id!==item.id));if(selectedService===item.id)setSelectedService(null);setSaved(false)}}>Удалить</button></div></article>)}{!services.length&&<div className="mpb-services-empty">Услуги пока не добавлены. Создайте первую услугу ниже.</div>}</div>
          <div className="mpb-add-service"><h3>Добавить услугу</h3><div className="mpb-field"><label>Название</label><input value={newService.name} onChange={e=>setNewService({...newService,name:e.target.value})} placeholder="Например, Стрижка"/></div><div className="mpb-field"><label>Описание</label><textarea rows={2} value={newService.description} onChange={e=>setNewService({...newService,description:e.target.value})} placeholder="Что входит в услугу?"/></div><div className="mpb-two-cols"><div className="mpb-field"><label>Длительность, минут</label><input type="number" min="1" max="720" value={newService.duration} onChange={e=>setNewService({...newService,duration:e.target.value})}/></div><div className="mpb-field"><label>Стоимость, ₽</label><input type="number" min="0" step="50" value={newService.price} onChange={e=>setNewService({...newService,price:e.target.value})}/></div></div><button className="mpb-secondary" onClick={addService} disabled={!newService.name.trim()}>Добавить услугу</button></div>
        </div>}
        {section==='schedule'&&<div className="mpb-form-stack">
          <div className="mpb-schedule-intro"><strong>Регулярное расписание</strong><span>{activeDays} рабочих дней в неделю</span><p>Укажите стандартные часы. Отметьте рабочие дни и задайте часы приёма. Для отдельных дат можно назначить выходной или изменить время работы.</p></div>
          <div className="mpb-week-list">{hours.map((item,index)=><div className={!item.enabled?'day-off':''} key={week[index]}><strong>{week[index]}</strong><label className="mpb-toggle"><input type="checkbox" checked={item.enabled} onChange={e=>{setHours(all=>all.map((h,i)=>i===index?{...h,enabled:e.target.checked}:h));setSaved(false)}}/><span/></label><input aria-label={'Начало '+week[index]} type="time" value={item.opens} disabled={!item.enabled} onChange={e=>setHours(all=>all.map((h,i)=>i===index?{...h,opens:e.target.value}:h))}/><span>—</span><input aria-label={'Окончание '+week[index]} type="time" value={item.closes} disabled={!item.enabled} onChange={e=>setHours(all=>all.map((h,i)=>i===index?{...h,closes:e.target.value}:h))}/></div>)}</div>
          <div className="mpb-field"><label>Пауза между записями, минут</label><select value={bufferMinutes} onChange={e=>{setBufferMinutes(e.target.value);setSaved(false)}}><option value="0">Без паузы</option><option value="5">5 минут</option><option value="10">10 минут</option><option value="15">15 минут</option><option value="20">20 минут</option><option value="30">30 минут</option><option value="45">45 минут</option><option value="60">60 минут</option></select><small>Пауза будет учитываться при расчёте доступного времени и не позволит клиентам записаться вплотную друг к другу.</small></div><section className="mpb-exceptions"><div className="mpb-section-line"><div><strong>Особые даты</strong><small>Выходные и индивидуальные часы на выбранный день</small></div></div><div className="mpb-exception-form"><label className="mpb-field">Дата<input type="date" min={new Date().toLocaleDateString('en-CA')} value={exceptionDate} onChange={e=>setExceptionDate(e.target.value)}/></label><label className="mpb-field">Тип дня<select value={exceptionDayOff?'off':'working'} onChange={e=>setExceptionDayOff(e.target.value==='off')}><option value="off">Выходной</option><option value="working">Особые рабочие часы</option></select></label>{!exceptionDayOff&&<><label className="mpb-field">С<input type="time" value={exceptionOpens} onChange={e=>setExceptionOpens(e.target.value)}/></label><label className="mpb-field">До<input type="time" value={exceptionCloses} onChange={e=>setExceptionCloses(e.target.value)}/></label></>}<button type="button" className="mpb-secondary" disabled={!exceptionDate||saving} onClick={()=>void saveScheduleException()}>Добавить дату</button></div><div className="mpb-exception-list">{exceptions.map(item=><div key={item.id}><strong>{new Date(item.exception_date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</strong><span>{item.is_day_off?'Выходной':(item.opens_at||'').slice(0,5)+'–'+(item.closes_at||'').slice(0,5)}</span><button type="button" className="mpb-text-button mpb-delete-button" onClick={()=>void deleteScheduleException(item.id)}>Удалить</button></div>)}{!exceptions.length&&<p>Особые даты пока не заданы.</p>}</div></section>
        </div>}
        {section==='bookings'&&<div className="mpb-form-stack"><div className="mpb-booking-stats"><span>Активные <b>{confirmedBookings}</b></span><span>Выполнено <b>{completedBookings}</b></span><span>Всего <b>{bookings.length}</b></span></div><div className="mpb-booking-filters"><input value={bookingSearch} onChange={e=>setBookingSearch(e.target.value)} placeholder="Поиск по имени, телефону или услуге"/><select value={bookingStatus} onChange={e=>setBookingStatus(e.target.value)}><option value="all">Все статусы</option><option value="confirmed">Активные</option><option value="completed">Выполнено</option><option value="cancelled">Отменено</option></select><label>С даты<input type="date" value={bookingFrom} onChange={e=>setBookingFrom(e.target.value)}/></label><label>По дату<input type="date" value={bookingTo} onChange={e=>setBookingTo(e.target.value)}/></label></div><div className="mpb-bookings-table"><div className="mpb-bookings-head"><span>Дата и время</span><span>Клиент</span><span>Услуга</span><span>Статус</span><span>Действия</span></div>{filteredBookings.map(item=><div className="mpb-bookings-row" key={item.id}><span>{new Date(item.starts_at).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span><span><strong>{item.client_name_snapshot}</strong><small>{item.client_phone_snapshot}</small></span><span>{item.service_name_snapshot}<small>{money(Number(item.price_snapshot))}</small></span><span><i className={'mpb-booking-status status-'+item.status}>{item.status==='confirmed'?'Активна':item.status==='completed'?'Выполнена':item.status==='cancelled'?'Отменена':item.status}</i></span><span>{item.status==='confirmed'?<button type="button" className="mpb-text-button mpb-delete-button" onClick={()=>void cancelBooking(item.id)}>Отменить</button>:'—'}</span></div>)}{!filteredBookings.length&&<div className="mpb-empty-bookings">Записей по выбранным условиям не найдено.</div>}</div></div>}
        {section==='settings'&&<div className="mpb-form-stack">
          <div className="mpb-field"><label>Часовой пояс</label><select value={timezone} onChange={e=>{setTimezone(e.target.value);setSaved(false)}}><option value="Europe/Kaliningrad">Калининград (−1 Мск)</option><option value="Europe/Helsinki">Хельсинки (UTC+2/+3)</option><option value="Europe/Moscow">Москва (Мск)</option><option value="Europe/Samara">Самара (+1 Мск)</option><option value="Asia/Yekaterinburg">Екатеринбург (+2 Мск)</option><option value="Asia/Omsk">Омск (+3 Мск)</option><option value="Asia/Novosibirsk">Новосибирск (+4 Мск)</option><option value="Asia/Tomsk">Томск (+4 Мск)</option><option value="Asia/Novokuznetsk">Кемерово (+4 Мск)</option><option value="Asia/Krasnoyarsk">Красноярск (+4 Мск)</option><option value="Asia/Irkutsk">Иркутск (+5 Мск)</option><option value="Asia/Yakutsk">Якутск (+6 Мск)</option><option value="Asia/Vladivostok">Владивосток (+7 Мск)</option><option value="Asia/Magadan">Магадан (+8 Мск)</option><option value="Asia/Kamchatka">Петропавловск-Камчатский (+9 Мск)</option></select><small>Время в календаре будет рассчитываться по часовому поясу мастера.</small></div>
          <div className="mpb-field"><label>Горизонт онлайн-записи</label><select value={horizon} onChange={e=>{setHorizon(e.target.value);setSaved(false)}}><option value="14">14 дней</option><option value="30">30 дней</option><option value="45">45 дней</option><option value="60">60 дней</option></select><small>На сколько дней вперёд клиент сможет выбрать дату.</small></div>
          <div className="mpb-info-row"><span>Публичная ссылка</span><a className="mpb-public-url" href={`${window.location.origin}${import.meta.env.BASE_URL}pro/${masterSlug}`} target="_blank" rel="noreferrer">{window.location.origin}{import.meta.env.BASE_URL}pro/{masterSlug}</a><small>Ссылка формируется автоматически и не редактируется вручную.</small></div>
          <div className="mpb-info-row"><span>Статус страницы</span><strong className={pageActive?'mpb-status-active':'mpb-status-draft'}>{pageActive?'Опубликована':'Черновик · не опубликована'}</strong><small>{!pageActive?'Публикацией своей индивидуальной страницы управляете вы. Owner имеет отдельные полномочия администратора платформы.':services.some(item=>item.active)&&activeDays>0?'Страница доступна клиентам. Проверьте публичную ссылку.':'Страница открывается по ссылке, но для онлайн-записи добавьте активную услугу и рабочее расписание.'}</small></div>
        </div>}

      </section>
      <aside className="mpb-preview-panel">
        <div className="mpb-preview-head"><div><span className="mpb-eyebrow">LIVE PREVIEW</span><strong>Так увидит клиент</strong></div><div className="mpb-device-switch"><button className={device==='desktop'?'active':''} onClick={()=>setDevice('desktop')} aria-label="Предпросмотр на компьютере"><span className="mpb-device-icon mpb-device-desktop" aria-hidden="true"/><span>ПК</span></button><button className={device==='mobile'?'active':''} onClick={()=>setDevice('mobile')} aria-label="Предпросмотр на телефоне"><span className="mpb-device-icon mpb-device-mobile" aria-hidden="true"/><span>Телефон</span></button></div></div>
        <div className="mpb-preview-caption"><span><i/> Обновляется автоматически</span><div><button className={previewTab==='page'?'active':''} onClick={()=>setPreviewTab('page')}>Страница</button><button className={previewTab==='booking'?'active':''} onClick={()=>setPreviewTab('booking')}>Запись</button></div></div>
        <div className={'mpb-preview-frame '+(device==='mobile'?'is-mobile':'')}><div className={'mpb-public-page theme-'+theme}>
          <div className="mpb-public-cover" style={coverImage?{backgroundImage:`linear-gradient(120deg,rgba(0,0,0,.18),rgba(0,0,0,.48)),url(${coverImage})`}:undefined}>{coverTitle.trim()&&<span>{coverTitle}</span>}</div>
          <div className="mpb-public-profile"><div className="mpb-public-avatar">{photo?<img src={photo} alt=""/>:(name.trim().slice(0,1)||'А').toUpperCase()}</div><div><small>{specialty||'ИНДИВИДУАЛЬНЫЙ СПЕЦИАЛИСТ'}</small><h2>{name||'Ваше имя'}</h2>{description.trim()&&<p>{description}</p>}{pageTags.length>0&&<span>{pageTags.join('　 ·　 ')}</span>}</div></div>
          {previewTab==='page'?<div className="mpb-public-content"><div className="mpb-public-title"><small>ВЫБЕРИТЕ УСЛУГУ</small><h3>Услуги и стоимость</h3></div>{activeServices.map(item=><button key={item.id} className={'mpb-public-service '+(selectedService===item.id?'chosen':'')} onClick={()=>setSelectedService(item.id)}><span><b>{item.name}</b><small>{item.description}</small><em>{item.duration} минут</em></span><strong>{money(item.price)}</strong></button>)}{!activeServices.length&&<p className="mpb-empty-preview">Добавьте хотя бы одну активную услугу.</p>}<div className="mpb-public-title mpb-calendar-title"><small>СЛЕДУЮЩИЙ ШАГ</small><h3>Выберите удобное время</h3></div><div className="mpb-public-dates">{['ПН 10','ВТ 11','СР 12','ЧТ 13','ПТ 14'].map((d,i)=><span className={i===1?'selected':''} key={d}>{d}</span>)}</div><div className="mpb-public-times">{['10:00','11:30','13:00','15:30'].map((t,i)=><span className={i===1?'selected':''} key={t}>{t}</span>)}</div><button className="mpb-public-cta">Выбрать дату и время</button></div>:<div className="mpb-public-content"><div className="mpb-public-title"><small>ВАША ЗАПИСЬ</small><h3>Подтверждение</h3></div><div className="mpb-booking-receipt"><span>Мастер<strong>{name||'Ваше имя'}</strong></span><span>Услуга<strong>{currentService?.name??'Не выбрана'}</strong></span><span>Длительность<strong>{currentService?.duration??0} минут</strong></span><span>Стоимость<strong>{money(currentService?.price??0)}</strong></span></div><label className="mpb-preview-input">Ваше имя<input placeholder="Как к вам обращаться?"/></label><label className="mpb-preview-input">Номер телефона<input placeholder="+7 (___) ___-__-__"/></label><button className="mpb-public-cta">Подтвердить запись</button><small className="mpb-preview-demo-note">Предпросмотр · данные не отправляются</small></div>}
          <div className="mpb-public-footer">ИНДИВИДУАЛЬНАЯ ПРАКТИКА <span>Онлайн-запись без ожидания</span></div>
        </div></div>
        <div className="mpb-preview-note">Предпросмотр обновляется по мере редактирования. Сохраните изменения, чтобы обновить публичную страницу.</div>
      </aside>
    </div>
    {showPublish&&<div className="mpb-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowPublish(false)}}><section className="mpb-publish-modal"><button className="mpb-modal-close" onClick={()=>setShowPublish(false)}>Закрыть</button><span className="mpb-eyebrow">ПУБЛИКАЦИЯ</span><h2>Страница ещё не готова к публикации</h2><p>Сейчас это интерактивный прототип конструктора. Сохранение в Supabase и настоящая публикация будут подключены после согласования интерфейса.</p><button className="mpb-primary" onClick={()=>setShowPublish(false)}>Понятно</button></section></div>}
  </main>
}
