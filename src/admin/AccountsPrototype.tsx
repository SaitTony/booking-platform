import { useMemo, useState } from 'react'

type Member = { role: 'admin' | 'master'; company_id: string; master_id: string | null }
type Account = {
  id: string
  full_name: string
  email: string
  phone_e164: string
  platform_role: 'pending' | 'owner' | 'master_pro'
  force_password_change: boolean
  disabled_at: string | null
  company_members?: Member[]
}
type Company = { id: string; name: string; slug: string; is_active: boolean }
type MasterPage = {
  id: string
  display_name: string
  slug: string
  kind: 'individual' | 'company'
  company_id: string | null
  profile_id: string | null
  is_active: boolean
}

type Props = {
  accounts: Account[]
  companies: Company[]
  pages: MasterPage[]
  loading: boolean
  busy: boolean
  onCreate: () => void
  onSettings: (account: Account) => void
  onToggle: (account: Account) => void
}

type Tab = 'all' | 'pro' | 'staff'

function roleOf(account: Account) {
  if (account.platform_role === 'owner') return 'Owner'
  if (account.platform_role === 'master_pro') return 'Master_pro'
  const role = account.company_members?.[0]?.role
  return role === 'admin' ? 'Admin' : role === 'master' ? 'Master' : 'Не назначена'
}

function roleClass(account: Account) {
  if (account.platform_role === 'master_pro') return 'master-pro'
  const role = account.company_members?.[0]?.role
  return role === 'admin' ? 'admin' : role === 'master' ? 'master' : 'unassigned'
}

export default function AccountsPrototype({ accounts, companies, pages, loading, busy, onCreate, onSettings, onToggle,  }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')

  const visibleAccounts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru')
    return accounts
      .filter(account => account.platform_role !== 'owner')
      .filter(account => tab === 'all'
        || (tab === 'pro' && account.platform_role === 'master_pro')
        || (tab === 'staff' && account.platform_role !== 'master_pro'))
      .filter(account => !roleFilter || roleOf(account) === roleFilter)
      .filter(account => !statusFilter || (statusFilter === 'active' ? !account.disabled_at : !!account.disabled_at))
      .filter(account => !companyFilter || account.company_members?.some(member => member.company_id === companyFilter))
      .filter(account => {
        if (!query) return true
        const membership = account.company_members?.[0]
        const company = companies.find(item => item.id === membership?.company_id)
        const page = pages.find(item => item.id === (membership?.master_id ?? pages.find(p => p.kind === 'individual' && p.profile_id === account.id)?.id))
        return [account.full_name, account.email, account.phone_e164, roleOf(account), company?.name, page?.display_name]
          .some(value => String(value ?? '').toLocaleLowerCase('ru').includes(query))
      })
  }, [accounts, companies, pages, tab, search, roleFilter, statusFilter, companyFilter])

  const staffCount = accounts.filter(account => account.platform_role !== 'owner' && account.platform_role !== 'master_pro').length
  const proCount = accounts.filter(account => account.platform_role === 'master_pro').length
  const allCount = accounts.filter(account => account.platform_role !== 'owner').length
  const activeCount = accounts.filter(account => account.platform_role !== 'owner' && !account.disabled_at).length
  const disabledCount = allCount - activeCount

  function accountCompany(account: Account) {
    if (roleOf(account) === 'Master_pro') return '—'
    const membership = account.company_members?.[0]
    return companies.find(item => item.id === membership?.company_id)?.name ?? '—'
  }

  function accountPage(account: Account) {
    const membership = account.company_members?.[0]
    const ownPage = pages.find(item => item.kind === 'individual' && item.profile_id === account.id)
    const page = pages.find(item => item.id === (membership?.master_id ?? ownPage?.id))
    return page?.display_name ?? (roleOf(account) === 'Master_pro' ? 'Индивидуальная страница не создана' : '—')
  }

  return <section className="accounts-prototype">
    <div className="ap-stats ap-account-overview-stats" aria-label="Статистика учётных записей">
      <article><span>Всего учётных записей</span><strong>{allCount}</strong><small>Все пользователи платформы</small></article>
      <article><span>Активные учётные записи</span><strong>{activeCount}</strong><small>Доступ к панели открыт</small></article>
      <article><span>Master_pro</span><strong>{proCount}</strong><small>Индивидуальные специалисты</small></article>
      <article><span>Сотрудники компаний</span><strong>{staffCount}</strong><small>Администраторы и мастера</small></article>
      <article><span>Отключённые учётные записи</span><strong>{disabledCount}</strong><small>Доступ временно закрыт</small></article>
    </div>

    <div className="ap-toolbar">
      <label className="ap-search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по имени, email, телефону…" aria-label="Поиск учётных записей"/></label>
      <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} aria-label="Фильтр по роли">
        <option value="">Все роли</option><option value="Admin">Admin</option><option value="Master_pro">Master_pro</option><option value="Master">Master</option><option value="Не назначена">Не назначена</option>
      </select>
      <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Фильтр по статусу">
        <option value="">Любой статус</option><option value="active">Активные</option><option value="disabled">Отключённые</option>
      </select>
      <select value={companyFilter} onChange={event => setCompanyFilter(event.target.value)} aria-label="Фильтр по компании">
        <option value="">Все компании</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select>
      <button type="button" className="ap-primary ap-toolbar-create" onClick={onCreate}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.25a.75.75 0 0 1 .75.75v4.25H13a.75.75 0 0 1 0 1.5H8.75V13a.75.75 0 0 1-1.5 0V8.75H3a.75.75 0 0 1 0-1.5h4.25V3A.75.75 0 0 1 8 2.25Z"/></svg>Создать УЗ</button>
    </div>

    <nav className="ap-tabs" aria-label="Категории учётных записей">
      <button type="button" className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Все <span>{allCount}</span></button>
      <button type="button" className={tab === 'pro' ? 'active' : ''} onClick={() => setTab('pro')}>Мастера_pro <span>{proCount}</span></button>
      <button type="button" className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}>Сотрудники компаний <span>{staffCount}</span></button>
    </nav>

    <section className="ap-table">
      <div className="ap-table-heading"><strong>{tab === 'all' ? 'Все учётные записи' : tab === 'pro' ? 'Мастера_pro' : 'Сотрудники компаний'}</strong><span>{visibleAccounts.length} из {allCount}</span></div>
      <div className="ap-table-scroll">
        <div className="ap-grid ap-grid-head"><span>№</span><span>Пользователь</span><span>Email</span><span>Телефон</span><span>Роль</span><span>Компания</span><span>Страница</span><span>Доступ</span><span></span></div>
        {loading && accounts.length === 0 ? <div className="ap-empty">Загружаем реальные учётные записи…</div>
          : visibleAccounts.length === 0 ? <div className="ap-empty">{accounts.length === 0 ? 'В базе пока нет учётных записей сотрудников.' : 'По заданным условиям ничего не найдено.'}</div>
          : visibleAccounts.map((account, index) => <div className={'ap-grid ap-row ' + (account.disabled_at ? 'is-disabled' : '')} key={account.id}>
            <span className="ap-number">{index + 1}</span>
            <div className="ap-person"><strong>{account.full_name || 'Без имени'}</strong>{account.force_password_change && <small className="ap-warning">Ожидает смены пароля</small>}</div>
            <span className="ap-muted">{account.email || '—'}</span>
            <span className="ap-muted">{account.phone_e164 || '—'}</span>
            <span><i className={'ap-role ap-role-' + roleClass(account)}>{roleOf(account)}</i></span>
            <span className="ap-place" title={accountCompany(account)}>{accountCompany(account)}</span>
            <span className="ap-place" title={accountPage(account)}>{accountPage(account)}</span>
            <span><button type="button" className={'ap-switch ' + (!account.disabled_at ? 'is-on' : '')} role="switch" aria-checked={!account.disabled_at} aria-label={account.disabled_at ? 'Включить учётную запись' : 'Отключить учётную запись'} disabled={busy} onClick={() => onToggle(account)}><span/></button></span>
            <span><button type="button" className="ap-gear" title="Действия с учётной записью" aria-label={'Действия для ' + account.full_name} disabled={busy} onClick={() => onSettings(account)}><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.25"/><circle cx="8" cy="8" r="1.25"/><circle cx="13" cy="8" r="1.25"/></svg></button></span>
          </div>)}
      </div>
      <footer className="ap-footer">Данные загружаются из Workflows · Supabase · Изменения выполняются через существующие защищённые функции</footer>
    </section>

  </section>
}
