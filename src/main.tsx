import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workflows UI render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-crash-screen" role="alert">
          <section>
            <span>WORKFLOWS</span>
            <h1>Не удалось загрузить интерфейс</h1>
            <p>Приложение обнаружило ошибку при отображении страницы. Данные не удалены.</p>
            <pre>{this.state.error}</pre>
            <button type="button" onClick={() => window.location.reload()}>Перезагрузить страницу</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

// GitHub Pages serves unknown paths through the SPA fallback (404.html).
// The URL remains intact, so BrowserRouter can resolve the requested route.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter basename="/workflows">
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
