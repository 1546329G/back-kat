/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { consultaService } from '../../services/apiService';
import type { SignosVitales } from '../../types/models';
import './PasoSignosVitales.css';

interface PasoSignosVitalesProps {
  idConsulta: number;
}

interface VitalSignIndicator {
  titulo: string;
  valor: string | number | null;
  unidad: string;
  tipo: string;
}

const PasoSignosVitales: React.FC<PasoSignosVitalesProps> = ({ idConsulta }) => {
  const [signosVitales, setSignosVitales] = useState<SignosVitales | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cargarSignosVitales = async (): Promise<void> => {
    try {
      setCargando(true);
      const response = await consultaService.obtenerSignosVitalesConsulta(idConsulta);
      setSignosVitales(response.signosVitales);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error cargando signos vitales:', err);
      setError('Error al cargar los signos vitales: ' + errorMsg);
    } finally {
      setCargando(false);
    }
  };

  const getValorNormal = (tipo: string, valor: number | string): { normal: boolean; mensaje: string } => {
    const numValor = typeof valor === 'string' ? parseFloat(valor) : valor;
    
    switch (tipo) {
      case 'PA':
        if (typeof valor === 'string') {
          const [sistolicaStr, diastolicaStr] = valor.split('/');
          const sistolica = parseInt(sistolicaStr);
          const diastolica = parseInt(diastolicaStr);
          
          if (isNaN(sistolica) || isNaN(diastolica)) {
            return { normal: true, mensaje: 'Formato inválido' };
          }
          
          const normal = sistolica >= 90 && sistolica <= 120 && diastolica >= 60 && diastolica <= 80;
          return {
            normal,
            mensaje: normal ? 'Normal' : sistolica > 120 || diastolica > 80 ? 'Elevada' : 'Baja'
          };
        }
        return { normal: true, mensaje: 'N/A' };
      
      case 'PULSO':
        return {
          normal: numValor >= 60 && numValor <= 100,
          mensaje: numValor < 60 ? 'Bradicardia' : numValor > 100 ? 'Taquicardia' : 'Normal'
        };
      
      case 'TEMPERATURA':
        return {
          normal: numValor >= 36 && numValor <= 37.5,
          mensaje: numValor < 36 ? 'Hipotermia' : numValor > 37.5 ? 'Fiebre' : 'Normal'
        };
      
      case 'SAO2':
        return {
          normal: numValor >= 95,
          mensaje: numValor >= 95 ? 'Normal' : 'Hipoxemia'
        };
      
      case 'IMC':
        { if (!numValor || isNaN(numValor)) return { normal: true, mensaje: 'No calculado' };
        let categoria = 'Normal';
        if (numValor < 18.5) categoria = 'Bajo peso';
        else if (numValor < 25) categoria = 'Normal';
        else if (numValor < 30) categoria = 'Sobrepeso';
        else categoria = 'Obesidad';
        return { normal: numValor >= 18.5 && numValor < 25, mensaje: categoria }; }
      
      default:
        return { normal: true, mensaje: 'N/A' };
    }
  };

  const formatFecha = (fechaString: string): string => {
    try {
      const fecha = new Date(fechaString);
      return fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fechaString;
    }
  };

  const getIndicadores = (): VitalSignIndicator[] => {
    if (!signosVitales) return [];
    
    const indicadores: VitalSignIndicator[] = [
      {
        titulo: 'Presión Arterial',
        valor: signosVitales.PA,
        unidad: 'mmHg',
        tipo: 'PA'
      },
      {
        titulo: 'Pulso',
        valor: signosVitales.PULSO,
        unidad: 'lpm',
        tipo: 'PULSO'
      },
      {
        titulo: 'Temperatura',
        valor: signosVitales.TEMPERATURA,
        unidad: '°C',
        tipo: 'TEMPERATURA'
      },
      {
        titulo: 'Saturación O₂',
        valor: signosVitales.SAO2,
        unidad: '%',
        tipo: 'SAO2'
      },
      {
        titulo: 'Peso',
        valor: signosVitales.PESO,
        unidad: 'kg',
        tipo: 'PESO'
      },
      {
        titulo: 'Talla',
        valor: signosVitales.TALLA,
        unidad: 'm',
        tipo: 'TALLA'
      },
      {
        titulo: 'IMC',
        valor: signosVitales.IMC,
        unidad: 'kg/m²',
        tipo: 'IMC'
      }
    ];

    if (signosVitales.FR) {
      indicadores.push({
        titulo: 'Frecuencia Respiratoria',
        valor: signosVitales.FR,
        unidad: 'rpm',
        tipo: 'FR'
      });
    }

    if (signosVitales.TIPO_PULSO) {
      indicadores.push({
        titulo: 'Tipo de Pulso',
        valor: signosVitales.TIPO_PULSO,
        unidad: '',
        tipo: 'TIPO_PULSO'
      });
    }

    return indicadores;
  };

  useEffect(() => {
    cargarSignosVitales();
  }, [cargarSignosVitales, idConsulta]);

  if (cargando) {
    return (
      <div className="step-loading">
        <div className="loading-spinner"></div>
        <p>Cargando signos vitales...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠</div>
        <p className="error-message">{error}</p>
        <button 
          className="retry-button"
          onClick={cargarSignosVitales}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!signosVitales) {
    return (
      <div className="no-data-container">
        <div className="no-data-icon">📊</div>
        <p className="no-data-message">No se encontraron signos vitales para esta consulta.</p>
      </div>
    );
  }

  const indicadores = getIndicadores();
  const fechaRegistro = signosVitales.FECHA_FORMATEADA || 
    formatFecha(signosVitales.FECHA_REGISTRO);

  return (
    <div className="signos-vitales-container">
      <div className="step-header">
        <h3 className="step-title">Signos Vitales</h3>
        <p className="step-description">
          Registrados el {fechaRegistro}
        </p>
      </div>

      <div className="indicators-grid">
        {indicadores.map((indicador) => {
          const { normal, mensaje } = getValorNormal(indicador.tipo, indicador.valor || '');

          return (
            <div 
              key={indicador.titulo} 
              className={`indicator-card ${indicador.valor === null || indicador.valor === undefined ? 'indicator-empty' : ''}`}
            >
              <div className="indicator-header">
                <h4 className="indicator-title">{indicador.titulo}</h4>
                {indicador.valor !== null && indicador.valor !== undefined && (
                  <span className={`indicator-status ${normal ? 'status-normal' : 'status-abnormal'}`}>
                    {mensaje}
                  </span>
                )}
              </div>
              
              <div className="indicator-value">
                {indicador.valor === null || indicador.valor === undefined ? (
                  <span className="value-empty">No registrado</span>
                ) : (
                  <>
                    <span className="value-number">{indicador.valor}</span>
                    {indicador.unidad && (
                      <span className="value-unit">{indicador.unidad}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {signosVitales.OBSERVACIONES && (
        <div className="observations-container">
          <h4 className="observations-title">Observaciones:</h4>
          <p className="observations-text">{signosVitales.OBSERVACIONES}</p>
        </div>
      )}
    </div>
  );
};

export default PasoSignosVitales;