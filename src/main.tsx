import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// GitHub Pages serves unknown paths through 404.html.
// Restore the requested clean URL after the fallback redirect.
const savedPath = sessionStorage.getItem('spa-redirect')
if (savedPath) {
  sessionStorage.removeItem('spa-redirect')
  window.history.replaceState(null, '', savedPath)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/booking-platform">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)