import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Clipboard, 
  FileText, 
  Stethoscope, 
  AlertCircle, 
  CheckCircle, 
  ArrowLeft,
  Save,
  Printer,
  User,
  Calendar,
  Activity,
  Pill,
  ClipboardCheck,
  Search,
  Trash2,
  Plus,
  Eye
} from 'lucide-react';
import { consultaService, pacienteService } from '../services/apiService';
import type { 
  PasoConsulta, 
  DiagnosticoConsulta, 
  CIE10Diagnostico,
  ExamenFisicoData
} from '../types/consulta';

// Definir la interfaz de Receta aquí
interface RecetaData {
  idReceta: number;
  fechaEmision: string;
  indicacionesGenerales: string | null;
  totalMedicamentos: number;
}

interface PacienteInfo {
  ID_FICHA_CLINICA: number;
  DNI: string;
  NOMBRE_APELLIDO: string;
  EDAD: number | null;
  SEXO: string | null;
  TELEFONO: string | null;
  EMAIL: string | null;
  FECHA_NACIMIENTO: string | null;
}

interface AntecedentesConsulta {
  ANTECEDENTES_FAMILIARES?: string;
  ANTECEDENTES_PERSONALES?: string;
  ANTECEDENTES_PERSONALES_PATOLOGICOS?: string;
  ANTECEDENTES_PERSONALES_NO_PATOLOGICOS?: string;
  ANTECEDENTES_ALERGICOS?: string;
  ANTECEDENTES_QUIRURGICOS?: string;
  ANTECEDENTES_TRANSFUSIONALES?: string;
  ANTECEDENTES_TOXICOS?: string;
  ANTECEDENTES_GINECO_OBSTETRICOS?: string;
  MEDICACION_ACTUAL?: string;
}

const Consulta: React.FC = () => {
  const { idFichaClinica } = useParams<{ idFichaClinica: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [consultaId, setConsultaId] = useState<number | null>(null);
  const [paciente, setPaciente] = useState<PacienteInfo | null>(null);
  const [esPrimeraConsulta, setEsPrimeraConsulta] = useState(false);
  const [puedeContinuar, setPuedeContinuar] = useState(false);
  
  // Estados para cada paso
  const [relato, setRelato] = useState('');
  const [antecedentes, setAntecedentes] = useState<AntecedentesConsulta | null>(null);
  const [examenFisico, setExamenFisico] = useState<ExamenFisicoData | null>(null);
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoConsulta[]>([]);
  const [planTrabajo, setPlanTrabajo] = useState('');
  const [receta, setReceta] = useState<RecetaData | null>(null);
  
  // Estados para búsquedas
  const [buscarDiagnostico, setBuscarDiagnostico] = useState('');
  const [resultadosDiagnosticos, setResultadosDiagnosticos] = useState<CIE10Diagnostico[]>([]);
  const [mostrarBusquedaDiagnosticos, setMostrarBusquedaDiagnosticos] = useState(false);
  
  const [pasos, setPasos] = useState<PasoConsulta[]>([
    { id: 'signos', nombre: 'Signos Vitales', completado: false, activo: false, icono: <Activity size={20} /> },
    { id: 'relato', nombre: 'Relato', completado: false, activo: false, icono: <FileText size={20} /> },
    { id: 'antecedentes', nombre: 'Antecedentes', completado: false, activo: false, icono: <Clipboard size={20} /> },
    { id: 'examen', nombre: 'Examen Físico', completado: false, activo: false, icono: <Stethoscope size={20} /> },
    { id: 'diagnostico', nombre: 'Diagnóstico', completado: false, activo: false, icono: <FileText size={20} /> },
    { id: 'plan', nombre: 'Plan de Trabajo', completado: false, activo: false, icono: <ClipboardCheck size={20} /> },
    { id: 'receta', nombre: 'Receta', completado: false, activo: false, icono: <Pill size={20} /> },
  ]);

  const [pasoActual, setPasoActual] = useState(0);

  // Mueve la función verificarRequisitos aquí usando useCallback
  const verificarRequisitos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!idFichaClinica) {
        setError('ID de ficha clínica no proporcionado');
        return;
      }
      
      const id = parseInt(idFichaClinica);
      if (isNaN(id)) {
        setError('ID de ficha clínica inválido');
        return;
      }
      
      const response = await consultaService.verificarRequisitosConsulta(id);
      
      if (response.success && response.data) {
        setPuedeContinuar(response.data.puedeContinuar);
        setEsPrimeraConsulta(response.data.esPrimeraConsulta);
        
        if (response.data.puedeContinuar) {
          // Cargar datos del paciente
          const pacienteResponse = await pacienteService.obtenerPacientePorId(id);
          if (pacienteResponse.success && pacienteResponse.data) {
            setPaciente(pacienteResponse.data.paciente);
          }
          
          // Actualizar pasos
          const nuevosPasos = [...pasos];
          nuevosPasos[0].completado = true;
          nuevosPasos[0].activo = false;
          nuevosPasos[1].activo = true;
          setPasos(nuevosPasos);
          setPasoActual(1);
        } else {
          setError('No se cumplen los requisitos para iniciar consulta. ' + 
                   'Verifique signos vitales y antecedentes (si es primera consulta).');
        }
      } else {
        setError('Error al verificar requisitos');
      }
    } catch (error) {
      console.error('Error al verificar requisitos:', error);
      setError('Error al verificar requisitos de consulta');
    } finally {
      setLoading(false);
    }
  }, [idFichaClinica, pasos]); // Dependencias

  useEffect(() => {
    if (idFichaClinica) {
      verificarRequisitos();
    }
  }, [idFichaClinica, verificarRequisitos]);

  const iniciarConsulta = async () => {
    try {
      setError(null);
      
      if (!idFichaClinica) {
        setError('ID de ficha clínica no proporcionado');
        return;
      }
      
      const response = await consultaService.iniciarConsulta({
        idFichaClinica: parseInt(idFichaClinica)
      });
      
      if (response.success && response.data) {
        setConsultaId(response.data.idConsulta);
        setPaciente(response.data.paciente as PacienteInfo);
        setEsPrimeraConsulta(response.data.esPrimeraConsulta);
        
        const nuevosPasos = [...pasos];
        nuevosPasos[0].completado = true;
        nuevosPasos[0].activo = false;
        nuevosPasos[1].activo = true;
        setPasos(nuevosPasos);
        setPasoActual(1);
      } else {
        setError('Error al iniciar consulta');
      }
    } catch (error) {
      console.error('Error al iniciar consulta:', error);
      setError('Error al iniciar consulta');
    }
  };

  const guardarRelato = async () => {
    if (!consultaId || !relato.trim()) {
      alert('El relato no puede estar vacío');
      return;
    }

    try {
      const response = await consultaService.guardarRelato(consultaId, relato);
      if (response.success) {
        const nuevosPasos = [...pasos];
        nuevosPasos[1].completado = true;
        nuevosPasos[1].activo = false;
        nuevosPasos[2].activo = true;
        setPasos(nuevosPasos);
        setPasoActual(2);
        
        await cargarAntecedentes();
      } else {
        alert('Error al guardar relato');
      }
    } catch (error) {
      console.error('Error al guardar relato:', error);
      alert('Error al guardar relato');
    }
  };

  const cargarAntecedentes = async () => {
    if (!consultaId) return;

    try {
      const response = await consultaService.obtenerAntecedentesConsulta(consultaId);
      if (response.success && response.data) {
        setAntecedentes(response.data.antecedentes);
        
        if (response.data.existeAntecedentes) {
          const nuevosPasos = [...pasos];
          nuevosPasos[2].completado = true;
          nuevosPasos[2].activo = false;
          nuevosPasos[3].activo = true;
          setPasos(nuevosPasos);
          setPasoActual(3);
        }
      }
    } catch (error) {
      console.error('Error al cargar antecedentes:', error);
    }
  };

  const guardarExamenFisico = async (tipo: 'detallado' | 'simplificado', datos: ExamenFisicoData['datos']) => {
    if (!consultaId) return;

    try {
      const response = await consultaService.guardarExamenFisico(consultaId, tipo, datos);
      if (response.success) {
        setExamenFisico({ tipo, datos });
        
        const nuevosPasos = [...pasos];
        nuevosPasos[3].completado = true;
        nuevosPasos[3].activo = false;
        nuevosPasos[4].activo = true;
        setPasos(nuevosPasos);
        setPasoActual(4);
      } else {
        alert('Error al guardar examen físico');
      }
    } catch (error) {
      console.error('Error al guardar examen físico:', error);
      alert('Error al guardar examen físico');
    }
  };

  const buscarDiagnosticosHandler = async () => {
    if (!buscarDiagnostico.trim()) {
      setResultadosDiagnosticos([]);
      return;
    }

    try {
      const response = await consultaService.buscarDiagnosticos(buscarDiagnostico);
      if (response.success && response.data) {
        setResultadosDiagnosticos(response.data.diagnosticos);
        setMostrarBusquedaDiagnosticos(true);
      }
    } catch (error) {
      console.error('Error al buscar diagnósticos:', error);
      setResultadosDiagnosticos([]);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agregarDiagnostico = async (idCie10: number, _codigo: string, _descripcion: string) => {
    if (!consultaId) return;

    try {
      const response = await consultaService.agregarDiagnostico(consultaId, {
        idCie10,
        tipo: diagnosticos.length === 0 ? 'principal' : 'secundario'
      });

      if (response.success && response.data) {
        const nuevoDiagnostico: DiagnosticoConsulta = {
          idDiagnosticoConsulta: response.data.idDiagnosticoConsulta,
          codigo: response.data.codigo,
          descripcion: response.data.descripcion,
          tipo: response.data.tipo,
          observaciones: response.data.observaciones,
          CREATED_AT: new Date().toISOString()
        };
        
        setDiagnosticos([...diagnosticos, nuevoDiagnostico]);
        setMostrarBusquedaDiagnosticos(false);
        setBuscarDiagnostico('');
      }
    } catch (error) {
      console.error('Error al agregar diagnóstico:', error);
      alert('Error al agregar diagnóstico');
    }
  };

  const eliminarDiagnostico = async (idDiagnosticoConsulta: number) => {
    if (!consultaId) return;

    try {
      const response = await consultaService.eliminarDiagnostico(consultaId, idDiagnosticoConsulta);
      if (response.success) {
        setDiagnosticos(diagnosticos.filter(d => d.idDiagnosticoConsulta !== idDiagnosticoConsulta));
      }
    } catch (error) {
      console.error('Error al eliminar diagnóstico:', error);
      alert('Error al eliminar diagnóstico');
    }
  };

  const guardarPlanTrabajo = async () => {
    if (!consultaId || !planTrabajo.trim()) {
      alert('El plan de trabajo no puede estar vacío');
      return;
    }

    try {
      const response = await consultaService.guardarPlanTrabajo(consultaId, planTrabajo);
      if (response.success) {
        const nuevosPasos = [...pasos];
        nuevosPasos[5].completado = true;
        nuevosPasos[5].activo = false;
        nuevosPasos[6].activo = true;
        setPasos(nuevosPasos);
        setPasoActual(6);
      }
    } catch (error) {
      console.error('Error al guardar plan de trabajo:', error);
      alert('Error al guardar plan de trabajo');
    }
  };

  const crearReceta = async () => {
    if (!consultaId) return;

    try {
      const response = await consultaService.crearReceta(consultaId, {
        indicacionesGenerales: 'Tomar según indicaciones médicas',
        medicamentos: []
      });

      if (response.success && response.data) {
        setReceta(response.data as RecetaData);
        
        const nuevosPasos = [...pasos];
        nuevosPasos[6].completado = true;
        setPasos(nuevosPasos);
      }
    } catch (error) {
      console.error('Error al crear receta:', error);
      alert('Error al crear receta');
    }
  };

  const finalizarConsulta = async () => {
    if (!consultaId) return;

    if (!confirm('¿Está seguro de finalizar la consulta? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await consultaService.finalizarConsulta(consultaId);
      if (response.success) {
        alert('Consulta finalizada exitosamente');
        navigate(`/consultas/${consultaId}`);
      }
    } catch (error: unknown) {
      console.error('Error al finalizar consulta:', error);
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { code?: string; detalles?: string[] } } };
        if (axiosError.response?.data?.code === 'CONSULTA_INCOMPLETA') {
          alert('No se puede finalizar: ' + (axiosError.response.data.detalles?.join(', ') || 'Consulta incompleta'));
          return;
        }
      }
      
      alert('Error al finalizar consulta');
    }
  };

  const irAPaso = (index: number) => {
    if (index > pasoActual) return;
    setPasoActual(index);
    const nuevosPasos = pasos.map((paso, i) => ({
      ...paso,
      activo: i === index
    }));
    setPasos(nuevosPasos);
  };

  const renderPaso = () => {
    switch (pasoActual) {
      case 1: // Relato
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText size={24} className="text-blue-600" />
              Relato de la Consulta
            </h3>
            <textarea
              className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Describa el motivo de consulta, síntomas, historia de la enfermedad..."
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={guardarRelato}
                disabled={!relato.trim()}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  !relato.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save size={20} />
                Guardar y Continuar
              </button>
            </div>
          </div>
        );

      case 2: // Antecedentes
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clipboard size={24} className="text-blue-600" />
              Antecedentes del Paciente
            </h3>
            
            {antecedentes ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-700 mb-3">Antecedentes registrados:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {antecedentes.ANTECEDENTES_FAMILIARES && (
                    <div>
                      <label className="text-sm text-gray-500">Familiares</label>
                      <p className="font-medium">{antecedentes.ANTECEDENTES_FAMILIARES}</p>
                    </div>
                  )}
                  {antecedentes.ANTECEDENTES_PERSONALES && (
                    <div>
                      <label className="text-sm text-gray-500">Personales</label>
                      <p className="font-medium">{antecedentes.ANTECEDENTES_PERSONALES}</p>
                    </div>
                  )}
                  {antecedentes.ANTECEDENTES_ALERGICOS && (
                    <div>
                      <label className="text-sm text-gray-500">Alérgicos</label>
                      <p className="font-medium">{antecedentes.ANTECEDENTES_ALERGICOS}</p>
                    </div>
                  )}
                  {antecedentes.MEDICACION_ACTUAL && (
                    <div>
                      <label className="text-sm text-gray-500">Medicación Actual</label>
                      <p className="font-medium">{antecedentes.MEDICACION_ACTUAL}</p>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      const nuevosPasos = [...pasos];
                      nuevosPasos[2].completado = true;
                      nuevosPasos[2].activo = false;
                      nuevosPasos[3].activo = true;
                      setPasos(nuevosPasos);
                      setPasoActual(3);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Continuar con Examen Físico
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="mx-auto text-yellow-500 mb-4" size={48} />
                <h4 className="text-lg font-medium text-gray-700 mb-2">No hay antecedentes registrados</h4>
                <p className="text-gray-500 mb-6">
                  {esPrimeraConsulta 
                    ? 'Para primera consulta, es necesario registrar antecedentes completos.'
                    : 'Para consulta de control, puede continuar con el examen físico.'}
                </p>
                <div className="flex justify-center gap-3">
                  {esPrimeraConsulta ? (
                    <button
                      onClick={() => navigate(`/antecedentes/nuevo/${paciente?.DNI}`)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Registrar Antecedentes
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const nuevosPasos = [...pasos];
                        nuevosPasos[2].completado = true;
                        nuevosPasos[2].activo = false;
                        nuevosPasos[3].activo = true;
                        setPasos(nuevosPasos);
                        setPasoActual(3);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Continuar sin Antecedentes
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Examen Físico
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Stethoscope size={24} className="text-blue-600" />
              Examen Físico
            </h3>
            
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Tipo de examen: <span className="font-semibold">
                  {esPrimeraConsulta ? 'Detallado (requerido)' : 'Simplificado'}
                </span>
              </p>
              
              {esPrimeraConsulta ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Examen General</label>
                    <textarea
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg"
                      placeholder="Estado general, conciencia, hidratación..."
                      value={examenFisico?.datos.general || ''}
                      onChange={(e) => setExamenFisico(prev => ({
                        tipo: 'detallado',
                        datos: { 
                          ...prev?.datos, 
                          general: e.target.value 
                        } as ExamenFisicoData['datos']
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Examen Regional</label>
                    <textarea
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg"
                      placeholder="Cabeza, cuello, tórax..."
                      value={examenFisico?.datos.regional || ''}
                      onChange={(e) => setExamenFisico(prev => ({
                        tipo: 'detallado',
                        datos: { 
                          ...prev?.datos, 
                          regional: e.target.value 
                        } as ExamenFisicoData['datos']
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cardiovascular</label>
                    <textarea
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg"
                      placeholder="Ritmo cardíaco, ruidos, pulsos..."
                      value={examenFisico?.datos.cardiovascular || ''}
                      onChange={(e) => setExamenFisico(prev => ({
                        tipo: 'detallado',
                        datos: { 
                          ...prev?.datos, 
                          cardiovascular: e.target.value 
                        } as ExamenFisicoData['datos']
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Abdominal</label>
                    <textarea
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg"
                      placeholder="Forma, ruidos, dolor..."
                      value={examenFisico?.datos.abdominal || ''}
                      onChange={(e) => setExamenFisico(prev => ({
                        tipo: 'detallado',
                        datos: { 
                          ...prev?.datos, 
                          abdominal: e.target.value 
                        } as ExamenFisicoData['datos']
                      }))}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Examen Físico Simplificado</label>
                  <textarea
                    className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Describa los hallazgos del examen físico..."
                    value={examenFisico?.datos.simplificado || ''}
                    onChange={(e) => setExamenFisico(prev => ({
                      tipo: 'simplificado',
                      datos: { 
                        ...prev?.datos, 
                        simplificado: e.target.value 
                      } as ExamenFisicoData['datos']
                    }))}
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => guardarExamenFisico(
                  esPrimeraConsulta ? 'detallado' : 'simplificado',
                  examenFisico?.datos || (esPrimeraConsulta ? {
                    general: '',
                    regional: '',
                    cardiovascular: '',
                    abdominal: '',
                    extremidades: '',
                    neurologico: ''
                  } : { simplificado: '' })
                )}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save size={20} />
                Guardar Examen Físico
              </button>
            </div>
          </div>
        );

      case 4: // Diagnóstico
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              Diagnósticos CIE-10
            </h3>
            
            {/* Buscador de diagnósticos */}
            <div className="mb-6">
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Buscar por código o descripción CIE-10..."
                    value={buscarDiagnostico}
                    onChange={(e) => setBuscarDiagnostico(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && buscarDiagnosticosHandler()}
                  />
                </div>
                <button
                  onClick={buscarDiagnosticosHandler}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Buscar
                </button>
              </div>
              
              {/* Resultados de búsqueda */}
              {mostrarBusquedaDiagnosticos && (
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                  {resultadosDiagnosticos.length > 0 ? (
                    resultadosDiagnosticos.map((diagnostico) => (
                      <div
                        key={diagnostico.ID_CIE_10}
                        className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => agregarDiagnostico(
                          diagnostico.ID_CIE_10,
                          diagnostico.CODIGO,
                          diagnostico.DESCRIPCION
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-mono font-semibold text-blue-600">
                              {diagnostico.CODIGO}
                            </span>
                            <p className="text-gray-700 mt-1">{diagnostico.DESCRIPCION}</p>
                          </div>
                          <button className="text-green-600 hover:text-green-800">
                            <Plus size={20} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No se encontraron resultados
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Lista de diagnósticos agregados */}
            <div className="mt-6">
              <h4 className="font-medium text-gray-700 mb-3">Diagnósticos agregados:</h4>
              {diagnosticos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No hay diagnósticos agregados
                </div>
              ) : (
                <div className="space-y-3">
                  {diagnosticos.map((diagnostico) => (
                    <div
                      key={diagnostico.idDiagnosticoConsulta}
                      className="bg-gray-50 p-4 rounded-lg border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              diagnostico.tipo === 'principal'
                                ? 'bg-red-100 text-red-800'
                                : diagnostico.tipo === 'secundario'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {diagnostico.tipo.toUpperCase()}
                            </span>
                            <span className="font-mono font-bold">{diagnostico.codigo}</span>
                          </div>
                          <p className="text-gray-800">{diagnostico.descripcion}</p>
                          {diagnostico.observaciones && (
                            <p className="text-gray-600 text-sm mt-1">
                              <span className="font-medium">Observaciones:</span> {diagnostico.observaciones}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => eliminarDiagnostico(diagnostico.idDiagnosticoConsulta)}
                          className="text-red-600 hover:text-red-800"
                          title="Eliminar diagnóstico"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => {
                    const nuevosPasos = [...pasos];
                    nuevosPasos[4].completado = diagnosticos.length > 0;
                    nuevosPasos[4].activo = false;
                    nuevosPasos[5].activo = true;
                    setPasos(nuevosPasos);
                    setPasoActual(5);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Continuar con Plan de Trabajo
                </button>
                {diagnosticos.length > 0 && (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle size={18} />
                    {diagnosticos.length} diagnóstico{diagnosticos.length !== 1 ? 's' : ''} agregado{diagnosticos.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        );

      case 5: // Plan de Trabajo
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <ClipboardCheck size={24} className="text-blue-600" />
              Plan de Trabajo
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describa el plan de tratamiento, seguimiento y recomendaciones:
              </label>
              <textarea
                className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Incluya tratamiento médico, recomendaciones, seguimiento, referencias a especialistas..."
                value={planTrabajo}
                onChange={(e) => setPlanTrabajo(e.target.value)}
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  const nuevosPasos = [...pasos];
                  nuevosPasos[4].activo = true;
                  nuevosPasos[5].activo = false;
                  setPasos(nuevosPasos);
                  setPasoActual(4);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Volver a Diagnósticos
              </button>
              <button
                onClick={guardarPlanTrabajo}
                disabled={!planTrabajo.trim()}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  !planTrabajo.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save size={20} />
                Guardar y Continuar
              </button>
            </div>
          </div>
        );

      case 6: // Receta
        return (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Pill size={24} className="text-blue-600" />
              Receta Médica
            </h3>
            
            {receta ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="text-green-600" size={32} />
                  <div>
                    <h4 className="font-semibold text-gray-800">Receta creada exitosamente</h4>
                    <p className="text-gray-600">ID Receta: {receta.idReceta}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-sm text-gray-500">Fecha de emisión</label>
                    <p className="font-medium">{new Date(receta.fechaEmision).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Total medicamentos</label>
                    <p className="font-medium">{receta.totalMedicamentos}</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(`/consultas/${consultaId}/receta`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Printer size={20} />
                    Ver Receta Completa
                  </button>
                  <button
                    onClick={() => {
                      const nuevosPasos = [...pasos];
                      nuevosPasos[6].completado = true;
                      setPasos(nuevosPasos);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <h4 className="font-medium text-gray-800 mb-3">Crear Receta Médica</h4>
                  <p className="text-gray-600 mb-4">
                    Puede crear una receta médica para el paciente. La receta puede incluir:
                  </p>
                  <ul className="text-gray-600 text-left space-y-2 mb-6">
                    <li className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      Medicamentos y dosis
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      Frecuencia de administración
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      Duración del tratamiento
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      Indicaciones especiales
                    </li>
                  </ul>
                  
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={crearReceta}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Plus size={20} />
                      Crear Receta
                    </button>
                    <button
                      onClick={() => {
                        const nuevosPasos = [...pasos];
                        nuevosPasos[6].completado = true;
                        setPasos(nuevosPasos);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    >
                      Omitir Receta
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft size={20} />
          Volver
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Consulta Médica</h1>
            {paciente && (
              <div className="mt-2 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User size={18} className="text-gray-500" />
                  <span className="font-medium">{paciente.NOMBRE_APELLIDO}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-gray-500" />
                  <span className="text-gray-600">Edad: {paciente.EDAD || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clipboard size={18} className="text-gray-500" />
                  <span className="text-gray-600">DNI: {paciente.DNI}</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => consultaId && navigate(`/consultas/${consultaId}/historial`)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Eye size={20} />
              Ver Historial
            </button>
            {consultaId && (
              <button
                onClick={finalizarConsulta}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle size={20} />
                Finalizar Consulta
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle size={20} />
            <span className="font-medium">Error: </span>
            <span>{error}</span>
          </div>
          {!puedeContinuar && (
            <button
              onClick={iniciarConsulta}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Reintentar Iniciar Consulta
            </button>
          )}
        </div>
      )}

      {/* Pasos de la consulta */}
      <div className="mb-8">
        <div className="flex overflow-x-auto pb-2">
          {pasos.map((paso, index) => (
            <button
              key={paso.id}
              onClick={() => irAPaso(index)}
              className={`flex-shrink-0 flex flex-col items-center px-4 py-3 min-w-32 border-b-2 ${
                paso.activo
                  ? 'border-blue-600 text-blue-600'
                  : paso.completado
                  ? 'border-green-500 text-green-600'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full mb-2 ${
                paso.activo
                  ? 'bg-blue-100 text-blue-600'
                  : paso.completado
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {paso.completado ? <CheckCircle size={20} /> : paso.icono}
              </div>
              <span className="text-sm font-medium whitespace-nowrap">{paso.nombre}</span>
              <span className="text-xs mt-1">
                {index === pasoActual ? 'Actual' : paso.completado ? 'Completado' : 'Pendiente'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Contenido del paso actual */}
      {puedeContinuar ? (
        renderPaso()
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertCircle className="mx-auto text-yellow-500 mb-4" size={48} />
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Verificación de Requisitos
          </h3>
          <p className="text-gray-600 mb-6">
            Antes de iniciar la consulta, es necesario verificar que se cumplan todos los requisitos.
          </p>
          <button
            onClick={iniciarConsulta}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Iniciar Consulta
          </button>
        </div>
      )}
    </div>
  );
};

export default Consulta;