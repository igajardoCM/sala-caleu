import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import SalaDisplay from './SalaDisplay'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SalaDisplay />
  </React.StrictMode>,
)

// 🔧 Desregistrar cualquier Service Worker previo (evita quedarse con JS cacheado)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(r => r.unregister()))
    .catch(err => console.error('Error al desregistrar Service Workers:', err))
}
