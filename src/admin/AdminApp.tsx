import CompanySettings from './CompanySettings'
import PhoneInput, { isValidRussianPhone } from '../lib/PhoneInput'
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

function normalizeMembers(value: Member[] | Member | null | undefined): Member[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}
type CompanyOption = { id: string; name: string; slug: string; is_active: boolean }
type MasterOption = { id: string; display_name: string; slug:string; kind: 'individual' | 'company'; company_id: string | null; profile_id: string | null; is_active: boolean }
type Account = Profile & { company_members?: Member[] }

function makeSlug(value: string) {
  const map: Record<string,string> = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'}
  return value.toLowerCase().split('').map(char=>map[char] ?? char).join('').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
}
async function getFunctionErrorMessage(error: unknown, fallback: string) {
  const context = (error as { context?: Response } | null)?.context
  if (context && typeof context.clone === 'function') {
    try {
      const payload = await context.clone().json() as { error?: string; message?: string }
      if (payload.error || payload.message) return payload.error ?? payload.message ?? fallback
    } catch { /* Keep the SDK message when the response is not JSON. */ }
  }
  return error instanceof Error ? error.message : fallback
}


const adminPalettes = [
  {id:'natural',name:'Natural',desc:'Спокойный природный'},
  {id:'graphite',name:'Graphite',desc:'Строгий минимализм'},
  {id:'sand',name:'Sand',desc:'Тёплый премиум'},
  {id:'green',name:'Deep Green',desc:'Современный салон'},
  {id:'blue',name:'Midnight Blue',desc:'Технологичный'},
  {id:'dark',name:'Dark',desc:'Тёмная тема'},
] as const
type AdminTheme = typeof adminPalettes[number]['id']

type StaffRole = 'admin' | 'master' | 'master_pro'
type AccountManagementRowProps = {
  account: Account; companies: CompanyOption[]; pages: MasterOption[]; busy: boolean
  onSettings: (account: Account) => void
  onSaveChanges: (account: Account, role: StaffRole, companyId: string | null, masterId: string | null, pageName: string) => void
}
function AccountManagementRow({account,companies,pages,busy,onSettings,onSaveChanges}:AccountManagementRowProps) {
  const membership=account.company_members?.[0]
  const individualPage=pages.find(page=>page.kind==='individual'&&page.profile_id===account.id)
  const currentRole:StaffRole|''=account.platform_role==='master_pro'?'master_pro':membership?.role??''
  const [role,setRole]=useState<StaffRole|''>(currentRole)
  const [companyId,setCompanyId]=useState(membership?.company_id??'')
  const [masterId,setMasterId]=useState(membership?.master_id??individualPage?.id??'')
  const [pageName,setPageName]=useState(individualPage?.display_name??'')
  useEffect(()=>{
    setRole(currentRole);setCompanyId(membership?.company_id??'')
    setMasterId(membership?.master_id??individualPage?.id??'');setPageName(individualPage?.display_name??'')
  },[account.id,currentRole,membership?.company_id,membership?.master_id,individualPage?.id,individualPage?.display_name])
  const companyPages=pages.filter(page=>page.kind==='company'&&page.company_id===companyId&&(!page.profile_id||page.profile_id===account.id)&&page.is_active)
  const individualPages=pages.filter(page=>page.kind==='individual'&&(!page.profile_id||page.profile_id===account.id)&&page.is_active)
  const assignmentReady=role==='admin'?!!companyId:role==='master'?!!companyId&&!!masterId:role==='master_pro'?!!masterId:false
  const selectedPage=pages.find(page=>page.id===masterId)
  const initialCompanyId=membership?.company_id??''
  const initialMasterId=membership?.master_id??individualPage?.id??''
  const hasChanges=role!==currentRole||companyId!==initialCompanyId||masterId!==initialMasterId||(role==='master_pro'&&!!selectedPage&&pageName.trim()!==selectedPage.display_name)
  return <article className="admin-account admin-account-inline-row">
    <div className="account-inline-fields">
      <div className="account-inline-cell account-name-cell"><small>Сотрудник</small><strong>{account.full_name}</strong></div>
      <div className="account-inline-cell account-email-cell"><small>Email</small><strong>{account.email}</strong></div>
      <div className="account-inline-cell account-phone-cell"><small>Телефон</small><strong>{account.phone_e164}</strong></div>
      {account.platform_role==='owner'?<div className="account-inline-cell"><small>Роль</small><strong>Owner</strong></div>:<label className="account-inline-field"><small>Роль</small><select value={role} disabled={busy} onChange={event=>{const next=event.target.value as StaffRole|'';setRole(next);if(next==='master_pro'){setCompanyId('');setMasterId(individualPage?.id??individualPages[0]?.id??'')}else if(next==='master'&&!companyId){const first=companies.find(company=>company.is_active);setCompanyId(first?.id??'');setMasterId('')}else if(next==='admin'){setMasterId('')}}}><option value="">Не назначена</option><option value="admin">Admin</option><option value="master">Master</option><option value="master_pro">Master_pro</option></select></label>}
      {(role==='admin'||role==='master')&&<label className="account-inline-field account-company-field"><small>Компания</small><select value={companyId} disabled={busy} onChange={event=>{setCompanyId(event.target.value);setMasterId('')}}><option value="">Выберите компанию</option>{companies.filter(company=>company.is_active).map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
      {role==='master'&&<label className="account-inline-field account-page-field"><small>Страница мастера</small><select value={masterId} disabled={busy||!companyId} onChange={event=>setMasterId(event.target.value)}><option value="">Выберите страницу</option>{companyPages.map(page=><option key={page.id} value={page.id}>{page.display_name}</option>)}</select></label>}
      {role==='master_pro'&&<><label className="account-inline-field account-page-field"><small>Страница</small><select value={masterId} disabled={busy} onChange={event=>{setMasterId(event.target.value);setPageName(pages.find(page=>page.id===event.target.value)?.display_name??'')}}><option value="">Выберите страницу</option>{individualPages.map(page=><option key={page.id} value={page.id}>{page.display_name}</option>)}</select></label><label className="account-inline-field account-page-name-field"><small>Название страницы</small><input value={pageName} disabled={busy||!masterId} onChange={event=>setPageName(event.target.value)} /></label></>}
      {account.force_password_change&&<span className="account-force-change">Требуется смена пароля</span>}
    </div>
    {account.platform_role!=='owner'&&<div className="account-inline-actions">
      <button type="button" className="account-save-button" aria-label="Сохранить изменения учётной записи" title={hasChanges?'Сохранить изменения':'Нет изменений'} disabled={busy||!hasChanges||!assignmentReady} onClick={()=>role&&onSaveChanges(account,role,role==='master_pro'?null:companyId||null,role==='admin'?null:masterId||null,pageName)}><span aria-hidden="true">✓</span></button>
      <button type="button" className="account-settings-button" aria-label={`Настройки учётной записи ${account.full_name}`} title="Настройки учётной записи" onClick={()=>onSettings(account)}><span aria-hidden="true">⚙</span></button>
    </div>}
  </article>
}

const roleLabel = (profile: Account) => {
  if (profile.platform_role === 'owner') return 'Owner'
  if (profile.platform_role === 'master_pro') return 'Master_pro'
  return profile.company_members?.[0]?.role === 'admin' ? 'Admin'
    : profile.company_members?.[0]?.role === 'master' ? 'Master' : 'Ожидает назначения'
}

export default function AdminApp() {
  const [activeModal, setActiveModal] = useState<'account'|'reset'|'delete'|'company'|'masterPro'|'settings'|'accountSettings'|null>(null)
  const [activeSection, setActiveSection] = useState<'overview'|'accounts'|'companies'|'masterPro'>('overview')
  const [sessionReady, setSessionReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [masterPages, setMasterPages] = useState<MasterOption[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'admin' | 'master' | 'master_pro'>('admin')
  const [selectedMasterId, setSelectedMasterId] = useState('')
  const [resetUserId,setResetUserId]=useState('')
  const [temporaryPassword,setTemporaryPassword]=useState('000000')
  const [createRole,setCreateRole]=useState<'admin'|'master'|'master_pro'|''>('')
  const [createCompanyId,setCreateCompanyId]=useState('')
  const [deleteTargetId,setDeleteTargetId]=useState('')
  const [resetTemporaryPassword,setResetTemporaryPassword]=useState('000000')
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
  const [adminTheme,setAdminTheme]=useState<AdminTheme>(()=>{const saved=localStorage.getItem('workflows-admin-theme');return adminPalettes.some(item=>item.id===saved)?saved as AdminTheme:'natural'})
  const [settingsAccountId,setSettingsAccountId]=useState('')
  const [previewRole,setPreviewRole]=useState<'admin'|'master_pro'|'master'>('admin')
  const [previewAccountId,setPreviewAccountId]=useState('')
  const previewAccounts=accounts.filter(account=>previewRole==='master_pro'?account.platform_role==='master_pro':account.company_members?.some(member=>member.role===previewRole))
  const previewAccount=previewAccounts.find(account=>account.id===previewAccountId)??null
  const previewMembership=previewAccount?.company_members?.find(member=>member.role===previewRole)
  const displayedProfile:Profile|null=profile?.platform_role==='owner'&&previewAccount?{...previewAccount,platform_role:previewRole==='master_pro'?'master_pro':'pending',company_members:previewMembership?[previewMembership]:[]}:profile
  const viewCompanyId=previewAccount&&previewMembership?previewMembership.company_id:pageCompanyId
  const settingsAccount=accounts.find(account=>account.id===settingsAccountId)


  async function loadProfile() {
    if (!supabase) { setSessionReady(true); return }
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) { setProfile(null); return }
      const { data, error: profileError } = await supabase.from('profiles')
        .select('id,full_name,email,phone_e164,platform_role,force_password_change,disabled_at,company_members(role,company_id,master_id)')
        .eq('id', user.id).maybeSingle()
      if (profileError) throw profileError
      const normalizedProfile = data ? { ...data, company_members: normalizeMembers((data as Profile).company_members) } as Profile : null
      setProfile(normalizedProfile)
      const membership=normalizedProfile?.company_members?.[0]
      if(membership){setPageCompanyId(membership.company_id);if(membership.role==='admin')setPageKind('company')}
      setError('')
    } catch (profileLoadError) {
      console.error('Workflows profile load failed', profileLoadError)
      setProfile(null)
      setError(profileLoadError instanceof Error
        ? `Не удалось загрузить профиль: ${profileLoadError.message}`
        : 'Не удалось загрузить профиль. Обновите страницу и попробуйте снова.')
    } finally {
      setSessionReady(true)
    }
  }

  async function loadDirectories() {
    if (!supabase) return
    const [{ data: companyData }, { data: masterData }] = await Promise.all([
      supabase.from('companies').select('id,name,slug,is_active').order('name'),
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
    setAccounts((data ?? []).map(account => ({
      ...account,
      company_members: normalizeMembers((account as unknown as Account).company_members),
    })) as Account[])
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
    if (newPassword.length < 6) { setError('Новый пароль должен содержать не менее 6 символов.'); return }
    setBusy(true); setError('')
    const { error: updateError } = await supabase.functions.invoke('change-password', { body: { newPassword } })
    if (!updateError) { setNotice('Пароль успешно изменён.'); await loadProfile() }
    else setError(updateError.message)
    setBusy(false)
  }

  async function toggleAccountStatus(account: Account) {
    if (!supabase || account.platform_role === 'owner' || busy) return
    const disabled = !account.disabled_at
    setBusy(true); setError(''); setNotice('')
    const { error: statusError } = await supabase.functions.invoke('owner-set-account-status', {
      body: { userId: account.id, disabled },
    })
    if (statusError) setError(statusError.message)
    else { setNotice(disabled ? 'Доступ к учётной записи отключён.' : 'Доступ к учётной записи включён.'); await loadAccounts() }
    setBusy(false)
  }

  async function toggleCompanyStatus(company: CompanyOption) {
    if (!supabase || busy) return
    setBusy(true); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('companies')
      .update({ is_active: !company.is_active }).eq('id', company.id)
    if (updateError) setError(updateError.message)
    else { setNotice(company.is_active ? 'Компания отключена.' : 'Компания включена.'); await loadDirectories() }
    setBusy(false)
  }

  async function deleteAccount() {
    if (!supabase || !deleteTargetId || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: deleteError } = await supabase.functions.invoke('owner-delete-user', {
        body: { userId: deleteTargetId },
      })
      if (deleteError) {
        setError(await getFunctionErrorMessage(deleteError, 'Не удалось удалить учётную запись.'))
      } else {
        setNotice('Учётная запись полностью удалена. История записей сохранена.')
        setDeleteTargetId('')
        setSettingsAccountId('')
        setActiveModal(null)
        await Promise.all([loadAccounts(), loadDirectories()])
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось связаться с функцией удаления. Учётная запись не удалена.')
    } finally {
      setBusy(false)
    }
  }

  async function resetUserAccess(event: FormEvent) {
    event.preventDefault()
    if(!supabase||!resetUserId)return
    setBusy(true);setError('');setNotice('')
    const {error:resetError}=await supabase.functions.invoke('owner-reset-access',{body:{targetUserId:resetUserId,newTemporaryPassword:resetTemporaryPassword}})
    if(resetError)setError(resetError.message)
    else{setNotice('Временный пароль установлен. Передайте его пользователю безопасным способом — при следующем входе он должен будет сменить пароль.');setResetUserId('');setResetTemporaryPassword('000000');setActiveModal(null);await loadAccounts()}
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
    else{setNotice('Компания создана.');setCompanyName('');setCompanySlug('');setCompanyDescription('');setActiveModal(null);await loadDirectories()}
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
    else{setNotice('Страница мастера создана. Учётную запись можно связать с ней после создания пользователя.');setPageName('');setPageSlug('');setPageDescription('');setActiveModal(null);await loadDirectories()}
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


  async function saveAccountChanges(account:Account,role:StaffRole,companyId:string|null,masterId:string|null,pageName:string) {
    if(!supabase)return
    if(role==='admin'&&!companyId){setError('Для Admin необходимо выбрать компанию.');return}
    if(role==='master'&&(!companyId||!masterId)){setError('Для Master необходимо выбрать компанию и страницу мастера.');return}
    if(role==='master_pro'&&!masterId){setError('Для Master_pro необходимо выбрать индивидуальную страницу.');return}
    const membership=account.company_members?.[0]
    const individualPage=masterPages.find(page=>page.kind==='individual'&&page.profile_id===account.id)
    const currentRole:StaffRole|''=account.platform_role==='master_pro'?'master_pro':membership?.role??''
    const currentCompanyId=membership?.company_id??''
    const currentMasterId=membership?.master_id??individualPage?.id??''
    const assignmentChanged=role!==currentRole||companyId!==currentCompanyId||masterId!==currentMasterId
    const selectedPage=masterPages.find(page=>page.id===masterId)
    const pageNameChanged=role==='master_pro'&&!!selectedPage&&pageName.trim()!==selectedPage.display_name
    if(!assignmentChanged&&!pageNameChanged)return
    setBusy(true);setError('');setNotice('')
    try {
      if(assignmentChanged){
        const {error:assignError}=await supabase.functions.invoke('assign-user-role',{body:{userId:account.id,role,companyId:role==='master_pro'?null:companyId,masterId:role==='admin'?null:masterId}})
        if(assignError){setError(await getFunctionErrorMessage(assignError,'Не удалось сохранить роль и привязки учётной записи.'));return}
      }
      if(pageNameChanged&&selectedPage){
        const {error:updateError}=await supabase.from('masters').update({display_name:pageName.trim()}).eq('id',selectedPage.id)
        if(updateError){setError(updateError.message);return}
      }
      setNotice('Изменения учётной записи сохранены.')
      await Promise.all([loadAccounts(),loadDirectories()])
    } catch(saveError) {
      setError(saveError instanceof Error?saveError.message:'Не удалось сохранить изменения учётной записи.')
    } finally {
      setBusy(false)
    }
  }


  async function createAccount(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (!isValidRussianPhone(phoneForCreate.trim())) { setError('Введите номер в формате +7 и ровно 10 цифр после кода страны.'); return }
    if (!createRole) { setError('Выберите роль сотрудника.'); return }
    if (createRole === 'admin' && !companyName.trim()) { setError('Укажите название компании для Admin.'); return }
    if (createRole === 'master' && !createCompanyId) { setError('Для Master необходимо выбрать компанию.'); return }
    const pageBaseSlug = makeSlug(fullName)
    const pageSlug = pageBaseSlug ? pageBaseSlug + '-' + Math.random().toString(36).slice(2, 8) : ''
    const companyBaseSlug = makeSlug(companyName)
    const companySlugForCreate = companyBaseSlug ? companyBaseSlug + '-' + Math.random().toString(36).slice(2, 8) : ''
    if ((createRole === 'master' || createRole === 'master_pro') && !pageSlug) { setError('Добавьте имя, из которого можно сформировать адрес страницы.'); return }
    if (createRole === 'admin' && !companySlugForCreate) { setError('Название компании должно содержать буквы или цифры.'); return }
    setBusy(true); setError(''); setNotice('')
    const { error: createError } = await supabase.functions.invoke('create-user', {
      body: {
        fullName, email: emailForCreate, phone: phoneForCreate, temporaryPassword,
        role: createRole,
        companyId: createRole === 'master' ? createCompanyId : null,
        companyName: createRole === 'admin' ? companyName.trim() : null,
        companySlug: createRole === 'admin' ? companySlugForCreate : null,
        pageName: fullName.trim(),
        pageSlug: createRole === 'master' || createRole === 'master_pro' ? pageSlug : null,
      },
    })
    if (createError) setError(await getFunctionErrorMessage(createError, 'Не удалось создать учётную запись.'))
    else {
      setNotice('Учётная запись и связанные страницы созданы.')
      setFullName(''); setEmailForCreate(''); setPhoneForCreate(''); setTemporaryPassword('000000')
      setCreateRole(''); setCreateCompanyId(''); setCompanyName(''); setCompanySlug(''); setActiveModal(null)
      await Promise.all([loadAccounts(), loadDirectories()])
    }
    setBusy(false)
  }

  const [emailForCreate, setEmailForCreate] = useState('')
  const [phoneForCreate, setPhoneForCreate] = useState('')

  if (!sessionReady && supabase) return <main className="admin-shell"><section className="admin-card">Загрузка…</section></main>
  if (!profile) return <main className="admin-shell"><form className="admin-card" onSubmit={signIn}>
    <span className="eyebrow">Workflows project</span><h1>Административная панель</h1>
    <label className="admin-field">Email<input type="email" autoComplete="username" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
    <label className="admin-field">Пароль<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
    {!isSupabaseConfigured && <p className="admin-error">Авторизация пока не подключена. Для входа необходимо настроить соединение с базой данных.</p>}
    {error && <p className="admin-error">{error}</p>}
    <button className="primary-button full-button" disabled={busy || !supabase}>{busy?'Входим…':'Войти'}</button>
  </form></main>

  if (profile.force_password_change) return <main className="admin-shell"><form className="admin-card" onSubmit={changePassword}>
    <span className="eyebrow">ПЕРВЫЙ ВХОД</span><h1>Создайте свой пароль</h1><p>Временный пароль больше не будет использоваться. Придумайте новый пароль длиной не менее 6 символов.</p>
    <label className="admin-field">Новый пароль<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={6} /></label>
    {error && <p className="admin-error">{error}</p>}
    <button className="primary-button full-button" disabled={busy}>{busy?'Сохраняем…':'Сменить пароль'}</button>
  </form></main>

  if (profile.disabled_at) return <main className="admin-shell"><section className="admin-card"><h1>Доступ отключён</h1><p>Обратитесь к владельцу платформы.</p><button className="secondary-button" onClick={()=>void supabase?.auth.signOut()}>Выйти</button></section></main>
  if (profile.platform_role === 'pending' && !profile.company_members?.length) return <main className="admin-shell"><section className="admin-card"><h1>Ожидается назначение роли</h1><p>Учётная запись создана. Owner должен назначить роль и связать аккаунт с компанией или страницей мастера.</p><button className="secondary-button" onClick={()=>void supabase?.auth.signOut()}>Выйти</button></section></main>

  return <main className="admin-shell" data-admin-theme={adminTheme} data-preview-mode={previewAccount?'true':undefined}><section className="admin-wide">
    <header className="admin-top"><div className="admin-branding"><span className="eyebrow">WORKFLOWS</span><h1>Административная панель</h1><p>{displayedProfile?.full_name??profile.full_name} · {previewAccount?roleLabel(previewAccount):profile.platform_role === 'owner' ? 'Owner' : roleLabel({ ...profile })}{previewAccount?' · Режим просмотра':''}</p></div><div className="admin-top-actions"><button type="button" className="secondary-button admin-settings-trigger" aria-label="Настройки панели" title="Настройки панели" onClick={()=>setActiveModal('settings')}>⚙</button><button className="secondary-button logout-button" onClick={()=>void supabase?.auth.signOut()}>Выйти</button></div></header>
    {notice && <p className="admin-notice">{notice}</p>}{error && !activeModal && <p className="admin-error">{error}</p>}
    {profile.platform_role === 'owner' && !previewAccount ? <>
      <div className="admin-workspace-layout">
        <aside className="admin-sidebar" aria-label="Разделы панели">
          <span className="admin-sidebar-label">МЕНЮ</span>
          <button className={activeSection==='overview'?'active':''} onClick={()=>setActiveSection('overview')}><span>⌂</span>Обзор</button>
          <button className={activeSection==='accounts'?'active':''} onClick={()=>setActiveSection('accounts')}><span>♙</span>Учётные записи</button>
          <button className={activeSection==='companies'?'active':''} onClick={()=>setActiveSection('companies')}><span>▦</span>Компании</button>
          <button className={activeSection==='masterPro'?'active':''} onClick={()=>setActiveSection('masterPro')}><span>✦</span>Master_pro</button>
        </aside>
        <div className="admin-main-content">
          {activeSection==='overview' && <section className="admin-overview">
            <h2>Обзор системы</h2>
            <section className="admin-stats" aria-label="Сводная статистика">
              <article className="admin-stat-card"><span>Учётные записи</span><strong>{accounts.length}</strong><small>{accounts.filter(account=>!account.disabled_at).length} активных</small></article>
              <article className="admin-stat-card"><span>Компании</span><strong>{companies.length}</strong><small>{companies.filter(company=>company.is_active).length} активных</small></article>
              <article className="admin-stat-card"><span>Страницы мастеров</span><strong>{masterPages.length}</strong><small>{masterPages.filter(page=>page.is_active).length} активных</small></article>
            </section>
          </section>}
      {activeSection==='accounts' && <section className="admin-accounts-workspace">
        <header className="admin-accounts-toolbar">
          <button className="primary-button admin-create-account-button" onClick={()=>{setTemporaryPassword('000000');setCreateRole('');setCreateCompanyId('');setCompanyName('');setCompanySlug('');setActiveModal('account')}}><span>＋</span> Создать УЗ</button>
          <div className="admin-account-stats">
            <div className="admin-account-stat"><small>Всего УЗ</small><strong>{accounts.length}</strong></div>
            <div className="admin-account-stat"><small>Активно УЗ</small><strong>{accounts.filter(account=>!account.disabled_at).length}</strong></div>
          </div>
        </header>
        <div className="admin-account-list admin-account-list-inline">
          {accounts.length?accounts.map(account=><AccountManagementRow key={account.id} account={account} companies={companies} pages={masterPages} busy={busy}
            onSettings={item=>{setSettingsAccountId(item.id);setActiveModal('accountSettings')}}
            onSaveChanges={(account,role,companyId,masterId,pageName)=>void saveAccountChanges(account,role,companyId,masterId,pageName)}/>):<p className="admin-empty">Учётных записей пока нет.</p>}
        </div>
      </section>}

      {activeSection==='companies' && <section className="admin-accordion admin-panel-section">
        <header className="admin-panel-heading"><h2>Компании</h2><span className="accordion-count">{companies.length}</span></header>
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
                    <div className="admin-account company-status-row"><div><strong>Статус компании</strong><span>{company.is_active?'Компания активна':'Компания отключена'}</span></div><button type="button" className={`admin-switch ${company.is_active?'is-on':''}`} role="switch" aria-checked={company.is_active} aria-label={company.is_active?'Отключить компанию':'Включить компанию'} disabled={busy} onClick={()=>void toggleCompanyStatus(company)}><span/></button></div>
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
              <button className="admin-action-card admin-action-card-wide" onClick={()=>setActiveModal('company')}><span className="admin-action-icon">＋</span><strong>Создать компанию</strong><small>Добавить новую компанию и подготовить её публичную страницу</small></button>
            </div>
          </details>
        </div>
      </section>}

      {activeSection==='masterPro' && <section className="admin-accordion admin-panel-section">
        <header className="admin-panel-heading"><h2>Master_pro</h2><span className="accordion-count">{masterPages.filter(page=>page.kind==='individual').length}</span></header>
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
              <button className="admin-action-card admin-action-card-wide" onClick={()=>{setPageKind('individual');setActiveModal('masterPro')}}><span className="admin-action-icon">＋</span><strong>Создать страницу Master_pro</strong><small>Новая индивидуальная страница специалиста</small></button>
            </div>
          </details>
        </div>
      </section>}
        </div>
      </div>
    </> : displayedProfile?.company_members?.some(member=>member.role==='admin') ? <>
      <div className="admin-section-head"><div><span className="eyebrow">УПРАВЛЕНИЕ КОМПАНИЕЙ</span><h2>Страницы мастеров</h2></div></div>
      {!previewAccount&&<form className="admin-card admin-create-form" onSubmit={createMasterPage}>
        <h3>Создать страницу мастера</h3>
        <p>Новая страница будет добавлена в вашу компанию. Максимум — пять активных страниц.</p>
        <label className="admin-field">Имя мастера<input value={pageName} onChange={e=>{setPageName(e.target.value);setPageSlug(makeSlug(e.target.value))}} required /></label>
        <label className="admin-field">Адрес страницы (slug)<input value={pageSlug} onChange={e=>setPageSlug(makeSlug(e.target.value))} required pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
        <label className="admin-field">Описание<input value={pageDescription} onChange={e=>setPageDescription(e.target.value)} /></label>
        <button className="primary-button" disabled={busy || !viewCompanyId}>Создать страницу мастера</button>
      </form>}
      <div className="admin-account-list">{masterPages.filter(page=>page.kind==='company'&&page.company_id===viewCompanyId).map(page=><article className="admin-account" key={page.id}><div><strong>{page.display_name}</strong><span>/{companies.find(item=>item.id===page.company_id)?.name ?? 'company'}/{page.slug}</span></div><span className="admin-role">{page.is_active?'Активна':'Отключена'}</span>{!previewAccount&&<button className="secondary-button" onClick={()=>void toggleMasterPage(page)}>{page.is_active?'Отключить':'Включить'}</button>}</article>)}</div>
      <CompanySettings isOwner={false} companyId={viewCompanyId} readOnly={!!previewAccount}/>
      <StaffWorkspace profile={displayedProfile??profile} kindFilter="company" companyIdFilter={viewCompanyId} readOnly={!!previewAccount}/>
    </> : <StaffWorkspace profile={displayedProfile??profile} readOnly={!!previewAccount}/>}
    {activeModal && <div className="admin-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setActiveModal(null)}}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
        <button className="admin-modal-close" aria-label="Закрыть" onClick={()=>setActiveModal(null)}>×</button>
        <span className="eyebrow">WORKFLOWS PROJECT</span>
        {error && <p className="admin-error admin-modal-error" role="alert">{error}</p>}
        {activeModal==='settings'&&<div className="admin-settings-modal">
          <h2 id="admin-modal-title">Настройки панели</h2>
          <section className="admin-theme-picker"><div className="admin-theme-heading"><div><span className="eyebrow">ОФОРМЛЕНИЕ ПАНЕЛИ</span><h3>Цветовая тема</h3><p>Выберите палитру административной панели.</p></div><span className="admin-theme-current">{adminPalettes.find(item=>item.id===adminTheme)?.name}</span></div>
            <div className="theme-options admin-theme-options">{adminPalettes.map(item=><button type="button" key={item.id} className={`theme-option ${adminTheme===item.id?'active':''}`} onClick={()=>{setAdminTheme(item.id);localStorage.setItem('workflows-admin-theme',item.id)}}><span className={`palette palette-${item.id}`}><i/><i/><i/><i/></span><span><b>{item.name}</b><small>{item.desc}</small></span>{adminTheme===item.id&&<em>✓</em>}</button>)}</div>
          </section>
          {profile.platform_role==='owner'&&<section className="admin-preview-settings"><h3>Просмотр панели от лица сотрудника</h3><p>Выберите роль и конкретную учётную запись. Это предварительный просмотр: реальные права и данные не меняются.</p>
            <label className="admin-field">Тип учётной записи<select value={previewRole} onChange={event=>{setPreviewRole(event.target.value as 'admin'|'master_pro'|'master');setPreviewAccountId('')}}><option value="admin">Admin</option><option value="master_pro">Master_pro</option><option value="master">Master</option></select></label>
            <label className="admin-field">Конкретная учётная запись<select value={previewAccountId} onChange={event=>setPreviewAccountId(event.target.value)}><option value="">Не выбрана — режим Owner</option>{previewAccounts.map(account=><option key={account.id} value={account.id}>{account.full_name} · {account.email}</option>)}</select></label>
            {previewAccount&&<button type="button" className="secondary-button" onClick={()=>{setPreviewAccountId('');setActiveModal(null)}}>Вернуться к панели Owner</button>}
          </section>}
        </div>}
        {activeModal==='accountSettings'&&settingsAccount&&<div className="admin-account-settings-modal">
          <h2 id="admin-modal-title">Настройки учётной записи</h2><p className="admin-modal-intro"><strong>{settingsAccount.full_name}</strong><br/>{settingsAccount.email}</p>
          <div className="account-settings-list">
            <div className="account-setting-row"><div><strong>Видимость учётной записи</strong><span>{settingsAccount.disabled_at?'Учётная запись отключена':'Учётная запись активна'}</span></div><button type="button" className={`admin-switch ${!settingsAccount.disabled_at?'is-on':''}`} role="switch" aria-checked={!settingsAccount.disabled_at} aria-label={settingsAccount.disabled_at?'Включить учётную запись':'Отключить учётную запись'} disabled={busy} onClick={()=>void toggleAccountStatus(settingsAccount)}><span/></button></div>
            <div className="account-setting-row"><div><strong>Сбросить пароль</strong><span>Установить сотруднику временный пароль</span></div><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setResetUserId(settingsAccount.id);setResetTemporaryPassword('000000');setActiveModal('reset')}}>Сбросить</button></div>
            <div className="account-setting-row"><div><strong>Удалить УЗ</strong><span>Удалить учётную запись и профиль сотрудника</span></div><button type="button" className="danger-button" disabled={busy} onClick={()=>{setDeleteTargetId(settingsAccount.id);setActiveModal('delete')}}>Удалить</button></div>
          </div>
        </div>}
        {activeModal==='account'&&<form onSubmit={createAccount}>
          <h2 id="admin-modal-title">Новая учётная запись</h2><p className="admin-modal-intro">Заполните данные сотрудника и назначьте ему роль сразу при создании.</p>
          <label className="admin-field">Имя<input value={fullName} onChange={e=>setFullName(e.target.value)} required autoFocus/></label>
          <label className="admin-field">Email<input type="email" placeholder="name@example.com" value={emailForCreate} onChange={e=>setEmailForCreate(e.target.value)} required/></label>
          <label className="admin-field">Контактный номер телефона<PhoneInput value={phoneForCreate} onChange={setPhoneForCreate} required/></label>
          <label className="admin-field">Роль<select value={createRole} onChange={e=>{setCreateRole(e.target.value as 'admin'|'master'|'master_pro'|'');setCreateCompanyId('');setCompanyName('');setCompanySlug('')}} required><option value="">Выберите роль</option><option value="admin">Admin</option><option value="master">Master</option><option value="master_pro">Master_pro</option></select></label>
          {createRole==='admin'&&<label className="admin-field">Название компании<input value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Название новой компании" required/></label>}
          {createRole==='master'&&<label className="admin-field">Компания<select value={createCompanyId} onChange={e=>setCreateCompanyId(e.target.value)} required><option value="">Выберите компанию</option>{companies.filter(company=>company.is_active).map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select><small>Страница мастера будет создана автоматически в выбранной компании.</small></label>}
          {createRole==='master_pro'&&<p className="admin-modal-intro">Индивидуальная страница будет создана автоматически и связана с учётной записью.</p>}
          {createRole==='admin'&&<p className="admin-modal-intro">Страница компании будет создана автоматически и связана с учётной записью Admin.</p>}
          <label className="admin-field">Временный пароль<input type="text" autoComplete="new-password" minLength={6} value={temporaryPassword} onChange={e=>setTemporaryPassword(e.target.value)} required/></label>
          <p className="admin-modal-intro">После первого входа сотрудник должен будет задать собственный пароль.</p>
          <button className="primary-button" disabled={busy||!isValidRussianPhone(phoneForCreate)||!createRole||(createRole==='admin'&&!companyName.trim())||(createRole==='master'&&!createCompanyId)}>{busy?'Создаём…':'Создать учётную запись'}</button>
        </form>}
        {activeModal==='delete'&&<div>
          <h2 id="admin-modal-title">Удалить учётную запись?</h2>
          <p className="admin-modal-intro">Будет безвозвратно удалён пользователь <strong>{accounts.find(account=>account.id===deleteTargetId)?.full_name??''}</strong>, его запись профиля и данные авторизации. История записей клиентов сохранится.</p>
          <div className="admin-modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>setActiveModal(null)}>Отмена</button><button type="button" className="danger-button" disabled={busy} onClick={()=>void deleteAccount()}>{busy?'Удаляем…':'Да, удалить УЗ'}</button></div>
        </div>}
        {activeModal==='reset'&&<form onSubmit={resetUserAccess}>
          <h2 id="admin-modal-title">Сбросить пароль</h2><p className="admin-modal-intro">Для пользователя <strong>{accounts.find(account=>account.id===resetUserId)?.full_name??''}</strong> будет установлен временный пароль. При следующем входе его нужно будет сменить.</p>
          <label className="admin-field">Новый временный пароль<input type="text" autoComplete="new-password" minLength={6} value={resetTemporaryPassword} onChange={e=>setResetTemporaryPassword(e.target.value)} required/></label>
          <div className="admin-modal-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>setActiveModal(null)}>Назад</button><button className="primary-button" disabled={busy||!resetUserId}>Сбросить пароль</button></div>
        </form>}
        {activeModal==='company'&&<form onSubmit={createCompany}>
          <h2 id="admin-modal-title">Создать компанию</h2><p className="admin-modal-intro">Создайте отдельное пространство компании. После этого можно добавить сотрудников и страницы мастеров.</p>
          <label className="admin-field">Название компании<input value={companyName} onChange={e=>{setCompanyName(e.target.value);setCompanySlug(makeSlug(e.target.value))}} required autoFocus/></label>
          <label className="admin-field">Адрес страницы (slug)<input value={companySlug} onChange={e=>setCompanySlug(makeSlug(e.target.value))} required pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label>
          <label className="admin-field">Описание<input value={companyDescription} onChange={e=>setCompanyDescription(e.target.value)}/></label>
          <button className="primary-button" disabled={busy}>{busy?'Создаём…':'Создать компанию'}</button>
        </form>}
        {activeModal==='masterPro'&&<form onSubmit={createMasterPage}>
          <h2 id="admin-modal-title">Создать страницу Master_pro</h2><p className="admin-modal-intro">Индивидуальная страница специалиста, не привязанная к компании.</p>
          <label className="admin-field">Имя мастера<input value={pageName} onChange={e=>{setPageKind('individual');setPageName(e.target.value);setPageSlug(makeSlug(e.target.value))}} required autoFocus/></label>
          <label className="admin-field">Адрес страницы (slug)<input value={pageSlug} onChange={e=>setPageSlug(makeSlug(e.target.value))} required pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label>
          <label className="admin-field">Описание<input value={pageDescription} onChange={e=>setPageDescription(e.target.value)}/></label>
          <button className="primary-button" disabled={busy}>{busy?'Создаём…':'Создать страницу'}</button>
        </form>}
      </section>
    </div>}
  </section></main>
}
