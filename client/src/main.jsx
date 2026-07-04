import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Sayfa yüklenirken flash olmaması için tema erken uygula
;(function () {
  const saved = localStorage.getItem('theme')
  if (!saved || saved === 'dark') document.documentElement.classList.add('dark')
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// PWA — service worker kaydı (yalnız prod'da, secure context'te)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
