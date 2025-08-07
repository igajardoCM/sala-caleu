import React, { useState } from 'react';

const NombreReservaModal = ({ isOpen, onClose, onConfirm }) => {
  const [nombre, setNombre] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (nombre.trim() === '') return;
    onConfirm(nombre.trim());
    setNombre('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay"> {/* 🔥 Esta clase es clave */}
      <div className="modal-contenido-confirmacion">
        <h2>Reservar sala</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="input-nombre"
            required
          />
          <div className="botones-confirmacion">
            <button type="submit" className="boton-confirmar">Confirmar</button>
            <button type="button" className="boton-cancelar" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NombreReservaModal;
