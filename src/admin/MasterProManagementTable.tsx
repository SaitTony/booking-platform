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
  onTogglePage: (page: MasterPage) => void
  onArchivePage: (page: MasterPage) => void
}

export default function MasterProManagementTable({
  accounts,
  pages,
  loading,
  busy,
  onCreatePage,
  onTogglePage,
  onArchivePage,
}: Props) {
  const masterPros = accounts

  return (
    <section className="master-pro-management">
      <header className="master-pro-management-heading">
        <div>
          <h3>Мастера_pro и индивидуальные страницы</h3>
          <p>Управление страницами, связанными с учётными записями Master_pro</p>
        </div>
        <span className="master-pro-management-count">{masterPros.length}</span>
      </header>

      <div className="master-pro-table-wrap">
        <table className="master-pro-table">
          <thead>
            <tr>
              <th scope="col" className="master-pro-col-number">№</th>
              <th scope="col">Master_pro</th>
              <th scope="col">Email</th>
              <th scope="col">Привязанная страница</th>
              <th scope="col">Статус страницы</th>
              <th scope="col" className="master-pro-col-actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading && masterPros.length === 0 ? (
              <tr><td colSpan={6} className="master-pro-table-empty">Загружаем учётные записи…</td></tr>
            ) : masterPros.length === 0 ? (
              <tr><td colSpan={6} className="master-pro-table-empty">Учётных записей Master_pro пока нет.</td></tr>
            ) : masterPros.map((account, index) => {
              const page = pages.find(item => item.kind === 'individual' && item.profile_id === account.id)
              return (
                <tr key={account.id}>
                  <td className="master-pro-number">{index + 1}</td>
                  <td>
                    <div className="master-pro-account-name">{account.full_name || 'Без имени'}</div>
                    {account.disabled_at && <span className="master-pro-account-muted">Учётная запись отключена</span>}
                  </td>
                  <td className="master-pro-email">{account.email || '—'}</td>
                  <td>
                    {page ? (
                      <div className="master-pro-page-name">
                        <strong>{page.display_name}</strong>
                        <span>/{page.slug}</span>
                      </div>
                    ) : <span className="master-pro-no-page">Страница не создана</span>}
                  </td>
                  <td>
                    {page ? (
                      <span className={`master-pro-page-status ${page.is_active ? 'is-active' : 'is-disabled'}`}>
                        {page.is_active ? 'Активна' : 'Отключена'}
                      </span>
                    ) : <span className="master-pro-status-empty">—</span>}
                  </td>
                  <td>
                    <div className="master-pro-row-actions">
                      {!page ? (
                        <button type="button" className="master-pro-action master-pro-action-primary" disabled={busy} onClick={() => onCreatePage(account)}>
                          Создать страницу
                        </button>
                      ) : (
                        <>
                          <button type="button" className="master-pro-action" disabled={busy} onClick={() => onTogglePage(page)}>
                            {page.is_active ? 'Отключить страницу' : 'Включить страницу'}
                          </button>
                          <button type="button" className="master-pro-action master-pro-action-danger" disabled={busy} onClick={() => onArchivePage(page)}>
                            Удалить страницу
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <footer className="master-pro-table-footer">Удаление перемещает страницу в архив. История записей сохраняется.</footer>
    </section>
  )
}
