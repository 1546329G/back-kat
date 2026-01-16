// types/consulta.ts
export interface PasoConsulta {
  id: string;
  nombre: string;
  completado: boolean;
  activo: boolean;
  icono: React.ReactNode;
}

export interface DiagnosticoConsulta {
  idDiagnosticoConsulta: number;
  codigo: string;
  descripcion: string;
  tipo: string;
  observaciones: string | null;
  CREATED_AT: string;
}

export interface CIE10Diagnostico {
  ID_CIE_10: number;
  CODIGO: string;
  DESCRIPCION: string;
  CAPITULO: string | null;
}

export interface ExamenFisicoData {
  tipo: 'detallado' | 'simplificado';
  datos: {
    general?: string;
    regional?: string;
    cardiovascular?: string;
    abdominal?: string;
    extremidades?: string;
    neurologico?: string;
    simplificado?: string;
  };
}

export interface RecetaMedicamento {
  idMedicamento: number;
  dosis: string;
  frecuencia: string;
  duracion: string;
}

export interface RequisitosConsultaResponse {
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

export interface ConsultaIniciadaResponse {
  idConsulta: number;
  idFichaClinica: number;
  paciente: {
    ID_FICHA_CLINICA: number;
    DNI: string;
    NOMBRE_APELLIDO: string;
    EDAD: number | null;
    SEXO: string | null;
    TELEFONO: string | null;
    EMAIL: string | null;
  };
  esPrimeraConsulta: boolean;
  fechaInicio: string;
}