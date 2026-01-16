import React from 'react';
import '../../styles/paciente.css';

interface PacienteFiltrosProps {
  filtroSexo: string;
  filtroEstadoCivil: string;
  onFiltroSexoChange: (value: string) => void;
  onFiltroEstadoCivilChange: (value: string) => void;
  onLimpiarFiltros: () => void;
  loading: boolean;
}

const PacienteFiltro: React.FC<PacienteFiltrosProps> = ({
  filtroSexo,
  filtroEstadoCivil,
  onFiltroSexoChange,
  onFiltroEstadoCivilChange,
  onLimpiarFiltros,
  loading
}) => {
  const filtrosActivos = [filtroSexo, filtroEstadoCivil].filter(f => f).length;

  const handleSexoChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    onFiltroSexoChange(e.target.value);
  };

  const handleEstadoCivilChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    onFiltroEstadoCivilChange(e.target.value);
  };

  const handleLimpiar = (): void => {
    onLimpiarFiltros();
  };

  return (
    <div className="paciente-filtros">
      <div className="filtros-header">
        <h3 className="filtros-title">
          Filtros Avanzados
          {filtrosActivos > 0 && (
            <span className="filtros-count">{filtrosActivos} activos</span>
          )}
        </h3>
        
        {filtrosActivos > 0 && (
          <button
            type="button"
            onClick={handleLimpiar}
            className="btn-limpiar-filtros"
            disabled={loading}
          >
            <span className="limpiar-icon">🗑️</span>
            Limpiar Filtros
          </button>
        )}
      </div>

      <div className="filtros-grid">
        <div className="filtro-group">
          <label htmlFor="filtro-sexo" className="filtro-label">
            <span className="filtro-label-icon">🚻</span>
            Sexo
          </label>
          <select
            id="filtro-sexo"
            value={filtroSexo}
            onChange={handleSexoChange}
            className="filtro-select"
            disabled={loading}
            aria-label="Filtrar por sexo"
          >
            <option value="">Todos los sexos</option>
            <option value="M">Masculino</option>
            <option value="F">Femenino</option>
            <option value="O">Otro</option>
          </select>
          {filtroSexo && (
            <div className="filtro-badge">
              {filtroSexo === 'M' ? 'Masculino' : filtroSexo === 'F' ? 'Femenino' : 'Otro'}
            </div>
          )}
        </div>

        <div className="filtro-group">
          <label htmlFor="filtro-estado-civil" className="filtro-label">
            <span className="filtro-label-icon">💍</span>
            Estado Civil
          </label>
          <select
            id="filtro-estado-civil"
            value={filtroEstadoCivil}
            onChange={handleEstadoCivilChange}
            className="filtro-select"
            disabled={loading}
            aria-label="Filtrar por estado civil"
          >
            <option value="">Todos los estados civiles</option>
            <option value="Soltero">Soltero</option>
            <option value="Casado">Casado</option>
            <option value="Divorciado">Divorciado</option>
            <option value="Viudo">Viudo</option>
            <option value="Conviviente">Conviviente</option>
          </select>
          {filtroEstadoCivil && (
            <div className="filtro-badge">
              {filtroEstadoCivil}
            </div>
          )}
        </div>

        <div className="filtro-group">
          <label className="filtro-label">
            <span className="filtro-label-icon">📊</span>
            Filtros Rápidos
          </label>
          <div className="filtros-rapidos">
            <button
              type="button"
              onClick={() => onFiltroSexoChange('M')}
              className={`filtro-rapido ${filtroSexo === 'M' ? 'active' : ''}`}
              disabled={loading}
            >
              👨 Hombres
            </button>
            <button
              type="button"
              onClick={() => onFiltroSexoChange('F')}
              className={`filtro-rapido ${filtroSexo === 'F' ? 'active' : ''}`}
              disabled={loading}
            >
              👩 Mujeres
            </button>
            <button
              type="button"
              onClick={() => onFiltroEstadoCivilChange('Casado')}
              className={`filtro-rapido ${filtroEstadoCivil === 'Casado' ? 'active' : ''}`}
              disabled={loading}
            >
              💑 Casados
            </button>
          </div>
        </div>
      </div>

      {filtrosActivos > 0 && (
        <div className="filtros-info">
          <div className="filtros-resumen">
            <span className="resumen-title">Filtros aplicados:</span>
            <div className="resumen-items">
              {filtroSexo && (
                <span className="resumen-item">
                  Sexo: <strong>{filtroSexo === 'M' ? 'Masculino' : 'Femenino'}</strong>
                </span>
              )}
              {filtroEstadoCivil && (
                <span className="resumen-item">
                  Estado Civil: <strong>{filtroEstadoCivil}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PacienteFiltro;