import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import SalaDisplay from './SalaDisplay'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SalaDisplay />
  </React.StrictMode>,
)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sala-caleu/service-worker.js')
      .then(reg => console.log('Service Worker registrado ✅', reg))
      .catch(err => console.error('Error al registrar Service Worker ❌', err));
  });
}
