import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import SalaDisplay from './SalaDisplay'
import { registerSW } from 'virtual:pwa-register'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SalaDisplay />
  </React.StrictMode>,
)

// ✅ Registrar Service Worker (PWA)
registerSW({
  immediate: true,
  onNeedRefresh() {
    // cuando haya nueva versión lista, recarga silenciosamente
    location.reload()
  },
  onOfflineReady() {
    // opcional: podrías mostrar un toast "Listo para funcionar offline"
    console.log('PWA lista para funcionar offline')
  },
})
