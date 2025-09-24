import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import './index.css'
import NombreReservaModal from './components/NombreReservaModal'
import ModalReserva from './components/ModalReserva'
import { Clock } from 'lucide-react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

const logo = 'https://clinicalmarket.cl/wp-content/uploads/Clinical-Market-logo.png.webp'

const GOOGLE_CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const USUARIO_AUTORIZADO = (import.meta.env.VITE_USUARIO_AUTORIZADO || '').toLowerCase().trim()

// Timers
const UI_TICK_MS = 10_000          // refrescar hora/estado
const POLL_MS    = 60_000          // leer eventos
const TOKEN_PAD_MS = 55 * 60 * 1000
const TOKEN_RENEW_INTERVAL = 45 * 60 * 1000

export default function SalaDisplay() {
  const [estado, setEstado] = useState('cargando') // 'disponible' | 'ocupado' | 'cargando'
  const [evento, setEvento] = useState(null)
  const [horaActual, setHoraActual] = useState(new Date())
  const [usuario, setUsuario] = useState(null)
  const [eventos, setEventos] = useState([])

  const [mostrarModalNombre, setMostrarModalNombre] = useState(false)
  const [mostrarModalHorario, setMostrarModalHorario] = useState(false)
  const [inicioReserva, setInicioReserva] = useState(null)
  const [duracionReserva, setDuracionReserva] = useState(30)

  // Token
  const [accessToken, setAccessToken] = useState(null)
  const tokenClientRef = useRef(null)
  const tokenExpRef = useRef(0)

  // Wake Lock
  const [wakeLockSoportado] = useState('wakeLock' in navigator)
  const wakeLockRef = useRef(null)
  const [wakeActivo, setWakeActivo] = useState(false)
  const wakeHeartbeatRef = useRef(null)

  // ---------------- Wake Lock ----------------
  async function solicitarWakeLock() {
    try {
      if (!('wakeLock' in navigator)) return
      if (wakeLockRef.current) return
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      setWakeActivo(true)
      wakeLockRef.current.addEventListener('release', () => {
        setWakeActivo(false)
        wakeLockRef.current = null
        setTimeout(() => solicitarWakeLock().catch(() => {}), 1500)
      })
    } catch (err) {
      console.warn('WakeLock:', err?.message || err)
      setWakeActivo(false)
      wakeLockRef.current = null
    }
  }
  function liberarWakeLock() {
    try { wakeLockRef.current?.release() } catch {}
    wakeLockRef.current = null
    setWakeActivo(false)
  }
  useEffect(() => {
    if (!wakeLockSoportado) return
    const onVisibility = () => { if (document.visibilityState === 'visible') solicitarWakeLock() }
    const onFocus = () => solicitarWakeLock()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)

    wakeHeartbeatRef.current = setInterval(() => {
      if (!wakeLockRef.current) solicitarWakeLock().catch(() => {})
    }, 240_000)

    let activado = false
    const kick = async () => {
      if (!activado) {
        activado = true
        await solicitarWakeLock()
        window.removeEventListener('click', kick)
        window.removeEventListener('touchstart', kick)
      }
    }
    window.addEventListener('click', kick, { passive: true })
    window.addEventListener('touchstart', kick, { passive: true })

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('click', kick)
      window.removeEventListener('touchstart', kick)
      if (wakeHeartbeatRef.current) clearInterval(wakeHeartbeatRef.current)
      liberarWakeLock()
    }
  }, [wakeLockSoportado])
  // -------------- fin Wake Lock --------------

  // -------------- Google Identity / Token --------------
  function marcarTokenValido() {
    tokenExpRef.current = Date.now() + TOKEN_PAD_MS
  }

  async function asegurarTokenVigente({ prompt = '' } = {}) {
    const queda = tokenExpRef.current - Date.now()
    if (!accessToken || queda < 30_000) {
      return new Promise((resolve) => {
        if (!tokenClientRef.current) return resolve(false)
        tokenClientRef.current.callback = (resp) => {
          if (resp?.access_token) {
            setAccessToken(resp.access_token)
            marcarTokenValido()
            resolve(true)
          } else {
            resolve(false)
          }
        }
        tokenClientRef.current.requestAccessToken({ prompt })
      })
    }
    return true
  }

  function cargarGoogleIdentity() {
    if (window.google?.accounts?.oauth2) {
      initTokenClient()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = initTokenClient
    document.body.appendChild(s)
  }

  function initTokenClient() {
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope:
        'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events openid email profile',
      // no forzamos silencioso aquí; el botón abre prompt visible
      callback: async (resp) => {
        if (resp?.access_token) {
          setAccessToken(resp.access_token)
          marcarTokenValido()
          await obtenerEmailDesdeToken(resp.access_token) // esto setea usuario y entra a la app
        } else {
          console.warn('[login] sin access_token')
        }
      },
    })
  }

  async function obtenerEmailDesdeToken(token) {
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) {
        console.error('[userinfo]', r.status, await r.text())
        Swal.fire({ icon: 'error', title: `Error userinfo (${r.status})`, timer: 1800, showConfirmButton: false })
        return
      }
      const data = await r.json()
      const email = (data?.email || '').toLowerCase().trim()

      // Si no configuraste USUARIO_AUTORIZADO, no bloqueamos la UI.
      if (!USUARIO_AUTORIZADO || email === USUARIO_AUTORIZADO) {
        setUsuario(data)              // ✅ avanza a la app
        obtenerEventosCalendario()
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Acceso no autorizado',
          text: `Este correo (${email}) no coincide con el autorizado.`,
          timer: 2200,
          showConfirmButton: false,
        })
      }
    } catch (e) {
      console.error('[userinfo] error', e)
      Swal.fire({ icon: 'error', title: 'Error al validar el email', timer: 1800, showConfirmButton: false })
    }
  }

  function iniciarSesion() {
    // flujo visible y estable como antes
    tokenClientRef.current?.requestAccessToken({ prompt: 'consent' })
  }

  // Renovación proactiva
  useEffect(() => {
    if (!accessToken) return
    const id = setInterval(() => {
      asegurarTokenVigente({ prompt: '' }).catch(() => {})
    }, TOKEN_RENEW_INTERVAL)
    return () => clearInterval(id)
  }, [accessToken])
  // ---------- fin Google Identity / Token ----------

  // ---------------- Calendario ----------------
  async function obtenerEventosCalendario() {
    const ok = await asegurarTokenVigente({ prompt: '' })
    if (!ok) return

    const d = new Date()
    const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
    const fin    = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)

    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events` +
      `?singleEvents=true&orderBy=startTime&timeMin=${inicio.toISOString()}&timeMax=${fin.toISOString()}`

    let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })

    if (res.status === 401) {
      const refreshed = await asegurarTokenVigente({ prompt: '' })
      if (refreshed) {
        res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      }
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('Error leyendo eventos:', res.status, txt)
      return
    }

    const data = await res.json()
    setEventos(Array.isArray(data.items) ? data.items : [])
  }

  function recalcularEstado() {
    if (!Array.isArray(eventos) || eventos.length === 0) {
      setEstado('disponible')
      setEvento(null)
      return
    }
    const ahora = Date.now()
    let actual = null
    for (const ev of eventos) {
      if (!ev?.start?.dateTime || !ev?.end?.dateTime) continue
      const s = new Date(ev.start.dateTime).getTime()
      const e = new Date(ev.end.dateTime).getTime()
      if (ahora >= s && ahora < e) { actual = ev; break }
    }
    setEvento(actual)
    setEstado(actual ? 'ocupado' : 'disponible')
  }

  // Tick UI + recomputar estado
  useEffect(() => {
    const t = setInterval(() => {
      setHoraActual(new Date())
      recalcularEstado()
    }, UI_TICK_MS)
    recalcularEstado()
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos])

  // Polling
  useEffect(() => {
    let alive = true
    const loop = async () => {
      if (!alive) return
      await obtenerEventosCalendario().catch(() => {})
      if (!alive) return
      setTimeout(loop, POLL_MS)
    }
    if (usuario) loop()
    return () => { alive = false }
  }, [usuario])

  // Al terminar reunión actual
  useEffect(() => {
    if (!evento?.end?.dateTime) return
    const ms = new Date(evento.end.dateTime).getTime() - Date.now()
    if (ms <= 0 || ms > 6 * 60 * 60 * 1000) return
    const t = setTimeout(() => {
      setEstado('disponible')
      setEvento(null)
      setTimeout(() => obtenerEventosCalendario(), 2000)
    }, ms + 300)
    return () => clearTimeout(t)
  }, [evento])
  // -------------- fin Calendario --------------

  // Arranque
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), UI_TICK_MS)
    cargarGoogleIdentity()
    return () => clearInterval(timer)
  }, [])

  // ---------- Crear evento desde la tablet ----------
  function agendarDesde(minutos, inicio = new Date()) {
    setInicioReserva(inicio)
    setDuracionReserva(minutos)
    setMostrarModalNombre(true)
  }

  async function agendarEvento(nombre, inicio) {
    const fin = new Date(inicio.getTime() + duracionReserva * 60 * 1000)
    const body = {
      summary: `Reserva Sala Caleu - ${nombre}`,
      location: 'Caleu',
      start: { dateTime: inicio.toISOString(), timeZone: 'America/Santiago' },
      end:   { dateTime: fin.toISOString(),    timeZone: 'America/Santiago' },
      visibility: 'default',
      description: `Reserva realizada por ${nombre} desde la tablet.`,
    }

    await asegurarTokenVigente({ prompt: '' })

    let res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.status === 401) {
      const ok = await asegurarTokenVigente({ prompt: '' })
      if (ok) {
        res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
    }

    if (res.ok) {
      Swal.fire({ icon: 'success', title: 'Reserva creada con éxito ✅', showConfirmButton: false, timer: 2000, timerProgressBar: true, position: 'center' })
      obtenerEventosCalendario()
    } else {
      Swal.fire({ icon: 'error', title: 'Error al crear la reserva ❌', showConfirmButton: false, timer: 2000, timerProgressBar: true, position: 'center' })
    }
    setMostrarModalNombre(false)
  }
  // ---------- fin crear evento ----------

  if (!usuario) {
    return (
      <div className="pantalla layout">
        <div className="lado-izquierdo">
          <img src={logo} alt="Logo" className="logo" />
          <p className="titulo-sala">Autenticación requerida</p>
          <button onClick={iniciarSesion} className="boton-reservar">Iniciar sesión con Google</button>
          {!wakeLockSoportado ? (
            <p style={{ opacity:.8, fontSize:12, marginTop:8 }}>ℹ️ Tu navegador no soporta mantener la pantalla encendida.</p>
          ) : (
            <p style={{ opacity:.8, fontSize:12, marginTop:8 }}>
              {wakeActivo ? '🔒 Pantalla despierta' : '⚠️ Toca la pantalla para activar “pantalla despierta”.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <motion.div className="pantalla layout">
      <div className="lado-izquierdo">
        <img src={logo} alt="Logo" className="logo" />
        <h1 className="titulo-sala">Sala Caleu</h1>
        <p className="hora-actual">{horaActual.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="fecha">{horaActual.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        {evento && (
          <p className="rango-hora">
            <Clock className="icono" /> {new Date(evento.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(evento.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {!wakeLockSoportado ? (
          <p style={{ opacity:.8, fontSize:12, marginTop:8 }}>ℹ️ Tu navegador no soporta mantener la pantalla encendida.</p>
        ) : (
          <p style={{ opacity:.8, fontSize:12, marginTop:8 }}>
            {wakeActivo ? '🔒 Pantalla despierta' : '⚠️ Toca la pantalla para activar “pantalla despierta”.'}
          </p>
        )}
      </div>

      <div className="lado-derecho">
        <div className={`estado-box ${estado}`}>
          <h2 className="estado-texto">{estado === 'disponible' ? 'Disponible' : 'Ocupada'}</h2>
          <button className="boton-reservar" disabled={estado === 'ocupado'} onClick={() => agendarDesde(30)}>
            Reservar
          </button>
          <button className="boton-reservar" onClick={() => setMostrarModalHorario(true)}>
            Agendar otro horario
          </button>
        </div>

        <div className="agenda-dia">
          <h3 className="agenda-titulo">Agenda del Día</h3>
          <ul className="agenda-lista">
            {eventos.map((ev, i) => (
              <li key={i} className="agenda-item">
                <span>
                  {ev?.start?.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Día completo'} - {ev?.end?.dateTime ? new Date(ev.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <strong>{ev.summary}</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ModalReserva
        visible={mostrarModalHorario}
        onClose={() => setMostrarModalHorario(false)}
        onSelect={(hora) => agendarDesde(60, hora)}
        eventos={eventos}
      />

      <NombreReservaModal
        isOpen={mostrarModalNombre}
        onClose={() => setMostrarModalNombre(false)}
        onConfirm={(nombre) => agendarEvento(nombre, inicioReserva)}
      />
    </motion.div>
  )
}
