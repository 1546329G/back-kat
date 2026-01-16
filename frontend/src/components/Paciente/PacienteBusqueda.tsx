// components/Paciente/PacienteBusqueda.tsx
import React, { useState, useEffect } from 'react';
import '../../styles/paciente.css';

interface PacienteBusquedaProps {
  busqueda: string;
  onBusquedaChange: (value: string) => void;
  onBuscar: () => void;
  loading: boolean;
}

const PacienteBusqueda: React.FC<PacienteBusquedaProps> = ({
  busqueda,
  onBusquedaChange,
  onBuscar,
  loading
}) => {
  const [busquedaLocal, setBusquedaLocal] = useState<string>(busqueda);
  const [tipoBusqueda, setTipoBusqueda] = useState<'dni' | 'nombre'>('dni');
  const [error, setError] = useState<string>('');

  // Sincronizar con el prop externo
  useEffect(() => {
    setBusquedaLocal(busqueda);
  }, [busqueda]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setBusquedaLocal(value);
    
    // Validar según el tipo de búsqueda
    if (tipoBusqueda === 'dni' && value && !/^\d*$/.test(value)) {
      setError('El DNI solo puede contener números');
    } else {
      setError('');
    }
    
    // Actualizar inmediatamente para búsqueda en tiempo real
    onBusquedaChange(value);
  };

  const handleTipoChange = (tipo: 'dni' | 'nombre'): void => {
    setTipoBusqueda(tipo);
    setBusquedaLocal('');
    onBusquedaChange('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    
    // Validaciones específicas por tipo
    if (tipoBusqueda === 'dni' && busquedaLocal && !/^\d+$/.test(busquedaLocal)) {
      setError('El DNI debe contener solo números');
      return;
    }
    
    if (tipoBusqueda === 'nombre' && busquedaLocal && busquedaLocal.trim().length < 2) {
      setError('Ingrese al menos 2 caracteres para búsqueda por nombre');
      return;
    }
    
    setError('');
    onBuscar();
  };

  const handleClear = (): void => {
    setBusquedaLocal('');
    onBusquedaChange('');
    setError('');
    onBuscar(); // Recargar lista completa
  };

  const getPlaceholderText = (): string => {
    return tipoBusqueda === 'dni' 
      ? 'Ingrese DNI (8 dígitos)...' 
      : 'Ingrese nombre o apellido...';
  };

  const getSearchDescription = (): string => {
    if (!busquedaLocal) return '';
    
    return tipoBusqueda === 'dni'
      ? `Buscando DNI: "${busquedaLocal}"`
      : `Buscando nombre: "${busquedaLocal}"`;
  };

  return (
    <div className="paciente-busqueda">
      <div className="busqueda-header">
        <h3 className="busqueda-title">Buscar Paciente</h3>
        <div className="busqueda-tipo-selector">
          <button
            type="button"
            onClick={() => handleTipoChange('dni')}
            className={`tipo-btn ${tipoBusqueda === 'dni' ? 'active' : ''}`}
            disabled={loading}
          >
            🆔 Por DNI
          </button>
          <button
            type="button"
            onClick={() => handleTipoChange('nombre')}
            className={`tipo-btn ${tipoBusqueda === 'nombre' ? 'active' : ''}`}
            disabled={loading}
          >
            👤 Por Nombre
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="busqueda-form">
        <div className="busqueda-input-group">
          <div className="busqueda-icon">
            {tipoBusqueda === 'dni' ? '🆔' : '👤'}
          </div>
          <input
            type="text"
            value={busquedaLocal}
            onChange={handleChange}
            placeholder={getPlaceholderText()}
            className={`busqueda-input ${error ? 'error' : ''}`}
            disabled={loading}
            aria-label={`Buscar pacientes por ${tipoBusqueda}`}
            maxLength={tipoBusqueda === 'dni' ? 8 : 50}
            pattern={tipoBusqueda === 'dni' ? '\\d*' : '.*'}
            title={tipoBusqueda === 'dni' ? 'Solo números permitidos' : 'Buscar por nombre'}
          />
          
          <div className="busqueda-actions">
            {busquedaLocal && (
              <button
                type="button"
                onClick={handleClear}
                className="busqueda-clear"
                disabled={loading}
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
            
            <button
              type="submit"
              className="busqueda-button"
              disabled={loading || !busquedaLocal.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Buscando...
                </>
              ) : (
                'Buscar'
              )}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="busqueda-error">
            ⚠️ {error}
          </div>
        )}
        
        <div className="busqueda-info">
          <div className="busqueda-tips">
            {tipoBusqueda === 'dni' ? (
              <>
                <span className="tip-title">Buscar por DNI:</span>
                <ul className="tip-list">
                  <li>Ingrese exactamente 8 dígitos</li>
                  <li>Ejemplo: 12345678</li>
                  <li>Búsqueda exacta del documento</li>
                </ul>
              </>
            ) : (
              <>
                <span className="tip-title">Buscar por Nombre:</span>
                <ul className="tip-list">
                  <li>Busca en nombres y apellidos</li>
                  <li>No es necesario el nombre completo</li>
                  <li>Ejemplo: "Juan", "Pérez", "Juan Pérez"</li>
                  <li>Búsqueda parcial (contiene)</li>
                </ul>
              </>
            )}
          </div>
          
          {busquedaLocal && (
            <div className="busqueda-active">
              <span className="active-label">Búsqueda activa:</span>
              <span className="active-value">{getSearchDescription()}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default PacienteBusqueda;