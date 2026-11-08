import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Profile = {
  id: string
  full_name: string
  phone_e164: string
  platform_role: 'pending' | 'owner' | 'master_pro'
  force_password_change: boolean
  disabled_at: string | null
  company_members?: Member[]
}
type Member = { role: 'admin' | 'master'; company_id: string; master_id: string | null }\ntype CompanyOption = { id: string; name: string }\ntype MasterOption = { id: string; display_name: string; kind: 'individual' | 'company'; company_id: string | null; profile_id: string | null }
type Account = Profile & { company_members?: Member[] }

const roleLabel = (profile: Account) => {
  if (profile.platform_role === 'owner') return 'Owner'
  if (profile.platform_role === 'master_pro') return 'Master_pro'
  return profile.company_members?.[0]?.role === 'admin' ? 'Admin'
    : profile.company_members?.[0]?.role === 'master' ? 'Master' : 'Ожидает назначения'
}

export default function AdminApp() {
  const [sessionReady, setSessionReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])\n  const [companies, setCompanies] = useState<CompanyOption[]>([])\n  const [masterPages, setMasterPages] = useState<MasterOption[]>([])\n  const [selectedUserId, setSelectedUserId] = useState('')\n  const [selectedRole, setSelectedRole] = useState<'admin' | 'master' | 'master_pro'>('admin')\n  const [selectedCompanyId, setSelectedCompanyId] = useState('')\n  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadProfile() {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setProfile(null); setSessionReady(true); return }
    const { data, error: profileError } = await supabase.from('profiles')
      .select('id,full_name,phone_e164,platform_role,force_password_change,disabled_at,company_members(role,company_id,master_id)')
      .eq('id', user.id).maybeSingle()
    if (profileError) setError(profileError.message)
    setProfile(data as Profile | null)
    setSessionReady(true)
  }

  async function loadDirectories() {\n    if (!supabase) return\n    const [{ data: companyData }, { data: masterData }] = await Promise.all([\n      supabase.from('companies').select('id,name').order('name'),\n      supabase.from('masters').select('id,display_name,kind,company_id,profile_id').is('archived_at', null).order('display_name'),\n    ])\n    setCompanies((companyData ?? []) as CompanyOption[])\n    setMasterPages((masterData ?? []) as MasterOption[])\n  }\n\n  async function loadAccounts() {
    if (!supabase) return
    const { data, error: listError } = await supabase.from('profiles')
      .select('id,full_name,phone_e164,platform_role,force_password_change,disabled_at,company_members(role,company_id,master_id)')
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

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    const normalizedPhone = phone.replace(/[\s()-]/g, '')
    const { error: signInError } = await supabase.auth.signInWithPassword({ phone: normalizedPhone, password })
    if (signInError) setError('Не удалось войти. Проверьте номер телефона и пароль.')
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

  async function assignRole(event: FormEvent) {\n    event.preventDefault()\n    if (!supabase || !selectedUserId) return\n    setBusy(true); setError(''); setNotice('')\n    const body = { userId: selectedUserId, role: selectedRole, companyId: selectedRole === 'master_pro' ? null : selectedCompanyId, masterId: selectedRole === 'admin' ? null : selectedMasterId }\n    const { error: assignError } = await supabase.functions.invoke('assign-user-role', { body })\n    if (assignError) setError(assignError.message)\n    else { setNotice('Роль и связь со страницей назначены.'); setSelectedUserId(''); setSelectedMasterId(''); await loadAccounts() }\n    setBusy(false)\n  }\n\n  async function createAccount(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    const { error: createError } = await supabase.functions.invoke('create-user', {
      body: { fullName, phone: phoneForCreate, temporaryPassword },
    })
    if (createError) setError(createError.message)
    else {
      setNotice('Учётная запись создана. Теперь назначьте пользователю роль и свяжите его со страницей.')
      setFullName(''); setPhoneForCreate(''); setTemporaryPassword('')
      await loadAccounts()
    }
    setBusy(false)
  }

  const [phoneForCreate, setPhoneForCreate] = useState('')

  if (!isSupabaseConfigured || !supabase) {
    return <main className="admin-shell"><section className="admin-card"><h1>Booking Space</h1><p>Supabase ещё не подключён. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в настройки окружения frontend.</p></section></main>
  }
  if (!sessionReady) return <main className="admin-shell"><section className="admin-card">Загрузка…</section></main>
  if (!profile) return <main className="admin-shell"><form className="admin-card" onSubmit={signIn}>
    <span className="eyebrow">BOOKING SPACE · ADMIN</span><h1>Вход в систему</h1>
    <label className="admin-field">Номер телефона<input type="tel" autoComplete="tel" placeholder="+358…" value={phone} onChange={e=>setPhone(e.target.value)} required /></label>
    <label className="admin-field">Пароль<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {error && <p className="admin-error">{error}</p>}
    <button className="primary-button full-button" disabled={busy}>{busy?'Входим…':'Войти'}</button>
  </form></main>

  if (profile.force_password_change) return <main className="admin-shell"><form className="admin-card" onSubmit={changePassword}>
    <span className="eyebrow">ПЕРВЫЙ ВХОД</span><h1>Создайте свой пароль</h1><p>Временный пароль больше не будет использоваться. Придумайте новый пароль длиной не менее 10 символов.</p>
    <label className="admin-field">Новый пароль<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={10} /></label>
    {error && <p className="admin-error">{error}</p>}
    <button className="primary-button full-button" disabled={busy}>{busy?'Сохраняем…':'Сменить пароль'}</button>
  </form></main>

  if (profile.disabled_at) return <main className="admin-shell"><section className="admin-card"><h1>Доступ отключён</h1><p>Обратитесь к владельцу Booking Space.</p><button className="secondary-button" onClick={()=>void supabase.auth.signOut()}>Выйти</button></section></main>
  if (profile.platform_role === 'pending' && !profile.company_members?.length) return <main className="admin-shell"><section className="admin-card"><h1>Ожидается назначение роли</h1><p>Учётная запись создана. Owner должен назначить роль и связать аккаунт с компанией или страницей мастера.</p><button className="secondary-button" onClick={()=>void supabase.auth.signOut()}>Выйти</button></section></main>

  return <main className="admin-shell"><section className="admin-wide">
    <header className="admin-top"><div><span className="eyebrow">BOOKING SPACE</span><h1>Административная панель</h1><p>{profile.full_name} · {profile.platform_role === 'owner' ? 'Owner' : roleLabel({ ...profile })}</p></div><button className="secondary-button" onClick={()=>void supabase.auth.signOut()}>Выйти</button></header>
    {notice && <p className="admin-notice">{notice}</p>}{error && <p className="admin-error">{error}</p>}
    {profile.platform_role === 'owner' ? <>
      <div className="admin-section-head"><div><span className="eyebrow">УПРАВЛЕНИЕ ДОСТУПОМ</span><h2>Пользователи</h2></div><span>{accounts.length} учётных записей</span></div>
      <form className="admin-card admin-create-form" onSubmit={createAccount}>
        <h3>Создать учётную запись</h3>
        <label className="admin-field">Имя<input value={fullName} onChange={e=>setFullName(e.target.value)} required /></label>
        <label className="admin-field">Номер телефона<input type="tel" placeholder="+358…" value={phoneForCreate} onChange={e=>setPhoneForCreate(e.target.value)} required /></label>
        <label className="admin-field">Временный пароль<input type="text" autoComplete="off" value={temporaryPassword} onChange={e=>setTemporaryPassword(e.target.value)} minLength={10} required /></label>
        <button className="primary-button" disabled={busy}>{busy?'Создаём…':'Создать учётную запись'}</button>
      </form>
      <form className="admin-card admin-create-form" onSubmit={assignRole}>
        <h3>Назначить роль и связать страницу</h3>
        <label className="admin-field">Пользователь<select value={selectedUserId} onChange={e=>setSelectedUserId(e.target.value)} required><option value="">Выберите учётную запись</option>{accounts.filter(a=>a.platform_role !== 'owner').map(a=><option key={a.id} value={a.id}>{a.full_name} · {a.phone_e164}</option>)}</select></label>
        <label className="admin-field">Роль<select value={selectedRole} onChange={e=>{setSelectedRole(e.target.value as 'admin'|'master'|'master_pro');setSelectedMasterId('')}}><option value="admin">Admin</option><option value="master">Master</option><option value="master_pro">Master_pro</option></select></label>
        {selectedRole !== 'master_pro' && <label className="admin-field">Компания<select value={selectedCompanyId} onChange={e=>{setSelectedCompanyId(e.target.value);setSelectedMasterId('')}} required><option value="">Выберите компанию</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
        {selectedRole !== 'admin' && <label className="admin-field">Страница мастера<select value={selectedMasterId} onChange={e=>setSelectedMasterId(e.target.value)} required><option value="">Выберите свободную страницу</option>{masterPages.filter(page=>!page.profile_id && (selectedRole === 'master_pro' ? page.kind === 'individual' : page.kind === 'company' && page.company_id === selectedCompanyId)).map(page=><option key={page.id} value={page.id}>{page.display_name}</option>)}</select></label>}
        <button className="primary-button" disabled={busy || !selectedUserId || (selectedRole !== 'admin' && !selectedMasterId) || (selectedRole !== 'master_pro' && !selectedCompanyId)}>{busy?'Сохраняем…':'Назначить роль'}</button>
      </form>
      <div className="admin-account-list">{accounts.map(account=><article className="admin-account" key={account.id}>
        <div><strong>{account.full_name}</strong><span>{account.phone_e164}</span></div>
        <span className="admin-role">{roleLabel(account)}</span>
        {account.force_password_change && <span className="admin-role">Требуется смена пароля</span>}
      </article>)}</div>
    </> : <section className="admin-card"><h2>Рабочее пространство</h2><p>Права доступа определены. Разделы управления будут подключаться следующими этапами.</p></section>}
  </section></main>
}
