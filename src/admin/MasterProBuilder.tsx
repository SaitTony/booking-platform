import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './MasterProBuilder.css'

type Section = 'profile' | 'design' | 'services' | 'schedule' | 'settings'
type Theme = 'natural' | 'graphite' | 'sand' | 'green' | 'blue' | 'dark'
type Service = { id: number; name: string; description: string; duration: number; price: number; active: boolean }

const themeNames: Record<Theme,string> = { natural:'Natural', graphite:'Graphite', sand:'Sand', green:'Deep Green', blue:'Midnight Blue', dark:'Dark' }
const initialServices: Service[] = [
  { id:1, name:'Консультация', description:'Знакомство, обсуждение задачи и подбор решения', duration:30, price:1200, active:true },
  { id:2, name:'Основная услуга', description:'Полноценная процедура с индивидуальным подходом', duration:60, price:2500, active:true },
  { id:3, name:'Расширенная услуга', description:'Больше времени и внимания к деталям', duration:90, price:3500, active:true },
]
const week = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
const money = (value:number) => new Intl.NumberFormat('ru-RU').format(value) + ' ₽'

export default function MasterProBuilder() {
  const [section,setSection] = useState<Section>('profile')
  const [name,setName] = useState('Анна Смирнова')
  const [specialty,setSpecialty] = useState('Персональный мастер')
  const [description,setDescription] = useState('Помогаю найти время для себя. Индивидуальный подход, внимание к деталям и комфорт на каждом этапе.')
  const [photo,setPhoto] = useState('')
  const [coverTitle,setCoverTitle] = useState('PERSONAL SPACE')
  const [theme,setTheme] = useState<Theme>('natural')
  const [services,setServices] = useState(initialServices)
  const [selectedService,setSelectedService] = useState(2)
  const [newService,setNewService] = useState({name:'',description:'',duration:'60',price:'0'})
  const [hours,setHours] = useState(week.map((_,i)=>({enabled:i<6,opens:i===5?'10:00':'09:00',closes:i===5?'16:00':'18:00'})))
  const [timezone,setTimezone] = useState('Europe/London')
  const [horizon,setHorizon] = useState('30')
  const [device,setDevice] = useState<'desktop'|'mobile'>('desktop')
  const [previewTab,setPreviewTab] = useState<'page'|'booking'>('page')
  const [saved,setSaved] = useState(false)
  const [showPublish,setShowPublish] = useState(false)
  const activeServices = services.filter(item=>item.active)
  const currentService = activeServices.find(item=>item.id===selectedService) ?? activeServices[0]
  const activeDays = useMemo(()=>hours.filter(item=>item.enabled).length,[hours])
  const sections: {id:Section;number:string;title:string;sub:string}[] = [
    {id:'profile',number:'01',title:'Профиль',sub:'Имя, фото и описание'},
    {id:'design',number:'02',title:'Оформление',sub:'Обложка и цветовая тема'},
    {id:'services',number:'03',title:'Услуги',sub:'Каталог, цены и длительность'},
    {id:'schedule',number:'04',title:'Расписание',sub:'Рабочие дни и часы'},
    {id:'settings',number:'05',title:'Настройки записи',sub:'Часовой пояс и горизонт'},
  ]

  function addService(){
    if(!newService.name.trim())return
    const item={id:Date.now(),name:newService.name.trim(),description:newService.description,duration:Math.max(1,Number(newService.duration)||60),price:Math.max(0,Number(newService.price)||0),active:true}
    setServices(current=>[...current,item]);setSelectedService(item.id);setNewService({name:'',description:'',duration:'60',price:'0'});setSaved(false)
  }

  return <main className="mpb-shell">
    <header className="mpb-topbar">
      <div className="mpb-brand"><span className="mpb-brand-mark">W</span><span>Workflows <small>· Конструктор Master_pro</small></span></div>
      <div className="mpb-top-actions"><span className="mpb-draft-status"><i/> Черновик · демо-режим</span><Link to="/admin" className="mpb-back-link">Вернуться в админпанель</Link></div>
    </header>
    <div className="mpb-page-head">
      <div><div className="mpb-breadcrumb">MASTER_PRO <span>/</span> МОЯ СТРАНИЦА <span>/</span> КОНСТРУКТОР</div><h1>Создание страницы</h1><p>Настройте свою страницу и сразу посмотрите, как её увидят клиенты.</p></div>
      <div className="mpb-page-actions"><button className="mpb-secondary" onClick={()=>{setSection('profile');setSaved(false)}}>Продолжить настройку</button><button className="mpb-primary" onClick={()=>setShowPublish(true)}>Опубликовать страницу</button></div>
    </div>
    <div className="mpb-workspace">
      <aside className="mpb-sidebar">
        <div className="mpb-sidebar-caption">НАСТРОЙКА СТРАНИЦЫ</div>
        <nav>{sections.map(item=><button key={item.id} className={section===item.id?'is-active':''} onClick={()=>setSection(item.id)}><span className="mpb-step">{item.number}</span><span className="mpb-nav-copy"><strong>{item.title}</strong><small>{item.sub}</small></span><span className="mpb-nav-arrow">›</span></button>)}</nav>
        <div className="mpb-sidebar-bottom"><div className="mpb-completion"><div><strong>Готовность страницы</strong><b>60%</b></div><span><i/></span><small>Заполните разделы и проверьте предпросмотр</small></div><div className="mpb-help"><strong>Нужна помощь?</strong><span>Подсказки по настройке страницы</span></div></div>
      </aside>
      <section className="mpb-editor">
        <div className="mpb-editor-heading"><div><span className="mpb-eyebrow">РАЗДЕЛ {sections.findIndex(x=>x.id===section)+1} ИЗ 5</span><h2>{sections.find(x=>x.id===section)?.title}</h2><p>{sections.find(x=>x.id===section)?.sub}</p></div><span className="mpb-live-indicator"><i/> Изменения видны сразу</span></div>
        {section==='profile'&&<div className="mpb-form-stack">
          <div className="mpb-field"><label>Имя и фамилия <em>Обязательно</em></label><input value={name} onChange={e=>{setName(e.target.value);setSaved(false)}} placeholder="Например, Анна Смирнова"/><small>Это имя будет отображаться в верхней части вашей страницы.</small></div>
          <div className="mpb-field"><label>Специализация</label><input value={specialty} onChange={e=>{setSpecialty(e.target.value);setSaved(false)}} placeholder="Например, стилист"/><small>Коротко обозначьте направление вашей работы.</small></div>
          <div className="mpb-field"><label>О себе</label><textarea rows={5} value={description} onChange={e=>{setDescription(e.target.value);setSaved(false)}} placeholder="Расскажите о себе и своём подходе..."/><small>Несколько предложений, которые помогут клиенту познакомиться с вами.</small></div>
          <div className="mpb-field"><label>Фотография профиля</label><input value={photo} onChange={e=>{setPhoto(e.target.value);setSaved(false)}} placeholder="Вставьте ссылку на фотографию"/><small>В прототипе используется ссылка на изображение. Загрузка файла будет добавлена при подключении хранилища.</small></div>
          <div className="mpb-tip"><strong>Совет</strong><span>Используйте портрет, на котором хорошо видно ваше лицо. Он будет показан рядом с именем на публичной странице.</span></div>
        </div>}
        {section==='design'&&<div className="mpb-form-stack">
          <div className="mpb-field"><label>Текст на обложке</label><input value={coverTitle} onChange={e=>{setCoverTitle(e.target.value);setSaved(false)}}/><small>Короткая фраза, которая задаёт настроение страницы.</small></div>
          <div className="mpb-field"><label>Цветовая тема</label><small>Выберите оформление. Клиенты увидят готовую тему — переключателя на публичной странице не будет.</small></div>
          <div className="mpb-theme-grid">{(Object.keys(themeNames) as Theme[]).map(id=><button key={id} className={theme===id?'selected':''} onClick={()=>{setTheme(id);setSaved(false)}}><span className={'mpb-theme-swatch theme-'+id}><i/><i/><i/><i/></span><strong>{themeNames[id]}</strong>{theme===id&&<b>✓</b>}</button>)}</div>
          <div className="mpb-tip"><strong>Предпросмотр</strong><span>Цветовая схема применяется ко всей публичной странице, включая карточки услуг, календарь и кнопки записи.</span></div>
        </div>}
        {section==='services'&&<div className="mpb-form-stack">
          <div className="mpb-section-line"><div><strong>Ваши услуги</strong><small>{activeServices.length} активные услуги</small></div><span>Порядок можно будет менять перетаскиванием</span></div>
          <div className="mpb-service-editor">{services.map(item=><article key={item.id} className={!item.active?'is-disabled':''}><div className="mpb-service-editor-main"><strong>{item.name}</strong><small>{item.duration} мин. · {money(item.price)}</small><p>{item.description}</p></div><button className="mpb-text-button" onClick={()=>{setServices(all=>all.map(s=>s.id===item.id?{...s,active:!s.active}:s));setSaved(false)}}>{item.active?'Отключить':'Включить'}</button></article>)}</div>
          <div className="mpb-add-service"><h3>Добавить услугу</h3><div className="mpb-field"><label>Название</label><input value={newService.name} onChange={e=>setNewService({...newService,name:e.target.value})} placeholder="Например, Стрижка"/></div><div className="mpb-field"><label>Описание</label><textarea rows={2} value={newService.description} onChange={e=>setNewService({...newService,description:e.target.value})} placeholder="Что входит в услугу?"/></div><div className="mpb-two-cols"><div className="mpb-field"><label>Длительность, минут</label><input type="number" min="1" max="720" value={newService.duration} onChange={e=>setNewService({...newService,duration:e.target.value})}/></div><div className="mpb-field"><label>Стоимость, ₽</label><input type="number" min="0" step="50" value={newService.price} onChange={e=>setNewService({...newService,price:e.target.value})}/></div></div><button className="mpb-secondary" onClick={addService} disabled={!newService.name.trim()}>＋ Добавить услугу</button></div>
        </div>}
        {section==='schedule'&&<div className="mpb-form-stack">
          <div className="mpb-schedule-intro"><strong>Регулярное расписание</strong><span>{activeDays} рабочих дней в неделю</span><p>Укажите стандартные часы. Позже можно будет добавлять перерывы, несколько интервалов в день и разовые исключения.</p></div>
          <div className="mpb-week-list">{hours.map((item,index)=><div className={!item.enabled?'day-off':''} key={week[index]}><strong>{week[index]}</strong><label className="mpb-toggle"><input type="checkbox" checked={item.enabled} onChange={e=>{setHours(all=>all.map((h,i)=>i===index?{...h,enabled:e.target.checked}:h));setSaved(false)}}/><span/></label><input aria-label={'Начало '+week[index]} type="time" value={item.opens} disabled={!item.enabled} onChange={e=>setHours(all=>all.map((h,i)=>i===index?{...h,opens:e.target.value}:h))}/><span>—</span><input aria-label={'Окончание '+week[index]} type="time" value={item.closes} disabled={!item.enabled} onChange={e=>setHours(all=>all.map((h,i)=>i===index?{...h,closes:e.target.value}:h))}/></div>)}</div>
          <div className="mpb-tip"><strong>Следующий шаг</strong><span>В полной версии конструктора здесь появятся перерывы, дополнительные интервалы и исключения по конкретным датам.</span></div>
        </div>}
        {section==='settings'&&<div className="mpb-form-stack">
          <div className="mpb-field"><label>Часовой пояс</label><select value={timezone} onChange={e=>{setTimezone(e.target.value);setSaved(false)}}><option value="Europe/London">Лондон (Europe/London)</option><option value="Europe/Helsinki">Хельсинки (Europe/Helsinki)</option><option value="Europe/Moscow">Москва (Europe/Moscow)</option><option value="Europe/Berlin">Берлин (Europe/Berlin)</option><option value="Asia/Dubai">Дубай (Asia/Dubai)</option></select><small>Время в календаре будет рассчитываться по часовому поясу мастера.</small></div>
          <div className="mpb-field"><label>Горизонт онлайн-записи</label><select value={horizon} onChange={e=>{setHorizon(e.target.value);setSaved(false)}}><option value="14">14 дней</option><option value="30">30 дней</option><option value="45">45 дней</option><option value="60">60 дней</option></select><small>На сколько дней вперёд клиент сможет выбрать дату.</small></div>
          <div className="mpb-info-row"><span>Публичная ссылка</span><strong>workflows.app/pro/anna</strong><small>Адрес страницы будет закреплён после создания и не будет меняться при редактировании профиля.</small></div>
          <div className="mpb-info-row"><span>Статус страницы</span><strong className="mpb-status-draft">Черновик</strong><small>До публикации страница не будет доступна клиентам.</small></div>
        </div>}
        <div className="mpb-editor-footer"><button className="mpb-secondary" onClick={()=>{const index=sections.findIndex(x=>x.id===section);setSection(sections[Math.max(0,index-1)].id)}} disabled={section==='profile'}>← Назад</button><span>{saved?'Черновик сохранён локально':'Изменения пока не сохранены'}</span><button className="mpb-primary" onClick={()=>{setSaved(true);const index=sections.findIndex(x=>x.id===section);if(index<sections.length-1)setSection(sections[index+1].id)}}>{section==='settings'?'Сохранить черновик':'Далее →'}</button></div>
      </section>
      <aside className="mpb-preview-panel">
        <div className="mpb-preview-head"><div><span className="mpb-eyebrow">LIVE PREVIEW</span><strong>Так увидит клиент</strong></div><div className="mpb-device-switch"><button className={device==='desktop'?'active':''} onClick={()=>setDevice('desktop')} aria-label="Предпросмотр на компьютере">▣</button><button className={device==='mobile'?'active':''} onClick={()=>setDevice('mobile')} aria-label="Предпросмотр на телефоне">▯</button></div></div>
        <div className="mpb-preview-caption"><span><i/> Обновляется автоматически</span><div><button className={previewTab==='page'?'active':''} onClick={()=>setPreviewTab('page')}>Страница</button><button className={previewTab==='booking'?'active':''} onClick={()=>setPreviewTab('booking')}>Запись</button></div></div>
        <div className={'mpb-preview-frame '+(device==='mobile'?'is-mobile':'')}><div className={'mpb-public-page theme-'+theme}>
          <div className="mpb-public-top"><b>W</b><span>ОНЛАЙН-ЗАПИСЬ</span></div>
          <div className="mpb-public-cover"><span>{coverTitle||'PERSONAL SPACE'}</span><small>YOUR TIME · YOUR STYLE</small></div>
          <div className="mpb-public-profile"><div className="mpb-public-avatar">{photo?<img src={photo} alt=""/>:(name.trim().slice(0,1)||'А').toUpperCase()}</div><div><small>{specialty||'ИНДИВИДУАЛЬНЫЙ СПЕЦИАЛИСТ'}</small><h2>{name||'Ваше имя'}</h2><p>{description||'Здесь появится ваше описание.'}</p><span>✦ Частная практика　 ·　 По записи</span></div></div>
          {previewTab==='page'?<div className="mpb-public-content"><div className="mpb-public-title"><small>ВЫБЕРИТЕ УСЛУГУ</small><h3>Услуги и стоимость</h3></div>{activeServices.map(item=><button key={item.id} className={'mpb-public-service '+(selectedService===item.id?'chosen':'')} onClick={()=>setSelectedService(item.id)}><span><b>{item.name}</b><small>{item.description}</small><em>{item.duration} минут</em></span><strong>{money(item.price)}</strong></button>)}{!activeServices.length&&<p className="mpb-empty-preview">Добавьте хотя бы одну активную услугу.</p>}<div className="mpb-public-title mpb-calendar-title"><small>СЛЕДУЮЩИЙ ШАГ</small><h3>Выберите удобное время</h3></div><div className="mpb-public-dates">{['ПН 10','ВТ 11','СР 12','ЧТ 13','ПТ 14'].map((d,i)=><span className={i===1?'selected':''} key={d}>{d}</span>)}</div><div className="mpb-public-times">{['10:00','11:30','13:00','15:30'].map((t,i)=><span className={i===1?'selected':''} key={t}>{t}</span>)}</div><button className="mpb-public-cta">Выбрать дату и время</button></div>:<div className="mpb-public-content"><div className="mpb-public-title"><small>ВАША ЗАПИСЬ</small><h3>Подтверждение</h3></div><div className="mpb-booking-receipt"><span>Мастер<strong>{name||'Ваше имя'}</strong></span><span>Услуга<strong>{currentService?.name??'Не выбрана'}</strong></span><span>Длительность<strong>{currentService?.duration??0} минут</strong></span><span>Стоимость<strong>{money(currentService?.price??0)}</strong></span></div><label className="mpb-preview-input">Ваше имя<input placeholder="Как к вам обращаться?"/></label><label className="mpb-preview-input">Номер телефона<input placeholder="+7 (___) ___-__-__"/></label><button className="mpb-public-cta">Подтвердить запись</button><small className="mpb-preview-demo-note">Предпросмотр · данные не отправляются</small></div>}
          <div className="mpb-public-footer">ИНДИВИДУАЛЬНАЯ ПРАКТИКА <span>Онлайн-запись без ожидания</span></div>
        </div></div>
        <div className="mpb-preview-note">Предпросмотр демонстрационный. Изменения не публикуются и не сохраняются в базе.</div>
      </aside>
    </div>
    {showPublish&&<div className="mpb-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowPublish(false)}}><section className="mpb-publish-modal"><button className="mpb-modal-close" onClick={()=>setShowPublish(false)}>×</button><span className="mpb-eyebrow">ПУБЛИКАЦИЯ</span><h2>Страница ещё не готова к публикации</h2><p>Сейчас это интерактивный прототип конструктора. Сохранение в Supabase и настоящая публикация будут подключены после согласования интерфейса.</p><button className="mpb-primary" onClick={()=>setShowPublish(false)}>Понятно</button></section></div>}
  </main>
}
