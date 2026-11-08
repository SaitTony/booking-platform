import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// GitHub Pages serves unknown paths through the SPA fallback (404.html).
// The URL remains intact, so BrowserRouter can resolve the requested route.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/workflows">
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
