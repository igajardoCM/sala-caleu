import { useEffect, useState } from 'react'

const INICIO_JORNADA = 8 // 8 AM
const FIN_JORNADA = 19 // 19 PM (7 PM)
const INTERVALO_MINUTOS = 30

function generarBloquesDelDia() {
  const hoy = new Date()
  hoy.setSeconds(0, 0)
  const bloques = []
  for (let hora = INICIO_JORNADA; hora < FIN_JORNADA; hora++) {
    for (let minuto = 0; minuto < 60; minuto += INTERVALO_MINUTOS) {
      const inicio = new Date(hoy)
      inicio.setHours(hora, minuto)
      const fin = new Date(inicio.getTime() + INTERVALO_MINUTOS * 60000)
      bloques.push({ inicio, fin, ocupado: false })
    }
  }
  return bloques
}

export default function CalendarioHorario({ eventos = [] }) {
  const [bloques, setBloques] = useState([])

  useEffect(() => {
    const nuevosBloques = generarBloquesDelDia().map(b => {
      const ocupado = eventos.some(e => {
        const inicioEvento = new Date(e.start.dateTime)
        const finEvento = new Date(e.end.dateTime)
        return b.inicio < finEvento && b.fin > inicioEvento
      })
      return { ...b, ocupado }
    })
    setBloques(nuevosBloques)
  }, [eventos])

  function abrirReserva(inicio, fin) {
    const formato = fecha => fecha.toISOString().replace(/[-:]|\.\d{3}/g, '').slice(0, 15) + 'Z'
    const url = `https://calendar.google.com/calendar/u/0/r/eventedit?text=Reserva+Sala+Caleu&dates=${formato(inicio)}/${formato(fin)}&location=Caleu&sf=true&output=xml`
    window.open(url, '_blank')
  }

  return (
    <div className="calendario">
      {bloques.map((b, i) => (
        <div
          key={i}
          className={`bloque ${b.ocupado ? 'bloque-ocupado' : 'bloque-disponible'}`}
          onClick={() => !b.ocupado && abrirReserva(b.inicio, b.fin)}
        >
          {b.inicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {b.fin.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      ))}
    </div>
  )
}
