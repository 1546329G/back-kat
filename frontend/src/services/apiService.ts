import axios from 'axios';
import type {
  User,
  CreatePacienteData,
  Cita,
  SignosVitales,
  CitaData,
  Doctor,
  LoginResponse,
  LoginData,
  CargoUsuario,
  Paciente,
  CIE10SearchResponse,
  SignosVitalesResponse,
  AntecedentesData,
  MultiDiagnosticoData,
  ExamenFisicoResponse,
  ResumenExamenFisicoResponse,
  ExamenFisicoData,
  VerificarExamenFisicoResponse,
  ConsultaCompletaData,
  DiagnosticosConsultaResponse,
  SignosVitalesResponseData,
  RecetasResponse,
  ExamenesAuxiliaresResponse,
  ReporteDiagnosticoParams
} from '../types/models';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('cargo');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const setAuthToken = (token: string): void => {
  localStorage.setItem('token', token);
};

const removeAuthToken = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('cargo');
};

export const authService = {
  login: async (credentials: LoginData): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    if (response.data.token) {
      setAuthToken(response.data.token);
      localStorage.setItem('cargo', response.data.cargo);
    }
    return response.data;
  },

  logout: (): void => {
    removeAuthToken();
  },
};

// ============ INTERFACES NUEVAS ============

interface ApiResponse<T = string> {
  message: string;
  success: boolean;
  data?: T;
  metadata?: Record<string, unknown>;
}

interface PacienteDetalle {
  paciente: Paciente;
  antecedentes: {
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
  } | null;
  consultas: Array<{
    ID_CONSULTA: number;
    FECHA: string;
    RELATO: string;
    PLAN_DE_TRABAJO?: string;
    ES_PRIMERA_CONSULTA: number;
    ESTADO: string;
    DOCTOR?: string;
  }>;
  examenes_clinicos: Array<{
    ID_EXAMEN_CLINICO: number;
    PA: string;
    PULSO: number;
    SAO2: number;
    FR: number;
    PESO: number;
    TALLA: number;
    TEMPERATURA: number;
    IMC: number;
    FECHA_REGISTRO: string;
  }>;
  examenes_auxiliares: Array<{
    ID_EXAMEN_AUXILIAR: number;
    TIPO_EXAMEN: string;
    NOMBRE_EXAMEN: string;
    RESULTADO: string;
    FECHA_REGISTRO: string;
  }>;
  recetas: Array<{
    ID_RECETA: number;
    FECHA_EMISION: string;
    INDICACIONES_GENERALES: string;
    MEDICO: string;
  }>;
}

interface AntecedentesCompletos {
  data: AntecedentesData;
  paciente: {
    idFichaClinica: number;
    nombre: string;
    dni: string;
  };
}

interface RequisitosConsulta {
  requisitos: {
    signosVitales: {
      requerido: boolean;
      cumplido: boolean;
      mensaje: string;
      idExamenClinico: number | null;
    };
    antecedentes: {
      requerido: boolean;
      cumplido: boolean;
      mensaje: string;
    };
  };
  puedeContinuar: boolean;
  esPrimeraConsulta: boolean;
  idFichaClinica: number;
}

interface ConsultaIniciada {
  idConsulta: number;
  idFichaClinica: number;
  paciente: Paciente;
  esPrimeraConsulta: boolean;
  fechaInicio: string;
}

interface SignosVitalesConsulta {
  ID_EXAMEN_CLINICO: number;
  PA: string;
  PULSO: number;
  SAO2: number;
  FR: number;
  PESO: number;
  TALLA: number;
  TEMPERATURA: number;
  IMC: number;
  FECHA_FORMATEADA: string;
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

interface CIE10Diagnostico {
  ID_CIE_10: number;
  CODIGO: string;
  DESCRIPCION: string;
  CAPITULO: string | null;
}

interface DiagnosticoAgregado {
  idDiagnosticoConsulta: number;
  idCie10: number;
  codigo: string;
  descripcion: string;
  tipo: string;
  observaciones: string | null;
}

interface DiagnosticoConsulta {
  ID_DIAGNOSTICO_CONSULTA: number;
  ID_CIE_10: number;
  TIPO: string;
  OBSERVACIONES: string | null;
  CREATED_AT: string;
  CODIGO: string;
  DESCRIPCION: string;
  CAPITULO: string | null;
}

interface Medicamento {
  ID_MEDICAMENTO: number;
  NOMBRE: string;
  CONCENTRACION: string;
  FORMA_FARMACEUTICA: string;
}

interface RecetaCreada {
  idReceta: number;
  idConsulta: number;
  fechaEmision: string;
  indicacionesGenerales: string | null;
  totalMedicamentos: number;
}

interface RecetaDetalle {
  ID_RECETA: number;
  FECHA_EMISION: string;
  INDICACIONES_GENERALES: string;
  DOCTOR_NOMBRE: string;
  DOCTOR_APELLIDO: string;
  DOCTOR_DNI: string;
  PACIENTE_NOMBRE: string;
  PACIENTE_DNI: string;
  medicamentos: Array<{
    ID_DETALLE: number;
    MEDICAMENTO_NOMBRE: string;
    CONCENTRACION: string;
    FORMA_FARMACEUTICA: string;
    DOSIS: string;
    FRECUENCIA: string;
    DURACION: string;
  }>;
}

interface EstadoConsulta {
  consulta: {
    ID_CONSULTA: number;
    ID_FICHA_CLINICA: number;
    ES_PRIMERA_CONSULTA: number;
    RELATO: string | null;
    EXAMEN_FISICO_SIMPLIFICADO: string | null;
    EXAMEN_FISICO_GENERAL: string | null;
    EXAMEN_FISICO_REGIONAL: string | null;
    PLAN_TRABAJO: string | null;
    ESTADO: string;
    ID_RECETA: number | null;
    ID_EXAMEN_CLINICO: number | null;
  };
  progreso: {
    porcentaje: number;
    pasosCompletados: string[];
    totalPasos: number;
    faltantes: string[];
  };
  resumen: {
    tieneSignosVitales: boolean;
    tieneRelato: boolean;
    tieneAntecedentes: boolean;
    tieneExamenFisico: boolean;
    tieneDiagnosticos: boolean;
    tienePlanTrabajo: boolean;
    tieneReceta: boolean;
    tieneExamenesAux: boolean;
    puedeFinalizar: boolean;
  };
  esPrimeraConsulta: boolean;
  estado: string;
}

interface ConsultaCompleta {
  consulta: {
    ID_CONSULTA: number;
    ES_PRIMERA_CONSULTA: number;
    RELATO: string | null;
    EXAMEN_FISICO_GENERAL: string | null;
    EXAMEN_FISICO_REGIONAL: string | null;
    EXAMEN_FISICO_CARDIOVASCULAR: string | null;
    EXAMEN_FISICO_ABDOMINAL: string | null;
    EXAMEN_FISICO_EXTREMIDADES: string | null;
    EXAMEN_FISICO_NEUROLOGICO: string | null;
    EXAMEN_FISICO_SIMPLIFICADO: string | null;
    PLAN_TRABAJO: string | null;
    ESTADO: string;
    FECHA_CONSULTA_FORMATEADA: string;
    DOCTOR_NOMBRE: string;
    DOCTOR_APELLIDO: string;
  };
  signosVitales: {
    pa: string;
    pulso: number;
    sao2: number;
    fr: number;
    peso: number;
    talla: number;
    temperatura: number;
    imc: number;
    fecha: string;
  } | null;
  relato: string | null;
  antecedentes: AntecedentesConsulta | null;
  examenFisico: {
    tipo: 'detallado' | 'simplificado';
    detallado: {
      general: string | null;
      regional: string | null;
      cardiovascular: string | null;
      abdominal: string | null;
      extremidades: string | null;
      neurologico: string | null;
    } | null;
    simplificado: string | null;
  };
  diagnosticos: DiagnosticoConsulta[];
  planTrabajo: string | null;
  recetas: Array<{
    idReceta: number;
    fechaEmision: string;
    indicacionesGenerales: string;
    medico: {
      nombre: string;
      apellido: string;
      dni: string;
    };
    medicamentos: Array<{
      idDetalle: number;
      medicamentoNombre: string;
      concentracion: string;
      formaFarmaceutica: string;
      dosis: string;
      frecuencia: string;
      duracion: string;
    }>;
  }>;
  examenesAuxiliares: Array<{
    ID_EXAMEN_AUXILIAR: number;
    TIPO_EXAMEN: string;
    NOMBRE_EXAMEN: string;
    DESCRIPCION: string;
    RESULTADO: string;
    FECHA_REGISTRO: string;
  }>;
}

interface ReporteDiagnostico {
  parametros: {
    diagnostico: {
      codigo: string;
      descripcion: string;
    };
    rangoFechas: {
      inicio: string;
      fin: string;
      periodoDias: number;
    };
  };
  resultados: {
    totalConsultasAtendidas: number;
    pacientesConDiagnostico: number;
    porcentaje: string;
    estadisticasSexo: Array<{ SEXO: string; cantidad: number }>;
    estadisticasEdad: Array<{ grupo_edad: string; cantidad: number }>;
  };
  detallePacientes: {
    total: number;
    lista: Array<{
      DNI: string;
      NOMBRE_APELLIDO: string;
      EDAD: number;
      SEXO: string;
      FECHA: string;
      DOCTOR_NOMBRE: string;
      DOCTOR_APELLIDO: string;
    }>;
  };
}

interface ReporteGeneral {
  resumen: {
    total_consultas: number;
    primeras_consultas: number;
    consultas_control: number;
    total_pacientes: number;
    promedio_consultas_por_paciente: string;
  };
  top_diagnosticos: Array<{
    CODIGO: string;
    DESCRIPCION: string;
    total: number;
  }>;
  consultas_por_doctor: Array<{
    NOMBRE: string;
    APELLIDO: string;
    total_consultas: number;
  }>;
  consultas_por_dia: Array<{
    fecha: string;
    total_consultas: number;
  }>;
}

// ============ SECCIONES QUE NO TOCAR ============

export const userService = {
  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/auth/profile');
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<{ message: string; changed: boolean }> => {
    const response = await api.put('/auth/contrasena', data);
    return response.data;
  },

  register: async (userData: {
    dni: string;
    nombre?: string;
    apellido?: string;
    cargo: CargoUsuario;
    contrasena: string;
  }): Promise<{ message: string; registered: boolean }> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  toggleUserStatus: async (data: { dniToToggle: string; status: number }): Promise<{
    message: string;
    toggled: boolean;
    newStatus?: number;
  }> => {
    const response = await api.put('/auth/actestado', data);
    return response.data;
  },

  getAllUsers: async (): Promise<{
    data: User[];
    message?: string;
    total?: number
  }> => {
    const response = await api.get<{
      data: User[];
      message?: string;
      total?: number
    }>('/auth/usuarios');
    return response.data;
  }
}

export const citaService = {
  obtenerCitasHoy: async (): Promise<{ message: string; total: number; agenda: Cita[] }> => {
    const response = await api.get<{ message: string; total: number; agenda: Cita[] }>('/cita/today');
    return response.data;
  },

  crearCita: async (citaData: CitaData): Promise<{
    message: string;
    idCita: number;
    paciente: string;
    doctor: string;
    fecha: string;
    hora: string;
  }> => {
    const response = await api.post('/cita', citaData);
    return response.data;
  },

  obtenerTodasCitas: async (filters?: {
    fecha?: string;
    estado?: string;
    idDoctor?: number
  }): Promise<{
    message: string;
    total: number;
    filtros: Record<string, unknown>;
    citas: Cita[]
  }> => {
    const response = await api.get('/cita', { params: filters });
    return response.data;
  },

  obtenerCitasPorDoctor: async (idDoctor: number, filters?: {
    fecha?: string;
    estado?: string
  }): Promise<{
    message: string;
    total: number;
    doctor: string;
    filtros: Record<string, unknown>;
    citas: Cita[]
  }> => {
    const response = await api.get(`/cita/doctor/${idDoctor}`, { params: filters });
    return response.data;
  },

  obtenerCitasPorPaciente: async (dniPaciente: string, filters?: {
    estado?: string
  }): Promise<{
    message: string;
    total: number;
    paciente: string;
    dni: string;
    filtros: Record<string, unknown>;
    citas: Cita[]
  }> => {
    const response = await api.get(`/cita/paciente/${dniPaciente}`, { params: filters });
    return response.data;
  },

  obtenerCitasProximas: async (dias?: number): Promise<{
    message: string;
    total: number;
    periodo: string;
    citas: Cita[]
  }> => {
    const response = await api.get('/cita/proximas', { params: { dias } });
    return response.data;
  },

  actualizarEstadoCita: async (idCita: number, estado: string): Promise<{
    message: string;
    affectedRows: number;
    paciente: string
  }> => {
    const response = await api.put(`/cita/estado/${idCita}`, { estado });
    return response.data;
  },

  editarCita: async (idCita: number, citaData: Partial<CitaData> & { estado?: string }): Promise<{
    message: string;
    affectedRows: number;
    cambios: string[];
    cita: Cita
  }> => {
    const response = await api.put(`/cita/${idCita}`, citaData);
    return response.data;
  },

  eliminarCita: async (idCita: number): Promise<{
    message: string;
    affectedRows: number;
    citaEliminada: {
      id: number;
      paciente: string;
      fecha: string;
      hora: string;
      estado: string;
    }
  }> => {
    const response = await api.delete(`/cita/${idCita}`);
    return response.data;
  }
};

export const doctorService = {
  obtenerDoctores: async (): Promise<{
    message: string;
    total: number;
    data: Doctor[];
  }> => {
    const response = await api.get<{
      message: string;
      total: number;
      data: Doctor[];
    }>('/doctores');
    return response.data;
  },

  obtenerDoctorPorId: async (idDoctor: number): Promise<{
    message: string;
    data: Doctor;
  }> => {
    const response = await api.get<{
      message: string;
      data: Doctor;
    }>(`/doctores/${idDoctor}`);
    return response.data;
  }
};

// ============ SECCIONES ACTUALIZADAS ============

// ============ PACIENTE SERVICE ============
export const pacienteService = {
  obtenerPacientes: async (): Promise<ApiResponse<{
    pacientes: Paciente[];
    total: number;
  }>> => {
    const response = await api.get('/paciente/vista');
    return response.data;
  },

  buscarPacientes: async (query: string): Promise<ApiResponse<{
    resultados: Paciente[];
    total: number;
    query: string;
  }>> => {
    const response = await api.get(`/paciente/search/${query}`);
    return response.data;
  },

  obtenerPacientePorId: async (idFichaClinica: number): Promise<ApiResponse<{
    paciente: Paciente;
  }>> => {
    const response = await api.get(`/paciente/${idFichaClinica}`);
    return response.data;
  },

  buscarPacientePorDNI: async (dni: string): Promise<ApiResponse<{
    paciente: Paciente;
  }>> => {
    const response = await api.get(`/paciente/dni/${dni}`);
    return response.data;
  },

  obtenerDetalleCompletoPaciente: async (dni: string): Promise<ApiResponse<PacienteDetalle>> => {
    const response = await api.get(`/paciente/dni/${dni}/detalle`);
    return response.data;
  },

  crearPaciente: async (pacienteData: CreatePacienteData): Promise<ApiResponse<{
    idFichaClinica: number;
    paciente: {
      dni: string;
      nombre: string;
    };
  }>> => {
    const response = await api.post('/paciente', pacienteData);
    return response.data;
  },

  actualizarPaciente: async (dni: string, pacienteData: Partial<CreatePacienteData>): Promise<ApiResponse<{
    affectedRows: number;
  }>> => {
    const response = await api.put(`/paciente/${dni}`, pacienteData);
    return response.data;
  },

  obtenerConsultasPaciente: async (dni: string): Promise<ApiResponse<{
    consultas: Array<{
      ID_CONSULTA: number;
      FECHA: string;
      RELATO: string;
      PLAN_DE_TRABAJO: string;
      ES_PRIMERA_CONSULTA: number;
      ESTADO: string;
      DOCTOR: string;
    }>;
    total: number;
  }>> => {
    const response = await api.get(`/paciente/${dni}/consultas`);
    return response.data;
  },

  agregarExamenClinico: async (dni: string, examenData: {
    ID_CONSULTA?: number;
    PA?: string;
    PULSO?: number;
    TIPO_PULSO?: string;
    SAO2?: number;
    FR?: number;
    PESO?: number;
    TALLA?: number;
    TEMPERATURA?: number;
  }): Promise<ApiResponse<{
    id_examen_clinico: number;
    imc_calculado: string | null;
  }>> => {
    const response = await api.post(`/paciente/${dni}/examen-clinico`, examenData);
    return response.data;
  },

  agregarExamenAuxiliar: async (dni: string, examenData: FormData): Promise<ApiResponse<{
    id_examen_auxiliar: number;
    imagen_path: string | null;
    id_consulta_asociada: number | null;
  }>> => {
    const response = await api.post(`/paciente/${dni}/examen-auxiliar`, examenData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  descargarHistorialClinico: async (dni: string, format: 'json' | 'zip' = 'json'): Promise<Blob> => {
    const response = await api.get(`/paciente/${dni}/historial`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }
};

// ============ ANTECEDENTES SERVICE ============
export const antecedentesService = {
  verificarPrimeraConsulta: async (dni: string): Promise<ApiResponse<{
    esPrimeraConsulta: boolean;
    mostrarAntecedentes: boolean;
    tieneAntecedentes: boolean;
    totalConsultas: number;
    idFichaClinica: number;
    nombrePaciente: string;
    ultimaConsulta: {
      idConsulta: number;
      esPrimeraConsulta: boolean;
    } | null;
  }>> => {
    const response = await api.get(`/antecedentes/paciente/${dni}/primera-consulta`);
    return response.data;
  },

  crearAntecedentesCompletos: async (dni: string, antecedentesData: AntecedentesData): Promise<ApiResponse<{
    idAntecedentes: number;
    paciente: string;
    idFichaClinica: number;
  }>> => {
    const response = await api.post(`/antecedentes/paciente/${dni}/antecedentes-completos`, antecedentesData);
    return response.data;
  },

  obtenerAntecedentesCompletos: async (dni: string): Promise<ApiResponse<AntecedentesCompletos>> => {
    const response = await api.get(`/antecedentes/paciente/${dni}/antecedentes-completos`);
    return response.data;
  },

  actualizarAntecedentes: async (dni: string, antecedentesData: Partial<AntecedentesData>): Promise<ApiResponse<{
    idAntecedentes: number;
    paciente: string;
    camposActualizados: number;
  }>> => {
    const response = await api.put(`/antecedentes/paciente/${dni}/antecedentes`, antecedentesData);
    return response.data;
  },

  eliminarAntecedentes: async (dni: string): Promise<ApiResponse<{
    idAntecedentes: number;
    paciente: string;
  }>> => {
    const response = await api.delete(`/antecedentes/paciente/${dni}/antecedentes`);
    return response.data;
  }
};

// ============ CONSULTA SERVICE ============
export const consultaService = {
  verificarRequisitosConsulta: async (idFichaClinica: number): Promise<ApiResponse<RequisitosConsulta>> => {
    const response = await api.get(`/consulta/verificar-requisitos/${idFichaClinica}`);
    return response.data;
  },

  iniciarConsulta: async (data: { idFichaClinica: number; idCita?: number }): Promise<ApiResponse<ConsultaIniciada>> => {
    const response = await api.post('/consulta/iniciar', data);
    return response.data;
  },

  obtenerSignosVitalesConsulta: async (idConsulta: number): Promise<ApiResponse<{
    signosVitales: SignosVitalesConsulta;
  }>> => {
    const response = await api.get(`/consulta/${idConsulta}/signos-vitales`);
    return response.data;
  },

  guardarRelato: async (idConsulta: number, relato: string): Promise<ApiResponse<null>> => {
    const response = await api.put(`/consulta/${idConsulta}/relato`, { relato });
    return response.data;
  },

  obtenerAntecedentesConsulta: async (idConsulta: number): Promise<ApiResponse<{
    antecedentes: AntecedentesConsulta | null;
    existeAntecedentes: boolean;
  }>> => {
    const response = await api.get(`/consulta/${idConsulta}/antecedentes`);
    return response.data;
  },

  guardarExamenFisico: async (idConsulta: number, tipo: 'detallado' | 'simplificado', datos: {
    general?: string;
    regional?: string;
    cardiovascular?: string;
    abdominal?: string;
    extremidades?: string;
    neurologico?: string;
    simplificado?: string;
  }): Promise<ApiResponse<null>> => {
    const response = await api.post(`/consulta/${idConsulta}/examen-fisico`, { tipo, datos });
    return response.data;
  },

  buscarDiagnosticos: async (query?: string): Promise<ApiResponse<{
    diagnosticos: CIE10Diagnostico[];
    total: number;
  }>> => {
    const response = await api.get('/consulta/diagnosticos/buscar', { params: { query } });
    return response.data;
  },

  agregarDiagnostico: async (idConsulta: number, diagnosticoData: {
    idCie10: number;
    tipo?: string;
    observaciones?: string;
  }): Promise<ApiResponse<DiagnosticoAgregado>> => {
    const response = await api.post(`/consulta/${idConsulta}/diagnosticos`, diagnosticoData);
    return response.data;
  },

  obtenerDiagnosticos: async (idConsulta: number): Promise<ApiResponse<{
    diagnosticos: DiagnosticoConsulta[];
    total: number;
  }>> => {
    const response = await api.get(`/consulta/${idConsulta}/diagnosticos`);
    return response.data;
  },

  eliminarDiagnostico: async (idConsulta: number, idDiagnosticoConsulta: number): Promise<ApiResponse<{
    eliminado: boolean;
  }>> => {
    const response = await api.delete(`/consulta/${idConsulta}/diagnosticos/${idDiagnosticoConsulta}`);
    return response.data;
  },

  guardarPlanTrabajo: async (idConsulta: number, planTrabajo: string): Promise<ApiResponse<null>> => {
    const response = await api.put(`/consulta/${idConsulta}/plan-trabajo`, { planTrabajo });
    return response.data;
  },

  buscarMedicamentos: async (query?: string): Promise<ApiResponse<{
    medicamentos: Medicamento[];
    total: number;
  }>> => {
    const response = await api.get('/consulta/medicamentos/buscar', { params: { query } });
    return response.data;
  },

  crearReceta: async (idConsulta: number, recetaData: {
    indicacionesGenerales?: string;
    medicamentos?: Array<{
      idMedicamento: number;
      dosis: string;
      frecuencia: string;
      duracion: string;
    }>;
  }): Promise<ApiResponse<RecetaCreada>> => {
    const response = await api.post(`/consulta/${idConsulta}/receta`, recetaData);
    return response.data;
  },

  obtenerReceta: async (idConsulta: number): Promise<ApiResponse<{
    receta: RecetaDetalle;
    puedeImprimir: boolean;
  }>> => {
    const response = await api.get(`/consulta/${idConsulta}/receta`);
    return response.data;
  },

  finalizarConsulta: async (idConsulta: number): Promise<ApiResponse<{
    consultaFinalizada: boolean;
    idConsulta: number;
    paciente: string;
    esPrimeraConsulta: boolean;
    fechaFinalizacion: string;
    tieneReceta: boolean;
  }>> => {
    const response = await api.put(`/consulta/${idConsulta}/finalizar`);
    return response.data;
  },

  obtenerEstadoConsulta: async (idConsulta: number): Promise<ApiResponse<EstadoConsulta>> => {
    const response = await api.get(`/consulta/${idConsulta}/estado`);
    return response.data;
  },

  obtenerConsultaCompleta: async (idConsulta: number): Promise<ApiResponse<ConsultaCompleta>> => {
    const response = await api.get(`/consulta/${idConsulta}/completa`);
    return response.data;
  },

  cancelarConsulta: async (idConsulta: number, motivo?: string): Promise<ApiResponse<{
    cancelada: boolean;
  }>> => {
    const response = await api.put(`/consulta/${idConsulta}/cancelar`, { motivo });
    return response.data;
  },

  // Funciones antiguas (mantenidas por compatibilidad)
  obtenerConsultaCompletaAntigua: async (idConsulta: number): Promise<{ message: string; data: ConsultaCompletaData }> => {
    const response = await api.get<{ message: string; data: ConsultaCompletaData }>(`/consulta/consulta/${idConsulta}`);
    return response.data;
  },

  editarConsulta: async (idConsulta: number, consultaData: {
    relato: string;
    planDeTrabajo: string;
    examenFisicoSimplificado?: string;
  }): Promise<{
    message: string;
    actualizaciones: {
      relato: boolean;
      planDeTrabajo: boolean;
      examenFisico: boolean;
    };
  }> => {
    const response = await api.put(`/consulta/consulta/${idConsulta}`, consultaData);
    return response.data;
  },

  obtenerConsultasPorPaciente: async (dni: string): Promise<{
    message: string;
    total: number;
    consultas: Array<{
      ID_CONSULTA: number;
      FECHA: string;
      RELATO: string;
      PLAN_DE_TRABAJO: string;
      ES_PRIMERA_CONSULTA: number;
      ESTADO: string;
      DOCTOR_NOMBRE?: string;
      DOCTOR_APELLIDO?: string;
      PA?: string;
      PULSO?: number;
      PESO?: number;
      TALLA?: number;
      IMC?: number;
      FECHA_SIGNOS_VITALES?: string;
      TOTAL_DIAGNOSTICOS: number;
      TOTAL_RECETAS: number;
      TIPO_CONSULTA: string;
    }>;
  }> => {
    const response = await api.get(`/consulta/consultas/paciente/${dni}`);
    return response.data;
  },

  registrarSignosVitales: async (signosData: SignosVitales & { idFichaClinica: number }): Promise<SignosVitalesResponse> => {
    const response = await api.post<SignosVitalesResponse>('/signos-vitales/signos-vitales', signosData);
    return response.data;
  },

  verificarSignosVitalesHoy: async (idFichaClinica: number): Promise<{
    tieneSignosVitalesHoy: boolean;
    idExamenClinico: number | null;
  }> => {
    try {
      const response = await api.get<unknown>(`/signos-vitales/signos-vitales/hoy/ficha/${idFichaClinica}`);
      const responseData = response.data;

      const isApiResponse = (
        data: unknown
      ): data is {
        tieneSignosVitalesHoy: boolean;
        datosSignosVitales?: { ID_EXAMEN_CLINICO?: number };
      } => {
        return (
          typeof data === 'object' &&
          data !== null &&
          'tieneSignosVitalesHoy' in data &&
          typeof (data as { tieneSignosVitalesHoy: unknown }).tieneSignosVitalesHoy === 'boolean'
        );
      };

      if (isApiResponse(responseData)) {
        const idExamen = responseData.datosSignosVitales?.ID_EXAMEN_CLINICO || null;

        return {
          tieneSignosVitalesHoy: responseData.tieneSignosVitalesHoy,
          idExamenClinico: idExamen
        };
      }

      if (responseData && typeof responseData === 'object') {
        const findIdInObject = (obj: unknown): number | null => {
          if (typeof obj !== 'object' || obj === null) return null;

          const record = obj as Record<string, unknown>;
          const possibleFields = ['ID_EXAMEN_CLINICO', 'idExamenClinico', 'id', 'ID'];

          for (const field of possibleFields) {
            const value = record[field];
            if (typeof value === 'number') return value;
            if (typeof value === 'string' && !isNaN(Number(value))) return Number(value);
          }

          for (const key in record) {
            if (record[key] && typeof record[key] === 'object') {
              const nestedId = findIdInObject(record[key]);
              if (nestedId !== null) return nestedId;
            }
          }

          return null;
        };

        const idExamen = findIdInObject(responseData);

        return {
          tieneSignosVitalesHoy: true,
          idExamenClinico: idExamen
        };
      }

      return {
        tieneSignosVitalesHoy: false,
        idExamenClinico: null
      };

    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'status' in error.response &&
        error.response.status === 404
      ) {
        return {
          tieneSignosVitalesHoy: false,
          idExamenClinico: null
        };
      }

      return {
        tieneSignosVitalesHoy: false,
        idExamenClinico: null
      };
    }
  },

  obtenerSignosVitalesPorId: async (idExamenClinico: number): Promise<SignosVitalesResponseData> => {
    const response = await api.get<SignosVitalesResponseData>(`/signos-vitales/signos-vitales/${idExamenClinico}`);
    return response.data;
  },

  obtenerAntecedentesPaciente: async (dni: string): Promise<{
    message: string;
    antecedentes: {
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
    };
  }> => {
    const response = await api.get(`/paciente/${dni}/antecedentes`);
    return response.data;
  },

  buscarCIE10: async (query: string): Promise<CIE10SearchResponse> => {
    const response = await api.get<CIE10SearchResponse>('/consulta/cie10/search', {
      params: { query }
    });
    return response.data;
  },

  obtenerRecetasPorConsulta: async (idConsulta: number): Promise<RecetasResponse> => {
    const response = await api.get<RecetasResponse>(`/consulta/consulta/${idConsulta}/recetas`);
    return response.data;
  },

  obtenerExamenesAuxiliaresPorConsulta: async (idConsulta: number): Promise<ExamenesAuxiliaresResponse> => {
    const response = await api.get<ExamenesAuxiliaresResponse>(`/consulta/consulta/${idConsulta}/examenes-auxiliares`);
    return response.data;
  }
};

// ============ DIAGNOSTICO SERVICE ============
export const diagnosticoService = {
  agregarDiagnosticoSecundario: async (idConsulta: number, codigoCIE: string): Promise<{
    message: string;
    idDiagnosticoSecundario: number;
    diagnostico: {
      codigo: string;
      descripcion: string;
    };
    paciente: string;
  }> => {
    const response = await api.post(`/diagnosticos/consulta/${idConsulta}/diagnosticos-secundarios`, { codigoCIE });
    return response.data;
  },

  obtenerDiagnosticosConsulta: async (idConsulta: number): Promise<DiagnosticosConsultaResponse> => {
    const response = await api.get<DiagnosticosConsultaResponse>(`/diagnosticos/consulta/${idConsulta}/diagnosticos`);
    return response.data;
  },

  eliminarDiagnosticoSecundario: async (idConsulta: number, idDiagnosticoSecundario: number): Promise<{
    message: string;
    affectedRows: number;
    diagnosticoEliminado: {
      codigo: string;
      descripcion: string;
    };
    paciente: string;
  }> => {
    const response = await api.delete(`/diagnosticos/consulta/${idConsulta}/diagnosticos-secundarios/${idDiagnosticoSecundario}`);
    return response.data;
  },

  buscarCIE10Avanzado: async (query: string, limit?: number, categoria?: string): Promise<{
    message: string;
    data: Array<{ CODIGO: string; DESCRIPCION: string; CATEGORIA: string }>;
    total: number;
    query: string;
    filtros: {
      categoria: string;
      limite: number;
    };
  }> => {
    const response = await api.get('/diagnosticos/cie10/busqueda-avanzada', {
      params: { query, limit, categoria }
    });
    return response.data;
  },

  obtenerCategoriasCIE10: async (): Promise<{
    message: string;
    categorias: Array<{ codigo: string; descripcion: string }>;
    total: number;
  }> => {
    const response = await api.get('/diagnosticos/cie10/categorias');
    return response.data;
  },

  obtenerDiagnosticoPorCodigo: async (codigo: string): Promise<{
    message: string;
    diagnostico: {
      CODIGO: string;
      DESCRIPCION: string;
      CATEGORIA: string;
    };
  }> => {
    const response = await api.get(`/diagnosticos/cie10/${codigo}`);
    return response.data;
  },

  agregarMultiplesDiagnosticos: async (data: MultiDiagnosticoData): Promise<{
    message: string;
    diagnosticosRegistrados: number;
    diagnosticosConError: number;
    detalles: {
      exitosos: Array<{
        id: number;
        codigo: string;
        descripcion: string;
        tipo: string;
      }>;
      errores: Array<{
        codigo: string;
        error: string;
      }>;
    };
    paciente: string;
  }> => {
    const response = await api.post('/diagnosticos/diagnosticos-multiples', data);
    return response.data;
  }
};

// ============ EXAMEN FISICO SERVICE ============
export const examenFisicoService = {
  registrarExamenFisico: async (data: ExamenFisicoData): Promise<{
    message: string;
    idConsulta: number;
    tipoExamen: string;
    metadata: {
      paciente: string;
      fecha: string;
      tieneObservaciones: boolean;
    };
  }> => {
    const response = await api.post('/examen-fisico/registrar', data);
    return response.data;
  },

  obtenerExamenFisico: async (idConsulta: number): Promise<ExamenFisicoResponse> => {
    const response = await api.get<ExamenFisicoResponse>(`/examen-fisico/consulta/${idConsulta}`);
    return response.data;
  },

  verificarExamenFisico: async (idConsulta: number): Promise<VerificarExamenFisicoResponse> => {
    const response = await api.get<VerificarExamenFisicoResponse>(`/examen-fisico/consulta/${idConsulta}/verificar`);
    return response.data;
  },

  actualizarObservaciones: async (idConsulta: number, observaciones: string): Promise<{
    message: string;
    idConsulta: number;
    tieneObservaciones: boolean;
  }> => {
    const response = await api.put(`/examen-fisico/consulta/${idConsulta}/observaciones`, { observaciones });
    return response.data;
  },

  obtenerResumenExamenFisico: async (idConsulta: number): Promise<ResumenExamenFisicoResponse> => {
    const response = await api.get<ResumenExamenFisicoResponse>(`/examen-fisico/consulta/${idConsulta}/resumen`);
    return response.data;
  }
};

// ============ REPORTE SERVICE ============
export const reporteService = {
  generarReporteDiagnostico: async (params: ReporteDiagnosticoParams): Promise<ApiResponse<ReporteDiagnostico>> => {
    const response = await api.get('/reports/diagnostico', {
      params: {
        fechaInicio: params.fechaInicio,
        fechaFin: params.fechaFin,
        codigoCIE: params.codigoCIE
      }
    });
    return response.data;
  },

  generarReporteGeneral: async (fechaInicio: string, fechaFin: string): Promise<ApiResponse<ReporteGeneral>> => {
    const response = await api.get('/reports/general', {
      params: { fechaInicio, fechaFin }
    });
    return response.data;
  }
};

// ============ HISTORIA CLINICA SERVICE ============
export const historiaClinicaService = {
  generarHistoriaClinicaPDF: async (dni: string): Promise<Blob> => {
    const response = await api.get(`/historia-clinica/pdf/${dni}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default api;