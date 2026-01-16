import React from 'react';
import type { Paciente, Consulta, RequisitosConsulta } from '../../types/models';
import '../../styles/consulta.css';

interface ConsultaInfoHeaderProps {
  paciente: Paciente | null;
  consulta: Consulta | null;
  requisitos: RequisitosConsulta | null;
  onBack: () => void;
}

const ConsultaInfoHeader: React.FC<ConsultaInfoHeaderProps> = ({
  paciente,
  consulta,
  requisitos,
  onBack,
}) => {
  const getEstadoColor = (estado: string): string => {
    switch (estado?.toLowerCase()) {
      case 'completada':
        return 'status-completed';
      case 'pendiente':
        return 'status-pending';
      case 'cancelada':
        return 'status-cancelled';
      default:
        return 'status-default';
    }
  };

  const getConsultaType = (esPrimeraConsulta: boolean): string => {
    return esPrimeraConsulta ? 'Primera Consulta' : 'Consulta de Control';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="consulta-header">
      <div className="header-top">
        <button className="back-button" onClick={onBack}>
          ← Volver
        </button>
        <h1 className="page-title">
          {consulta ? 'Consulta Médica' : 'Nueva Consulta'}
        </h1>
        {consulta && (
          <span className={`status-badge ${getEstadoColor(consulta.ESTADO)}`}>
            {consulta.ESTADO}
          </span>
        )}
      </div>

      <div className="header-content">
        <div className="patient-info-section">
          <div className="patient-avatar">
            <span className="avatar-icon">👤</span>
          </div>
          <div className="patient-details">
            <h2 className="patient-name">
              {paciente?.NOMBRE_APELLIDO || 'Paciente no seleccionado'}
            </h2>
            <div className="patient-meta">
              <span className="meta-item">
                <strong>DNI:</strong> {paciente?.DNI || 'N/A'}
              </span>
              {paciente?.EDAD && (
                <span className="meta-item">
                  <strong>Edad:</strong> {paciente.EDAD} años
                </span>
              )}
              {paciente?.SEXO && (
                <span className="meta-item">
                  <strong>Sexo:</strong> {paciente.SEXO}
                </span>
              )}
            </div>
            {paciente?.ID_FICHA_CLINICA && (
              <span className="ficha-number">
                Ficha: #{paciente.ID_FICHA_CLINICA}
              </span>
            )}
          </div>
        </div>

        <div className="consultation-info-section">
          {consulta ? (
            <div className="consultation-details">
              <div className="consultation-type">
                {getConsultaType(consulta.ES_PRIMERA_CONSULTA === 1)}
              </div>
              <div className="consultation-meta">
                <span className="meta-item">
                  <strong>Inicio:</strong> {formatDate(consulta.FECHA)}
                </span>
                {consulta.DOCTOR_NOMBRE && (
                  <span className="meta-item">
                    <strong>Doctor:</strong> Dr. {consulta.DOCTOR_NOMBRE}
                  </span>
                )}
              </div>
              {consulta.ID_CITA && (
                <span className="cita-reference">
                  Derivado de cita #{consulta.ID_CITA}
                </span>
              )}
            </div>
          ) : requisitos ? (
            <div className="consultation-type-info">
              <div className="type-display">
                {getConsultaType(requisitos.esPrimeraConsulta)}
              </div>
              <div className="flow-info">
                Flujo: {requisitos.flujo.tipo.replace('_', ' ')}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {requisitos && !consulta && (
        <div className="requirements-status">
          <h4 className="requirements-title">Estado de requisitos:</h4>
          <div className="requirements-badges">
            {Object.entries(requisitos.requisitos).map(([key, requisito]) => (
              <span
                key={key}
                className={`requirement-badge ${requisito.cumplido ? 'badge-success' : 'badge-error'}`}
              >
                {requisito.cumplido ? '✓' : '✗'} {requisito.mensaje}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultaInfoHeader;