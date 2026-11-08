import CompanySettings from './CompanySettings'
import StaffWorkspace from './StaffWorkspace'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Profile = {
  id: string
  full_name: string
  email: string
  phone_e164: string
  platform_role: 'pending' | 'owner' | 'master_pro'
  force_password_change: boolean
  disabled_at: string | null
  company_members?: Member[]
}
type Member = { role: 'admin' | 'master'; company_id: string; master_id: string | null }
type CompanyOption = { id: string; name: string }
type MasterOption = { id: string; display_name: string; slug:string; kind: 'individual' | 'company'; company_id: string | null; profile_id: string | null; is_active: boolean }
type Account = Profile & { company_members?: Member[] }

function makeSlug(value: string) {
  const map: Record<string,string> = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'}
  return value.toLowerCase().split('').map(char=>map[char] ?? char).join('').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
}
const roleLabel = (profile: Account) => {
  if (profile.platform_role === 'owner') return 'Owner'
  if (profile.platform_role === 'master_pro') return 'Master_pro'
  return profile.company_members?.[0]?.role === 'admin' ? 'Admin'
    : profile.company_members?.[0]?.role === 'master' ? 'Master' : 'Ожидает назначения'
}

export default function AdminApp() {
  const [sessionReady, setSessionReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [masterPages, setMasterPages] = useState<MasterOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'admin' | 'master' | 'master_pro'>('admin')
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [resetUserId,setResetUserId]=useState('')
  const [resetTemporaryPassword,setResetTemporaryPassword]=useState('')
  const [companyName,setCompanyName]=useState('')
  const [companySlug,setCompanySlug]=useState('')
  const [companyDescription,setCompanyDescription]=useState('')
  const [pageKind,setPageKind]=useState<'company'|'individual'>('company')
  const [pageCompanyId,setPageCompanyId]=useState('')
  const [pageName,setPageName]=useState('')
  const [pageSlug,setPageSlug]=useState('')
  const [pageDescription,setPageDescription]=useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadProfile() {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfile(null); setSessionReady(true); return }
    const { data, error: profileError } = await supabase.from('profiles')
      .select('id,full_name,email,phone_e164,platform_role,force_password_change,disabled_at,company_members(role,company_id,master_id)')
      .eq('id', user.id).maybeSingle()
    if (profileError) setError(profileError.message)
    setProfile(data as Profile | null)
    const membership=(data as Profile | null)?.company_members?.[0]
    if(membership){setPageCompanyId(membership.company_id);if(membership.role==='admin')setPageKind('company')}
    setSessionReady(true)
  }

  async function loadDirectories() {
    if (!supabase) return
    const [{ data: companyData }, { data: masterData }] = await Promise.all([
      supabase.from('companies').select('id,name').order('name'),
      supabase.from('masters').select('id,display_name,slug,kind,company_id,profile_id,is_active').is('archived_at', null).order('display_name'),
    ])
    setCompanies((companyData ?? []) as CompanyOption[])
    setMasterPages((masterData ?? []) as MasterOption[])
  }

  async function loadAccounts() {
    if (!supabase) return
    const { data, error: listError } = await supabase.from('profiles')
      .select('id,full_name,email,phone_e164,platform_role,force_password_change,disabled_at,company_members(role,company_id,master_id)')
      .order('created_at', { ascending: false })
    if (listError) setError(listError.message)
    setAccounts((data ?? []) as unknown as Account[])
  }

  useEffect(() => {
    if (!supabase) { setSessionReady(true); return }
    void loadProfile()
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void loadProfile() })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (profile?.platform_role === 'owner' && !profile.force_password_change && !profile.disabled_at) {
      void loadAccounts()
    }
  }, [profile?.id, profile?.platform_role, profile?.force_password_change])

  useEffect(() => {
    if (!profile || profile.force_password_change || profile.disabled_at) return
    if (profile.platform_role === 'owner' || profile.company_members?.some(member => member.role === 'admin')) {
      void loadDirectories()
    }
  }, [profile?.id, profile?.platform_role, profile?.force_password_change, profile?.disabled_at, profile?.company_members?.[0]?.company_id])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    const normalizedEmail = email.trim().toLowerCase()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (signInError) setError('Не удалось войти. Проверьте email и пароль.')
    else await loadProfile()
    setBusy(false)
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (newPassword.length < 10) { setError('Новый пароль должен содержать не менее 10 символов.'); return }
    setBusy(true); setError('')
    const { error: updateError } = await supabase.functions.invoke('change-password', { body: { newPassword } })
    if (!updateError) { setNotice('Пароль успешно изменён.'); await loadProfile() }
    else setError(updateError.message)
    setBusy(false)
  }

  async function toggleAccountStatus(account: Account) {
    if (!supabase || account.platform_role === 'owner') return
    const disabled = !account.disabled_at
    const confirmed = window.confirm(disabled
      ? `Отключить доступ для ${account.full_name}?`
      : `Включить доступ для ${account.full_name}?`)
    if (!confirmed) return
    setBusy(true); setError(''); setNotice('')
    const { error: statusError } = await supabase.functions.invoke('owner-set-account-status', {
      body: { userId: account.id, disabled },
    })
    if (statusError) setError(statusError.message)
    else { setNotice(disabled ? 'Доступ к учётной записи отключён.' : 'Доступ к учётной записи включён.'); await loadAccounts() }
    setBusy(false)
  }

  async function resetUserAccess(event: FormEvent) {
    event.preventDefault()
    if(!supabase||!resetUserId)return
    setBusy(true);setError('');setNotice('')
    const {error:resetError}=await supabase.functions.invoke('owner-reset-access',{body:{targetUserId:resetUserId,newTemporaryPassword:resetTemporaryPassword}})
    if(resetError)setError(resetError.message)
    else{setNotice('Временный пароль установлен. Передайте его пользователю безопасным способом — при следующем входе он должен будет сменить пароль.');setResetUserId('');setResetTemporaryPassword('');await loadAccounts()}
    setBusy(false)
  }

  async function archiveMasterPage(page:MasterOption) {
    if(!supabase||!window.confirm('Переместить страницу мастера в архив? История записей сохранится.'))return
    const {error:updateError}=await supabase.from('masters').update({is_active:false,archived_at:new Date().toISOString()}).eq('id',page.id)
    if(updateError)setError(updateError.message)
    else{setNotice('Страница архивирована, история записей сохранена.');await loadDirectories()}
  }

  async function toggleMasterPage(page:MasterOption) {
    if(!supabase)return
    const {error:updateError}=await supabase.from('masters').update({is_active:!page.is_active}).eq('id',page.id)
    if(updateError)setError(updateError.message)
    else{setNotice('Статус страницы изменён.');await loadDirectories()}
  }

  async function createCompany(event: FormEvent) {
    event.preventDefault()
    if(!supabase)return
    setBusy(true);setError('');setNotice('')
    const {error:createError}=await supabase.from('companies').insert({name:companyName.trim(),slug:companySlug.trim(),description:companyDescription})
    if(createError)setError(createError.message)
    else{setNotice('Компания создана.');setCompanyName('');setCompanySlug('');setCompanyDescription('');await loadDirectories()}
    setBusy(false)
  }

  async function createMasterPage(event: FormEvent) {
    event.preventDefault()
    if(!supabase)return
    if(!pageName.trim()||!pageSlug.trim()){setError('Имя и адрес страницы обязательны.');return}
    setBusy(true);setError('');setNotice('')
    const payload={kind:pageKind,company_id:pageKind==='company'?pageCompanyId:null,display_name:pageName.trim(),slug:pageSlug.trim(),public_description:pageDescription}
    const {error:createError}=await supabase.from('masters').insert(payload)
    if(createError)setError(createError.message)
    else{setNotice('Страница мастера создана. Учётную запись можно связать с ней после создания пользователя.');setPageName('');setPageSlug('');setPageDescription('');await loadDirectories()}
    setBusy(false)
  }

  async function assignRole(event: FormEvent, companyOverride?: string, masterOverride?: string, roleOverride?: 'admin'|'master'|'master_pro') {
    event.preventDefault()
    if (!supabase || !selectedUserId) return
    const roleToAssign = roleOverride ?? (companyOverride && selectedRole === 'master_pro' ? 'admin' : selectedRole)
    setBusy(true); setError(''); setNotice('')
    const body = { userId: selectedUserId, role: roleToAssign, companyId: roleToAssign === 'master_pro' ? null : companyOverride, masterId: roleToAssign === 'admin' ? null : (masterOverride ?? selectedMasterId) }
    const { error: assignError } = await supabase.functions.invoke('assign-user-role', { body })
    if (assignError) setError(assignError.message)
    else { setNotice('Роль и связь со страницей назначены.'); setSelectedUserId(''); setSelectedMasterId(''); await loadAccounts() }
    setBusy(false)
  }

  async function createAccount(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    const { error: createError } = await supabase.functions.invoke('create-user', {
      body: { fullName, email: emailForCreate, phone: phoneForCreate, temporaryPassword },
    })
    if (createError) setError(createError.message)
    else {
      setNotice('Учётная запись создана. Теперь назначьте пользователю роль и свяжите его со страницей.')
      setFullName(''); setEmailForCreate(''); setPhoneForCreate(''); setTemporaryPassword('')
      await loadAccounts()
    }
    setBusy(false)
  }

  const [emailForCreate, setEmailForCreate] = useState('')
  const [phoneForCreate, setPhoneForCreate] = useState('')

  if (!sessionReady && supabase) return <main className="admin-shell"><section className="admin-card">Загрузка…</section></main>
  if (!profile) return <main className="admin-shell"><form className="admin-card" onSubmit={signIn}>
    <span className="eyebrow">Workflows project</span><h1>административная панель</h1>
    <label className="admin-field">Email<input type="email" autoComplete="username" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
    <label className="admin-field">Пароль<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {!isSupabaseConfigured && <p className="admin-error">Авторизация пока не подключена. Для входа необходимо настроить соединение с базой данных.</p>}
    {error && <p className="admin-error">{error}</p>}
    <button className="primary-button full-button" disabled={busy || !supabase}>{busy?'Входим…':'Войти'}</button>
  </form></main>

  if (profile.force_password_change) return <main className="admin-shell"><form className="admin-card" onSubmit={changePassword}>
    <span className="eyebrow">ПЕРВЫЙ ВХОД</span><h1>Создайте свой пароль</h1><p>Временный пароль больше не будет использоваться. Придумайте новый пароль длиной не менее 10 символов.</p>
    <label className="admin-field">Новый пароль<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={10} /></label>
    {error && <p className="admin-error">{error}</p>}
    <button className="primary-button full-button" disabled={busy}>{busy?'Сохраняем…':'Сменить пароль'}</button>
  </form></main>

  if (profile.disabled_at) return <main className="admin-shell"><section className="admin-card"><h1>Доступ отключён</h1><p>Обратитесь к владельцу платформы.</p><button className="secondary-button" onClick={()=>void supabase?.auth.signOut()}>Выйти</button></section></main>
  if (profile.platform_role === 'pending' && !profile.company_members?.length) return <main className="admin-shell"><section className="admin-card"><h1>Ожидается назначение роли</h1><p>Учётная запись создана. Owner должен назначить роль и связать аккаунт с компанией или страницей мастера.</p><button className="secondary-button" onClick={()=>void supabase?.auth.signOut()}>Выйти</button></section></main>

  return <main className="admin-shell"><section className="admin-wide">
    <header className="admin-top"><div className="admin-branding"><span className="eyebrow">Workflows project</span><h1>административная панель</h1><p>{profile.full_name} · {profile.platform_role === 'owner' ? 'Owner' : roleLabel({ ...profile })}</p></div><button className="secondary-button logout-button" onClick={()=>void supabase?.auth.signOut()}>Выйти</button></header>
    {notice && <p className="admin-notice">{notice}</p>}{error && <p className="admin-error">{error}</p>}
    {profile.platform_role === 'owner' ? <>
      <details className="admin-accordion">
        <summary><span>Учётные записи</span><span className="accordion-count">{accounts.length}</span></summary>
        <div className="accordion-content">
          <form className="admin-card admin-create-form" onSubmit={createAccount}>
            <h3>Создать учётную запись</h3>
            <label className="admin-field">Имя<input value={fullName} onChange={e=>setFullName(e.target.value)} required /></label>
            <label className="admin-field">Email<input type="email" placeholder="name@example.com" value={emailForCreate} onChange={e=>setEmailForCreate(e.target.value)} required /></label>
            <label className="admin-field">Контактный номер телефона<input type="tel" placeholder="+358…" value={phoneForCreate} onChange={e=>setPhoneForCreate(e.target.value)} required /></label>
            <label className="admin-field">Временный пароль<input type="text" autoComplete="off" value={temporaryPassword} onChange={e=>setTemporaryPassword(e.target.value)} minLength={10} required /></label>
            <button className="primary-button" disabled={busy}>{busy?'Создаём…':'Создать учётную запись'}</button>
          </form>
          <form className="admin-card admin-create-form" onSubmit={resetUserAccess}>
            <h3>Сбросить пароль</h3>
            <label className="admin-field">Пользователь<select value={resetUserId} onChange={e=>setResetUserId(e.target.value)} required><option value="">Выберите пользователя</option>{accounts.filter(a=>a.platform_role!=='owner').map(a=><option key={a.id} value={a.id}>{a.full_name} · {a.email}</option>)}</select></label>
            <label className="admin-field">Новый временный пароль<input type="text" autoComplete="off" minLength={10} value={resetTemporaryPassword} onChange={e=>setResetTemporaryPassword(e.target.value)} required /></label>
            <button className="primary-button" disabled={busy||!resetUserId}>Сбросить пароль</button>
          </form>
          <div className="admin-account-list">{accounts.map(account=><article className="admin-account" key={account.id}>
            <div><strong>{account.full_name}</strong><span>{account.email} · {account.phone_e164}</span></div>
            <span className="admin-role">{roleLabel(account)}</span>
            {account.force_password_change && <span className="admin-role">Требуется смена пароля</span>}
            {account.disabled_at && <span className="admin-role account-disabled">Отключена</span>}
            {account.platform_role!=='owner'&&<button className="secondary-button account-action" disabled={busy} onClick={()=>void toggleAccountStatus(account)}>{account.disabled_at?'Включить':'Отключить'}</button>}
          </article>)}</div>
        </div>
      </details>

      <details className="admin-accordion">
        <summary><span>Компании</span><span className="accordion-count">{companies.length}</span></summary>
        <div className="accordion-content">
          <details className="admin-subaccordion">
            <summary>Управлять</summary>
            <div className="accordion-content">
              {companies.map(company=>{
                const companyPages=masterPages.filter(page=>page.kind==='company'&&page.company_id===company.id)
                const companyStaff=accounts.filter(account=>account.company_members?.some(member=>member.company_id===company.id))
                return <details className="admin-company-item" key={company.id}>
                  <summary><span>{company.name}</span><span className="accordion-meta">{companyPages.length} страниц · {companyStaff.length} сотрудников</span></summary>
                  <div className="accordion-content">
                    <CompanySettings isOwner companyId={company.id} hideSelector/>
                    <section className="admin-card workspace-section">
                      <h3>Сотрудники компании</h3>
                      <div className="admin-account-list">{companyStaff.length?companyStaff.map(account=><article className="admin-account" key={account.id}><div><strong>{account.full_name}</strong><span>{account.email}</span></div><span className="admin-role">{roleLabel(account)}</span></article>):<p>Сотрудники пока не назначены.</p>}</div>
                      <form className="admin-create-form nested-form" onSubmit={event=>void assignRole(event,company.id)}>
                        <h3>Добавить человека в компанию</h3>
                        <label className="admin-field">Учётная запись<select value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)} required><option value="">Выберите учётную запись</option>{accounts.filter(a=>a.platform_role!=='owner'&&!a.company_members?.some(m=>m.company_id===company.id)).map(a=><option key={a.id} value={a.id}>{a.full_name} · {a.email}</option>)}</select></label>
                        <label className="admin-field">Роль<select value={selectedRole==='master_pro'?'admin':selectedRole} onChange={e=>{setSelectedRole(e.target.value as 'admin'|'master');setSelectedMasterId('')}}><option value="admin">Admin</option><option value="master">Master</option></select></label>
                        {selectedRole==='master'&&<label className="admin-field">Страница мастера<select value={selectedMasterId} onChange={e=>setSelectedMasterId(e.target.value)} required><option value="">Выберите страницу</option>{companyPages.filter(page=>!page.profile_id).map(page=><option key={page.id} value={page.id}>{page.display_name}</option>)}</select></label>}
                        <button className="primary-button" disabled={busy||!selectedUserId||(selectedRole==='master'&&!selectedMasterId)}>{busy?'Сохраняем…':'Добавить в компанию'}</button>
                      </form>
                    </section>
                    <section className="admin-card workspace-section">
                      <h3>Страницы мастеров</h3>
                      <div className="admin-account-list">{companyPages.map(page=><article className="admin-account" key={page.id}><div><strong>{page.display_name}</strong><span>/{company.name}/{page.slug}</span></div><span className="admin-role">{page.is_active?'Активна':'Отключена'}</span><button className="secondary-button account-action" onClick={()=>void toggleMasterPage(page)}>{page.is_active?'Отключить':'Включить'}</button><button className="secondary-button account-action" onClick={()=>void archiveMasterPage(page)}>В архив</button></article>)}</div>
                    </section>
                    <StaffWorkspace profile={profile} kindFilter="company" companyIdFilter={company.id}/>
                  </div>
                </details>
              })}
              {!companies.length&&<p className="admin-empty">Компаний пока нет. Создайте первую во вкладке «Создать».</p>}
            </div>
          </details>
          <details className="admin-subaccordion">
            <summary>Создать</summary>
            <div className="accordion-content">
              <form className="admin-card admin-create-form" onSubmit={createCompany}>
                <h3>Создать компанию</h3>
                <label className="admin-field">Название компании<input value={companyName} onChange={e=>{setCompanyName(e.target.value);setCompanySlug(makeSlug(e.target.value))}} required /></label>
                <label className="admin-field">Адрес страницы (slug)<input value={companySlug} onChange={e=>setCompanySlug(makeSlug(e.target.value))} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
                <label className="admin-field">Описание<input value={companyDescription} onChange={e=>setCompanyDescription(e.target.value)} /></label>
                <button className="primary-button" disabled={busy}>Создать компанию</button>
              </form>
            </div>
          </details>
        </div>
      </details>

      <details className="admin-accordion">
        <summary><span>Master_pro</span><span className="accordion-count">{masterPages.filter(page=>page.kind==='individual').length}</span></summary>
        <div className="accordion-content">
          <details className="admin-subaccordion">
            <summary>Управлять</summary>
            <div className="accordion-content">
              {masterPages.filter(page=>page.kind==='individual').map(page=>{
                const linkedAccount=accounts.find(account=>account.id===page.profile_id)
                return <details className="admin-company-item" key={page.id}>
                  <summary><span>{page.display_name}</span><span className="accordion-meta">{page.is_active?'Активна':'Отключена'}</span></summary>
                  <div className="accordion-content">
                    <section className="admin-card">
                      <div className="admin-account"><div><strong>{linkedAccount?.full_name??'Учётная запись не привязана'}</strong><span>{linkedAccount?.email??'Назначьте Master_pro для этой страницы'}</span></div><span className="admin-role">{page.is_active?'Активна':'Отключена'}</span></div>
                      <div className="admin-inline-actions"><button className="secondary-button account-action" onClick={()=>void toggleMasterPage(page)}>{page.is_active?'Отключить страницу':'Включить страницу'}</button><button className="secondary-button account-action" onClick={()=>void archiveMasterPage(page)}>В архив</button></div>
                      {!linkedAccount&&<form className="nested-form" onSubmit={event=>void assignRole(event,undefined,page.id,'master_pro')}>
                        <h3>Связать учётную запись</h3>
                        <label className="admin-field">Пользователь<select value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)} required><option value="">Выберите учётную запись</option>{accounts.filter(a=>a.platform_role!=='owner'&&a.platform_role!=='master_pro').map(a=><option key={a.id} value={a.id}>{a.full_name} · {a.email}</option>)}</select></label>
                        <button className="primary-button" disabled={busy||!selectedUserId}>Назначить Master_pro</button>
                      </form>}
                    </section>
                  </div>
                </details>
              })}
              <StaffWorkspace profile={profile} kindFilter="individual"/>
            </div>
          </details>
          <details className="admin-subaccordion">
            <summary>Создать</summary>
            <div className="accordion-content">
              <form className="admin-card admin-create-form" onSubmit={createMasterPage}>
                <h3>Создать индивидуальную страницу Master_pro</h3>
                <label className="admin-field">Имя мастера<input value={pageName} onChange={e=>{setPageKind('individual');setPageName(e.target.value);setPageSlug(makeSlug(e.target.value))}} required /></label>
                <label className="admin-field">Адрес страницы (slug)<input value={pageSlug} onChange={e=>setPageSlug(makeSlug(e.target.value))} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
                <label className="admin-field">Описание<input value={pageDescription} onChange={e=>setPageDescription(e.target.value)} /></label>
                <button className="primary-button" disabled={busy}>Создать страницу Master_pro</button>
              </form>
            </div>
          </details>
        </div>
      </details>
    </> : profile.company_members?.some(member=>member.role==='admin') ? <>
      <div className="admin-section-head"><div><span className="eyebrow">УПРАВЛЕНИЕ КОМПАНИЕЙ</span><h2>Страницы мастеров</h2></div></div>
      <form className="admin-card admin-create-form" onSubmit={createMasterPage}>
        <h3>Создать страницу мастера</h3>
        <p>Новая страница будет добавлена в вашу компанию. Максимум — пять активных страниц.</p>
        <label className="admin-field">Имя мастера<input value={pageName} onChange={e=>{setPageName(e.target.value);setPageSlug(makeSlug(e.target.value))}} required /></label>
        <label className="admin-field">Адрес страницы (slug)<input value={pageSlug} onChange={e=>setPageSlug(makeSlug(e.target.value))} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
        <label className="admin-field">Описание<input value={pageDescription} onChange={e=>setPageDescription(e.target.value)} /></label>
        <button className="primary-button" disabled={busy || !pageCompanyId}>Создать страницу мастера</button>
      </form>
      <div className="admin-account-list">{masterPages.filter(page=>page.kind==='company'&&page.company_id===pageCompanyId).map(page=><article className="admin-account" key={page.id}><div><strong>{page.display_name}</strong><span>/{companies.find(item=>item.id===page.company_id)?.name ?? 'company'}/{page.slug}</span></div><span className="admin-role">{page.is_active?'Активна':'Отключена'}</span><button className="secondary-button" onClick={()=>void toggleMasterPage(page)}>{page.is_active?'Отключить':'Включить'}</button></article>)}</div>
      <CompanySettings isOwner={false} companyId={pageCompanyId}/>
      <StaffWorkspace profile={profile}/>
    </> : <StaffWorkspace profile={profile}/>}
  </section></main>
}
