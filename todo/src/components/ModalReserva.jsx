export default function ModalReserva({ visible, onClose, onSelect, eventos }) {
  if (!visible) return null

  const estaOcupado = (inicio) => {
    const fin = new Date(inicio.getTime() + 60 * 60 * 1000)
    return eventos.some(ev => {
      const evInicio = new Date(ev.start.dateTime)
      const evFin = new Date(ev.end.dateTime)
      return evInicio < fin && evFin > inicio
    })
  }

  const generarHoras = () => {
    const horas = []
    const inicio = new Date()
    inicio.setHours(8, 0, 0, 0)
    for (let i = 0; i < 12; i++) {
      const nuevaHora = new Date(inicio.getTime() + i * 60 * 60 * 1000) // 1 hora
      const ocupado = estaOcupado(nuevaHora)
      horas.push({ hora: nuevaHora, ocupado })
    }
    return horas
  }

  const horasDisponibles = generarHoras()

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2 className="modal-titulo">Selecciona un horario</h2>
        <div className="grid-horas">
          {horasDisponibles.map(({ hora, ocupado }, i) => (
            <button
              key={i}
              className={`boton-hora ${ocupado ? 'ocupado' : ''}`}
              onClick={() => !ocupado && onSelect(hora)}
              disabled={ocupado}
            >
              {hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </button>
          ))}
        </div>
        <button className="cerrar" onClick={onClose}>×</button>
      </div>
    </div>
  )
}