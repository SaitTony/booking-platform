import { useMemo, useState } from 'react'

type Company = {
  id: string
  name: string
  slug: string
  description?: string
  is_active: boolean
}
type MasterPage = { id: string; company_id: string | null; kind: 'individual' | 'company'; is_active: boolean }
type Account = { id: string; company_members?: { company_id: string }[] }

type Props = {
  companies: Company[]
  pages: MasterPage[]
  accounts: Account[]
  busy: boolean
  onCreate: () => void
  onEdit: (company: Company) => void
  onToggle: (company: Company) => void
  onDelete: (company: Company) => void
}

type Tab = 'all' | 'active' | 'inactive'

export default function CompaniesPrototype({ companies, pages, accounts, busy, onCreate, onEdit, onToggle, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const activeCount = companies.filter(company => company.is_active).length
  const inactiveCount = companies.length - activeCount
  const visibleCompanies = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru')
    return companies
      .filter(company => tab === 'all' || (tab === 'active' ? company.is_active : !company.is_active))
      .filter(company => !query || [company.name, company.slug, company.description]
        .some(value => String(value ?? '').toLocaleLowerCase('ru').includes(query)))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [companies, tab, search])

  function staffCount(companyId: string) {
    return accounts.filter(account => account.company_members?.some(member => member.company_id === companyId)).length
  }
  function pageCount(companyId: string) {
    return pages.filter(page => page.kind === 'company' && page.company_id === companyId).length
  }

  return <section className="accounts-prototype companies-prototype">
    <header className="ap-heading">
      <div><h2>Компании</h2><p>Управление компаниями, публичными страницами и доступом сотрудников</p></div>
      <button type="button" className="ap-primary" onClick={onCreate}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.25a.75.75 0 0 1 .75.75v4.25H13a.75.75 0 0 1 0 1.5H8.75V13a.75.75 0 0 1-1.5 0V8.75H3a.75.75 0 0 1 0-1.5h4.25V3A.75.75 0 0 1 8 2.25Z"/></svg>
        Создать компанию
      </button>
    </header>

    <div className="ap-stats ap-company-stats">
      <article><span>Всего компаний</span><strong>{companies.length}</strong><small>Все созданные компании</small></article>
      <article><span>Активные</span><strong>{activeCount}</strong><small>Доступны клиентам и сотрудникам</small></article>
      <article><span>Неактивные</span><strong>{inactiveCount}</strong><small>Отключённые компании</small></article>
    </div>

    <div className="ap-toolbar">
      <label className="ap-search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по названию или адресу…" aria-label="Поиск компаний"/></label>
    </div>

    <nav className="ap-tabs" aria-label="Статус компаний">
      <button type="button" className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Все <span>{companies.length}</span></button>
      <button type="button" className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>Активные <span>{activeCount}</span></button>
      <button type="button" className={tab === 'inactive' ? 'active' : ''} onClick={() => setTab('inactive')}>Неактивные <span>{inactiveCount}</span></button>
    </nav>

    <section className="ap-table">
      <div className="ap-table-heading"><strong>{tab === 'all' ? 'Все компании' : tab === 'active' ? 'Активные компании' : 'Неактивные компании'}</strong><span>{visibleCompanies.length} из {companies.length}</span></div>
      <div className="ap-table-scroll">
        <div className="ap-grid ap-company-grid ap-grid-head"><span>№</span><span>Компания</span><span>Адрес страницы</span><span>Сотрудники</span><span>Страницы мастеров</span><span>Статус</span><span>Доступ</span><span></span><span></span></div>
        {visibleCompanies.length === 0
          ? <div className="ap-empty">{companies.length === 0 ? 'Компаний пока нет. Создайте первую компанию.' : 'По заданным условиям компании не найдены.'}</div>
          : visibleCompanies.map((company, index) => <div className={'ap-grid ap-company-grid ap-row ' + (!company.is_active ? 'is-disabled' : '')} key={company.id}>
            <span className="ap-number">{index + 1}</span>
            <div className="ap-person"><strong>{company.name}</strong><small>{company.description || 'Без описания'}</small></div>
            <span className="ap-muted" title={company.slug}>/{company.slug}</span>
            <span className="ap-place">{staffCount(company.id)}</span>
            <span className="ap-place">{pageCount(company.id)}</span>
            <span><i className={'ap-role ' + (company.is_active ? 'ap-company-active' : 'ap-company-inactive')}>{company.is_active ? 'Активна' : 'Отключена'}</i></span>
            <span><button type="button" className={'ap-switch ' + (company.is_active ? 'is-on' : '')} role="switch" aria-checked={company.is_active} aria-label={company.is_active ? 'Отключить компанию' : 'Включить компанию'} disabled={busy} onClick={() => onToggle(company)}><span/></button></span>
            <span><button type="button" className="ap-gear" title="Редактировать компанию" aria-label={'Редактировать ' + company.name} disabled={busy} onClick={() => onEdit(company)}><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.25"/><circle cx="8" cy="8" r="1.25"/><circle cx="13" cy="8" r="1.25"/></svg></button></span>
            <span><button type="button" className="ap-delete" title="Удалить компанию" aria-label={'Удалить ' + company.name} disabled={busy} onClick={() => onDelete(company)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 2.5h5l.5 1.5h2v1.5H3V4h2l.5-1.5ZM4.25 6.5h7.5l-.55 7H4.8l-.55-7Zm2 1.2v4.3h1V7.7h-1Zm2.5 0v4.3h1V7.7h-1Z"/></svg></button></span>
          </div>)}
      </div>
      <footer className="ap-footer">Изменения применяются к данным Workflows · Supabase</footer>
    </section>
  </section>
}
