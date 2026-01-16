import React, { useState, useEffect } from 'react';
import { consultaService } from '../../services/apiService';
import '../../styles/consulta.css';

interface PasoRelatoProps {
  idConsulta: number;
  onComplete: (step: 'relato', data: string) => Promise<void>;
}

const PasoRelato: React.FC<PasoRelatoProps> = ({ idConsulta, onComplete }) => {
  const [relato, setRelato] = useState<string>('');
  const [cargando, setCargando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargarRelatoExistente = async (): Promise<void> => {
    try {
      setCargando(true);
      const estado = await consultaService.obtenerEstadoConsulta(idConsulta);
      if (estado.consulta?.RELATO) {
        setRelato(estado.consulta.RELATO);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error cargando relato:', err);
      setError('Error al cargar el relato existente: ' + errorMsg);
    } finally {
      setCargando(false);
    }
  };

  const guardarRelato = async (): Promise<void> => {
    if (!relato.trim()) {
      setError('El relato no puede estar vacío');
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      await onComplete('relato', relato);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error guardando relato:', err);
      setError('Error al guardar el relato: ' + errorMsg);
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    cargarRelatoExistente();
  }, [cargarRelatoExistente, idConsulta]);

  const caracteresCount = relato.length;
  const lineasCount = relato.split('\n').length;

  if (cargando) {
    return (
      <div className="step-loading">
        <div className="loading-spinner"></div>
        <p>Cargando relato existente...</p>
      </div>
    );
  }

  return (
    <div className="relato-container">
      <div className="step-header">
        <h3 className="step-title">Relato de la Enfermedad Actual</h3>
        <p className="step-description">
          Describa detalladamente la sintomatología del paciente, incluyendo tiempo de evolución,
          características principales, factores agravantes y atenuantes.
        </p>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠</span>
          <span className="error-text">{error}</span>
          <button 
            className="error-close"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="textarea-container">
        <textarea
          className="relato-textarea"
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
          placeholder="Ejemplo: Paciente refiere dolor precordial de 3 días de evolución, de carácter opresivo, que se irradia a brazo izquierdo y aumenta con el esfuerzo..."
          rows={10}
        />
      </div>

      <div className="textarea-footer">
        <div className="text-info">
          <span className="char-count">{caracteresCount} caracteres</span>
          <span className="line-count">{lineasCount} líneas</span>
        </div>
        
        <button
          className={`save-button ${guardando ? 'button-saving' : ''} ${!relato.trim() ? 'button-disabled' : ''}`}
          onClick={guardarRelato}
          disabled={guardando || !relato.trim()}
        >
          {guardando ? (
            <>
              <span className="button-spinner"></span>
              Guardando...
            </>
          ) : (
            'Guardar Relato'
          )}
        </button>
      </div>

      <div className="writing-tips">
        <h4 className="tips-title">Consejos para un buen relato:</h4>
        <ul className="tips-list">
          <li>Incluya tiempo de evolución (horas, días, semanas)</li>
          <li>Describa características del síntoma principal</li>
          <li>Mencione factores que agravan o alivian</li>
          <li>Incluya síntomas asociados si existen</li>
          <li>Especifique tratamientos previos realizados</li>
          <li>Mencione estudios previos y sus resultados</li>
        </ul>
      </div>
    </div>
  );
};

export default PasoRelato;