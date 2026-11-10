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
}

type Props = {
  accounts: MasterProAccount[]
  pages: MasterPage[]
  loading: boolean
  busy: boolean
  onCreatePage: (account: MasterProAccount) => void
  onCreateAccount: () => void
  onTogglePage: (page: MasterPage) => void
  onArchivePage: (page: MasterPage) => void
}

type Filter = 'all' | 'published' | 'draft' | 'missing' | 'disabled'

export default function MasterProManagementTable({ accounts, pages, loading, busy, onCreatePage, onCreateAccount, onTogglePage, onArchivePage }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const masterPros = accounts
  const individualPages = pages.filter(page => page.kind === 'individual')
  const pageFor = (account: MasterProAccount) => individualPages.find(page => page.profile_id === account.id)
  const publishedCount = masterPros.filter(account => pageFor(account)?.is_active).length
  const draftCount = masterPros.filter(account => pageFor(account) && !pageFor(account)?.is_active).length
  const missingCount = masterPros.filter(account => !pageFor(account)).length
  const disabledCount = masterPros.filter(account => account.disabled_at).length

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru')
    return masterPros.filter(account => {
      const page = pageFor(account)
      const matchesFilter = filter === 'all'
        || (filter === 'published' && !!page?.is_active)
        || (filter === 'draft' && !!page && !page.is_active)
        || (filter === 'missing' && !page)
        || (filter === 'disabled' && !!account.disabled_at)
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
  ]

  return <section className="accounts-prototype master-pro-management">
    <header className="ap-heading">
      <div><h2>Master_pro</h2><p>Индивидуальные специалисты и их публичные страницы вне компаний</p></div><button type="button" className="ap-primary" onClick={onCreateAccount}>＋ Создать Master_pro</button>
    </header>

    <div className="ap-stats ap-company-stats mp-management-stats">
      <article><span>Всего Master_pro</span><strong>{masterPros.length}</strong><small>Самостоятельные специалисты</small></article>
      <article><span>Опубликовано страниц</span><strong>{publishedCount}</strong><small>Доступны клиентам</small></article>
      <article><span>Черновики</span><strong>{draftCount + missingCount}</strong><small>{missingCount} ещё не созданы</small></article>
      <article><span>Отключённые УЗ</span><strong>{disabledCount}</strong><small>Доступ к кабинету закрыт</small></article>
    </div>

    <div className="ap-toolbar">
      <label className="ap-search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Поиск по имени, email или адресу страницы…" aria-label="Поиск Master_pro"/></label>
    </div>

    <nav className="ap-tabs" aria-label="Фильтр индивидуальных специалистов">
      {tabs.map(tab => <button type="button" key={tab.id} className={filter === tab.id ? 'active' : ''} onClick={() => setFilter(tab.id)}>{tab.label} <span>{tab.count}</span></button>)}
    </nav>

    <section className="ap-table">
      <div className="ap-table-heading"><strong>{tabs.find(tab => tab.id === filter)?.label ?? 'Все специалисты'}</strong><span>{visible.length} из {masterPros.length}</span></div>
      <div className="ap-table-scroll">
        <div className="ap-grid mp-management-grid ap-grid-head"><span>№</span><span>Специалист</span><span>Email</span><span>Индивидуальная страница</span><span>Публикация</span><span>Доступ</span><span>Действия</span></div>
        {loading && masterPros.length === 0 ? <div className="ap-empty">Загружаем учётные записи…</div>
          : visible.length === 0 ? <div className="ap-empty">{masterPros.length ? 'По заданным условиям ничего не найдено.' : 'Учётных записей Master_pro пока нет.'}</div>
          : visible.map((account, index) => {
            const page = pageFor(account)
            return <div className={'ap-grid mp-management-grid ap-row ' + (account.disabled_at ? 'is-disabled' : '')} key={account.id}>
              <span className="ap-number">{index + 1}</span>
              <div className="ap-person"><strong>{account.full_name || 'Без имени'}</strong><small>{account.disabled_at ? 'Учётная запись отключена' : 'Индивидуальный специалист'}</small></div>
              <span className="ap-muted">{account.email || '—'}</span>
              <div className="mp-management-page">{page ? <><strong>{page.display_name}</strong><a href={`https://saittony.github.io/workflows/pro/${page.slug}`} target="_blank" rel="noreferrer">/pro/{page.slug}</a></> : <span>Страница не создана</span>}</div>
              <span><i className={'ap-role ' + (page?.is_active ? 'ap-company-active' : 'ap-company-inactive')}>{page ? page.is_active ? 'Опубликована' : 'Черновик' : 'Нет страницы'}</i></span>
              <span><i className={'ap-role ' + (!account.disabled_at ? 'ap-company-active' : 'ap-company-inactive')}>{account.disabled_at ? 'Отключён' : 'Активен'}</i></span>
              <span className="mp-management-actions">{!page
                ? <button type="button" className="ap-primary mp-management-create" disabled={busy || !!account.disabled_at} onClick={() => onCreatePage(account)}>Создать страницу</button>
                : <><button type="button" className="ap-gear" title={page.is_active ? 'Отключить публикацию' : 'Опубликовать страницу'} aria-label={page.is_active ? 'Отключить публикацию' : 'Опубликовать страницу'} disabled={busy} onClick={() => onTogglePage(page)}>{page.is_active ? 'Ⅱ' : '▶'}</button><button type="button" className="ap-delete" title="Переместить страницу в архив" aria-label="Переместить страницу в архив" disabled={busy} onClick={() => onArchivePage(page)}>⌫</button></>}
              </span>
            </div>
          })}
      </div>
      <footer className="ap-footer">Индивидуальные страницы не входят в структуру компаний. Admin компаний не имеет к ним доступа.</footer>
    </section>
  </section>
}
