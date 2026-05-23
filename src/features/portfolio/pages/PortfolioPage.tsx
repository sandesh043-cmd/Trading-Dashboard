type PortfolioPageProps = {
  userEmail: string
  onSignOut: () => void
}

export function PortfolioPage({ userEmail, onSignOut }: PortfolioPageProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>Trading Dashboard</span>
        </div>
        <nav className="nav-list">
          <a href="#portfolio" aria-current="page">
            Portfolio
          </a>
          <a href="#sources">Sources</a>
          <a href="#sync">Sync</a>
          <a href="#settings">Settings</a>
        </nav>
      </aside>

      <section className="workspace" id="portfolio">
        <header className="topbar">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h1>Overview</h1>
          </div>
          <div className="topbar-actions">
            <span className="user-email">{userEmail}</span>
            <button type="button" className="secondary-action" onClick={onSignOut}>
              Sign out
            </button>
            <button type="button" className="primary-action" disabled>
              Refresh
            </button>
          </div>
        </header>

        <section className="panel-grid" aria-label="Portfolio status">
          <article className="panel">
            <p className="panel-label">Sources</p>
            <h2>No sources connected</h2>
            <p className="panel-copy">Awaiting the first connector issue.</p>
          </article>
          <article className="panel">
            <p className="panel-label">Sync</p>
            <h2>Not configured</h2>
            <p className="panel-copy">Manual and scheduled refresh share one backend path.</p>
          </article>
          <article className="panel">
            <p className="panel-label">Storage</p>
            <h2>Supabase ready</h2>
            <p className="panel-copy">Migrations, functions, and seed folders are in place.</p>
          </article>
        </section>
      </section>
    </main>
  )
}
