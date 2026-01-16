// components/Paciente/PacienteLista.tsx
import React from 'react';
import type { Paciente } from '../../types/models';
import '../../styles/paciente.css';

interface PacienteListaProps {
  pacientes: Paciente[];
  onEditarPaciente: (paciente: Paciente) => void;
  onEliminarPaciente: (dni: string) => void;
  onVerHistorial: (dni: string) => void;
  onAgregarExamen: (dni: string) => void;
  loading: boolean;
}

const PacienteLista: React.FC<PacienteListaProps> = ({
  pacientes,
  onEditarPaciente,
  onEliminarPaciente,
  onVerHistorial,
  onAgregarExamen,
  loading
}) => {
  const formatFecha = (fecha: string | null): string => {
    if (!fecha) return 'N/A';
    try {
      return new Date(fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return fecha;
    }
  };

  const getEdadDisplay = (edad: number | null): string => {
    if (!edad) return 'N/A';
    return `${edad} años`;
  };

  const getSexoDisplay = (sexo: string | null): string => {
    if (!sexo) return 'N/A';
    return sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : sexo;
  };

  const getEstadoCivilDisplay = (estadoCivil: string | null): string => {
    if (!estadoCivil) return 'N/A';
    return estadoCivil;
  };

  const getTelefonoDisplay = (telefono: string | null): string => {
    if (!telefono) return 'N/A';
    return telefono.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  };

  if (pacientes.length === 0) {
    return (
      <div className="pacientes-empty">
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <h3 className="empty-title">No hay pacientes</h3>
          <p className="empty-description">
            No se encontraron pacientes con los criterios actuales.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pacientes-lista">
      <div className="lista-header">
        <h2 className="lista-title">
          Lista de Pacientes
          <span className="lista-count">{pacientes.length}</span>
        </h2>
      </div>
      
      <div className="table-responsive">
        <table className="pacientes-table">
          <thead>
            <tr>
              <th>DNI</th>
              <th>Paciente</th>
              <th>Edad</th>
              <th>Sexo</th>
              <th>Teléfono</th>
              <th>Estado Civil</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pacientes.map((paciente) => (
              <tr key={paciente.DNI || paciente.ID_FICHA_CLINICA} className="paciente-row">
                <td className="dni-cell">
                  <span className="dni-badge">{paciente.DNI}</span>
                </td>
                <td>
                  <div className="paciente-info">
                    <div className="paciente-nombre">{paciente.NOMBRE_APELLIDO}</div>
                    <div className="paciente-email">{paciente.EMAIL}</div>
                  </div>
                </td>
                <td className="edad-cell">
                  {getEdadDisplay(paciente.EDAD)}
                </td>
                <td className="sexo-cell">
                  <span className={`sexo-badge ${paciente.SEXO === 'M' ? 'masculino' : 'femenino'}`}>
                    {getSexoDisplay(paciente.SEXO)}
                  </span>
                </td>
                <td className="telefono-cell">
                  {getTelefonoDisplay(paciente.TELEFONO)}
                </td>
                <td className="estado-civil-cell">
                  <span className="estado-civil-badge">
                    {getEstadoCivilDisplay(paciente.ESTADO_CIVIL)}
                  </span>
                </td>
                <td className="fecha-cell">
                  {formatFecha(paciente.CREATED_AT || paciente.FECHA)}
                </td>
                <td>
                  <div className="acciones">
                    <button
                      onClick={() => onVerHistorial(paciente.DNI)}
                      className="btn btn-info btn-sm"
                      title="Ver historial clínico"
                      disabled={loading}
                    >
                      📋 Historial
                    </button>
                    
                    <button
                      onClick={() => onAgregarExamen(paciente.DNI)}
                      className="btn btn-warning btn-sm"
                      title="Agregar examen"
                      disabled={loading}
                    >
                      🩺 Examen
                    </button>
                    
                    <button
                      onClick={() => onEditarPaciente(paciente)}
                      className="btn btn-secondary btn-sm"
                      title="Editar paciente"
                      disabled={loading}
                    >
                      ✏️ Editar
                    </button>
                    
                    <button
                      onClick={() => paciente.DNI && onEliminarPaciente(paciente.DNI)}
                      className="btn btn-danger btn-sm"
                      title="Eliminar paciente"
                      disabled={loading}
                    >
                      🗑️ Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PacienteLista;