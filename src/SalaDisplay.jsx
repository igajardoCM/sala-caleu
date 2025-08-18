import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import './index.css'
import NombreReservaModal from './components/NombreReservaModal'
import ModalReserva from './components/ModalReserva'
import { Clock } from "lucide-react"
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'

const logo = "https://clinicalmarket.cl/wp-content/uploads/Clinical-Market-logo.png.webp"

const GOOGLE_CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const USUARIO_AUTORIZADO = import.meta.env.VITE_USUARIO_AUTORIZADO

export default function SalaDisplay() {
  const [estado, setEstado] = useState("cargando")
  const [evento, setEvento] = useState(null)
  const [horaActual, setHoraActual] = useState(new Date())
  const [usuario, setUsuario] = useState(null)
  const [eventos, setEventos] = useState([])
  const [mostrarModalNombre, setMostrarModalNombre] = useState(false)
  const [mostrarModalHorario, setMostrarModalHorario] = useState(false)
  const [inicioReserva, setInicioReserva] = useState(null)
  const [duracionReserva, setDuracionReserva] = useState(30)
  const [accessToken, setAccessToken] = useState(null)
  const [tokenClient, setTokenClient] = useState(null)

  // --- Wake Lock (mantener pantalla encendida) ---
  const [wakeLockSoportado, setWakeLockSoportado] = useState('wakeLock' in navigator)
  const wakeLockRef = useRef(null)
  const [wakeActivo, setWakeActivo] = useState(false)

  async function solicitarWakeLock() {
    try {
      if (!('wakeLock' in navigator)) return
      if (wakeLockRef.current) return
      wakeLockRef.current = await navigator.wakeLock.request('screen')
      setWakeActivo(true)
      wakeLockRef.current.addEventListener('release', () => {
        setWakeActivo(false)
        wakeLockRef.current = null
      })
    } catch (err) {
      console.warn('No se pudo activar Wake Lock:', err?.message || err)
      setWakeActivo(false)
      wakeLockRef.current = null
    }
  }

  function liberarWakeLock() {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    } catch {}
    setWakeActivo(false)
  }

  // Reactiva el wake lock cuando la pestaña vuelve a ser visible o la ventana recupera foco
  useEffect(() => {
    if (!wakeLockSoportado) return
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        solicitarWakeLock()
      }
    }
    const onFocus = () => solicitarWakeLock()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
    }
  }, [wakeLockSoportado])

  // Solicita el wake lock tras el primer gesto del usuario (requisito de algunos navegadores)
  useEffect(() => {
    if (!wakeLockSoportado) return
    let activado = false
    const handler = async () => {
      if (!activado) {
        activado = true
        await solicitarWakeLock()
        window.removeEventListener('click', handler)
        window.removeEventListener('touchstart', handler)
      }
    }
    window.addEventListener('click', handler, { passive: true })
    window.addEventListener('touchstart', handler, { passive: true })
    return () => {
      window.removeEventListener('click', handler)
      window.removeEventListener('touchstart', handler)
      liberarWakeLock()
    }
  }, [wakeLockSoportado])
  // --- Fin Wake Lock ---

  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 10000)
    cargarGoogleIdentity()
    return () => {
      clearInterval(timer)
      liberarWakeLock() // por si acaso al desmontar
    }
  }, [])

  function cargarGoogleIdentity() {
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.onload = () => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.events openid email profile',
        prompt: '',
        callback: (response) => {
          if (response && response.access_token) {
            setAccessToken(response.access_token)
            obtenerEmailDesdeToken(response.access_token)
          } else {
            Swal.fire({
              icon: 'error',
              title: 'No se pudo obtener el token de acceso',
              showConfirmButton: false,
              timer: 2000,
              timerProgressBar: true,
              position: 'center'
            })
          }
        }
      })
      setTokenClient(client)
    }
    document.body.appendChild(script)
  }

  function obtenerEmailDesdeToken(token) {
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.email === USUARIO_AUTORIZADO) {
          setUsuario(data)
          obtenerEventosCalendario(token)
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Acceso no autorizado',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            position: 'center'
          })
        }
      })
      .catch(() => {
        Swal.fire({
          icon: 'error',
          title: 'Error al validar el email',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
          position: 'center'
        })
      })
  }

  function iniciarSesion() {
    if (tokenClient) tokenClient.requestAccessToken()
  }

  async function obtenerEventosCalendario(token) {
    const hoy = new Date()
    const inicioISO = new Date(new Date(hoy).setHours(8, 0, 0, 0)).toISOString()
    const finISO = new Date(new Date(hoy).setHours(19, 0, 0, 0)).toISOString()

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GOOGLE_CALENDAR_ID}/events?timeMin=${inicioISO}&timeMax=${finISO}&singleEvents=true&orderBy=startTime`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    const data = await res.json()
    const ahora = new Date()
    const eventoActual = data.items?.find(ev =>
      new Date(ev.start.dateTime) <= ahora && new Date(ev.end.dateTime) > ahora
    )

    setEstado(eventoActual ? "ocupado" : "disponible")
    setEvento(eventoActual || null)
    setEventos(data.items || [])
  }

  function estaOcupado(inicio, duracion) {
    const fin = new Date(inicio.getTime() + duracion * 60 * 1000)
    return eventos.some(ev => {
      const evInicio = new Date(ev.start.dateTime)
      const evFin = new Date(ev.end.dateTime)
      return evInicio < fin && evFin > inicio
    })
  }

  function agendarDesde(minutos, inicio = new Date()) {
    setInicioReserva(inicio)
    setDuracionReserva(minutos)
    setMostrarModalNombre(true)
  }

  async function agendarEvento(nombre, inicio) {
    const fin = new Date(inicio.getTime() + duracionReserva * 60 * 1000)

    const evento = {
      summary: `Reserva Sala Caleu - ${nombre}`,
      location: "Caleu",
      start: { dateTime: inicio.toISOString(), timeZone: 'America/Santiago' },
      end: { dateTime: fin.toISOString(), timeZone: 'America/Santiago' },
      visibility: "default",
      description: `Reserva realizada por ${nombre} desde la tablet.`
    }

    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GOOGLE_CALENDAR_ID}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(evento)
    })

    if (res.ok) {
      Swal.fire({
        icon: 'success',
        title: 'Reserva creada con éxito ✅',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
        position: 'center'
      })
      obtenerEventosCalendario(accessToken)
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error al crear la reserva ❌',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
        position: 'center'
      })
    }

    setMostrarModalNombre(false)
  }

  if (!usuario) {
    return (
      <div className="pantalla layout">
        <div className="lado-izquierdo">
          <img src={logo} alt="Logo" className="logo" />
          <p className="titulo-sala">Autenticación requerida</p>
          <button onClick={iniciarSesion} className="boton-reservar">Iniciar sesión con Google</button>

          {/* Indicador Wake Lock (antes de login puede no estar activo aún) */}
          {!wakeLockSoportado ? (
            <p style={{ opacity: .8, fontSize: 12, marginTop: 8 }}>
              ℹ️ Tu navegador no soporta mantener la pantalla encendida.
            </p>
          ) : (
            <p style={{ opacity: .8, fontSize: 12, marginTop: 8 }}>
              {wakeActivo ? '🔒 Pantalla despierta' : '⚠️ Toca la pantalla para activar “pantalla despierta”.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <motion.div className={`pantalla layout`}>
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

        {/* Indicador Wake Lock */}
        {!wakeLockSoportado ? (
          <p style={{ opacity: .8, fontSize: 12, marginTop: 8 }}>
            ℹ️ Tu navegador no soporta mantener la pantalla encendida.
          </p>
        ) : (
          <p style={{ opacity: .8, fontSize: 12, marginTop: 8 }}>
            {wakeActivo ? '🔒 Pantalla despierta' : '⚠️ Toca la pantalla para activar “pantalla despierta”.'}
          </p>
        )}
      </div>

      <div className="lado-derecho">
        <div className={`estado-box ${estado}`}>
          <h2 className="estado-texto">{estado === "disponible" ? "Disponible" : "Ocupada"}</h2>
          <button
            className="boton-reservar"
            disabled={estado === "ocupado"}
            onClick={() => agendarDesde(30)}
          >
            Reservar
          </button>
          <button
            className="boton-reservar"
            onClick={() => setMostrarModalHorario(true)}
          >
            Agendar otro horario
          </button>
        </div>

        <div className="agenda-dia">
          <h3 className="agenda-titulo">Agenda del Día</h3>
          <ul className="agenda-lista">
            {eventos.map((ev, i) => (
              <li key={i} className="agenda-item">
                <span>{new Date(ev.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
