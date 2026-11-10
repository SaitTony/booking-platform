import { useMemo, useState } from 'react'

type MasterProAccount = {
  id: string
  full_name: string
  email: string
  disabled_at: string | null
}

type MasterPage = {
  id: string
  display_name: string
  slug: string
  kind: 'individual' | 'company'
  company_id: string | null
  profile_id: string | null
  is_active: boolean
  archived_at: string | null
}

type Props = {
  accounts: MasterProAccount[]
  pages: MasterPage[]
  loading: boolean
  busy: boolean
  onTogglePage: (page: MasterPage) => void
  onArchivePage: (page: MasterPage, accountId?: string) => void
}

type Filter = 'all' | 'published' | 'draft' | 'missing' | 'disabled' | 'archived'

export default function MasterProManagementTable({ accounts, pages, loading, busy, onTogglePage, onArchivePage }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const masterPros = accounts
  const individualPages = pages.filter(page => page.kind === 'individual')
  const archivedPages = individualPages.filter(page => !!page.archived_at)
  const pageFor = (account: MasterProAccount) => individualPages.find(page => page.profile_id === account.id && !page.archived_at) ?? individualPages.find(page => page.profile_id === account.id && !!page.archived_at) ?? individualPages.find(page => !!page.archived_at && !page.profile_id && page.display_name.trim().toLocaleLowerCase('ru') === account.full_name.trim().toLocaleLowerCase('ru'))
  const publishedCount = masterPros.filter(account => { const page=pageFor(account); return !!page?.is_active && !page.archived_at }).length
  const draftCount = masterPros.filter(account => { const page=pageFor(account); return !!page && !page.is_active && !page.archived_at }).length
  const missingCount = masterPros.filter(account => !pageFor(account)).length
  const disabledCount = masterPros.filter(account => account.disabled_at).length
  const archivedCount = archivedPages.length

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru')
    return masterPros.filter(account => {
      const page = pageFor(account)
      const matchesFilter = filter === 'all'
        || (filter === 'published' && !!page?.is_active && !page.archived_at)
        || (filter === 'draft' && !!page && !page.is_active && !page.archived_at)
        || (filter === 'missing' && !page)
        || (filter === 'disabled' && !!account.disabled_at)
        || (filter === 'archived' && !!page?.archived_at)
      const matchesSearch = !query || [account.full_name, account.email, page?.display_name, page?.slug]
        .some(value => String(value ?? '').toLocaleLowerCase('ru').includes(query))
      return matchesFilter && matchesSearch
    }).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
  }, [masterPros, filter, search, individualPages])

  const tabs: {id:Filter;label:string;count:number}[] = [
    {id:'all',label:'Все',count:masterPros.length},
    {id:'published',label:'Опубликованы',count:publishedCount},
    {id:'draft',label:'Черновики',count:draftCount},
    {id:'missing',label:'Без страницы',count:missingCount},
    {id:'disabled',label:'Отключённые УЗ',count:disabledCount},
    {id:'archived',label:'Архив',count:archivedCount},
  ]

  return <section className="accounts-prototype master-pro-management">
    <div className="ap-stats ap-company-stats mp-management-stats">
      <article><span>Всего Master_pro</span><strong>{masterPros.length}</strong><small>Самостоятельные специалисты</small></article>
      <article><span>Опубликовано страниц</span><strong>{publishedCount}</strong><small>Доступны клиентам</small></article>
      <article><span>Черновики</span><strong>{draftCount + missingCount}</strong><small>{missingCount} ещё не созданы</small></article>
      <article><span>Отключённые УЗ</span><strong>{disabledCount}</strong><small>Доступ к кабинету закрыт</small></article>
      <article><span>В архиве</span><strong>{archivedCount}</strong><small>Страницы можно восстановить</small></article>
    </div>

    <header className="ap-heading">
      <div><h2>Master_pro</h2><p>Индивидуальные специалисты и их публичные страницы вне компаний</p></div>
    </header>

    <div className="ap-toolbar">
      <label className="ap-search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по имени, email или адресу страницы…" aria-label="Поиск Master_pro"/></label>
    </div>

    <nav className="ap-tabs" aria-label="Фильтр индивидуальных специалистов">
      {tabs.map(tab => <button type="button" key={tab.id} className={filter === tab.id ? 'active' : ''} onClick={() => setFilter(tab.id)}>{tab.label} <span>{tab.count}</span></button>)}
    </nav>

    <section className="ap-table">
      <div className="ap-table-heading"><strong>{tabs.find(tab => tab.id === filter)?.label ?? 'Все специалисты'}</strong><span>{visible.length} из {masterPros.length}</span></div>
      <div className="ap-table-scroll">
        <div className="ap-grid mp-management-grid ap-grid-head"><span>№</span><span>Специалист</span><span>Email</span><span>Индивидуальная страница</span><span>Публикация</span><span>Доступ</span><span>Архивация</span></div>
        {loading && masterPros.length === 0 ? <div className="ap-empty">Загружаем учётные записи…</div>
          : visible.length === 0 ? <div className="ap-empty">{masterPros.length ? 'По заданным условиям ничего не найдено.' : 'Учётных записей Master_pro пока нет.'}</div>
          : visible.map((account, index) => {
            const page = pageFor(account)
            return <div className={'ap-grid mp-management-grid ap-row ' + (account.disabled_at ? 'is-disabled' : '')} key={account.id}>
              <span className="ap-number">{index + 1}</span>
              <div className="ap-person"><strong>{account.full_name || 'Без имени'}</strong><small>{account.disabled_at ? 'Учётная запись отключена' : 'Индивидуальный специалист'}</small><button type="button" className="ap-detail-trigger" onClick={() => setSelectedAccountId(current => current === account.id ? null : account.id)} aria-expanded={selectedAccountId === account.id}>Подробнее</button></div>
              <span className="ap-muted">{account.email || '—'}</span>
              <div className="mp-management-page">{page ? <><strong>{page.display_name}</strong><a href={`https://saittony.github.io/workflows/pro/${page.slug}`} target="_blank" rel="noreferrer">/pro/{page.slug}</a>{page.archived_at && <small className="mp-archived-label">В архиве</small>}</> : <span>Нет связанной страницы</span>}</div>
              <span>{page ? <button type="button" className={'ap-switch ' + (page.is_active && !page.archived_at ? 'is-on' : '')} role="switch" aria-checked={page.is_active && !page.archived_at} aria-label={page.is_active && !page.archived_at ? 'Отключить страницу' : 'Включить страницу'} disabled={busy || !!page.archived_at} onClick={() => onTogglePage(page)}><span/></button> : <i className="ap-role ap-company-inactive">Нет страницы</i>}</span>
              <span><i className={'ap-role ' + (!account.disabled_at ? 'ap-company-active' : 'ap-company-inactive')}>{account.disabled_at ? 'Отключён' : 'Активен'}</i></span>
              <span className="mp-management-actions">{page ? <button type="button" className="ap-secondary mp-archive-action" disabled={busy} onClick={() => onArchivePage(page, account.id)}>{page.archived_at ? 'Вернуть из архива' : 'В архив'}</button> : '—'}</span>
            </div>
          })}
      </div>
      <footer className="ap-footer">Индивидуальные страницы не входят в структуру компаний. Admin компаний не имеет к ним доступа.</footer>
    </section>
    {visible.find(account => account.id === selectedAccountId) && (() => {
      const account = visible.find(item => item.id === selectedAccountId)!
      const page = pageFor(account)
      const isPublished = !!page?.is_active && !page.archived_at
      return <aside className="ap-account-detail mp-account-detail" aria-label="Карточка Master_pro">
        <div className="ap-account-detail-heading">
          <div><span className="rd-kicker">ИНДИВИДУАЛЬНЫЙ СПЕЦИАЛИСТ</span><h3>{account.full_name || 'Без имени'}</h3><p>{account.disabled_at ? 'Доступ к кабинету отключён' : 'Доступ к кабинету активен'}</p></div>
          <button type="button" className="ap-detail-close" onClick={() => setSelectedAccountId(null)} aria-label="Закрыть карточку">×</button>
        </div>
        <div className="ap-account-detail-grid">
          <div><small>Email</small><strong>{account.email || '—'}</strong></div>
          <div><small>Доступ к кабинету</small><strong>{account.disabled_at ? 'Отключён' : 'Активен'}</strong></div>
          <div><small>Публичная страница</small><strong>{page?.display_name || 'Не создана'}</strong></div>
          <div><small>Адрес страницы</small><strong>{page ? '/pro/' + page.slug : '—'}</strong></div>
          <div><small>Публикация</small><strong>{!page ? 'Нет страницы' : page.archived_at ? 'В архиве' : isPublished ? 'Опубликована' : 'Черновик'}</strong></div>
          <div><small>Тип профиля</small><strong>Независимый Master_pro</strong></div>
        </div>
        <div className="ap-account-detail-actions">
          {page && !page.archived_at && <button type="button" className="ap-secondary" disabled={busy} onClick={() => onTogglePage(page)}>{isPublished ? 'Снять с публикации' : 'Опубликовать страницу'}</button>}
          {page && <button type="button" className="ap-secondary" disabled={busy} onClick={() => onArchivePage(page, account.id)}>{page.archived_at ? 'Вернуть из архива' : 'В архив'}</button>}
          {page && !page.archived_at && <a className="ap-secondary mp-open-page" href={'https://saittony.github.io/workflows/pro/' + page.slug} target="_blank" rel="noreferrer">Открыть публичную страницу ↗</a>}
        </div>
      </aside>
    })()}
  </section>
}
