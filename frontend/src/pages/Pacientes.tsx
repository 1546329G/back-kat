import React, { useState, useEffect } from 'react';
import { Search, UserPlus, FileText, Eye, Edit, Download, Calendar, Mail, Phone, Home, Briefcase, User } from 'lucide-react';
import { pacienteService } from '../services/apiService';
import type { Paciente } from '../types/models';
import { Link } from 'react-router-dom';

interface PacienteConConsultas extends Paciente {
  totalConsultas?: number;
  ultimaConsulta?: string;
}

interface PacienteDetalleModal {
  paciente: PacienteConConsultas;
  totalConsultas: number;
}

interface NuevoPacienteForm {
  dni: string;
  nombreApellido: string;
  fechaNacimiento: string;
  edad: string;
  sexo: string;
  telefono: string;
  email: string;
  domicilio: string;
  estadoCivil: string;
  ocupacion: string;
  responsable: string;
}

interface CreatePacienteData {
  dni: string;
  nombreApellido: string;
  fechaNacimiento?: string;
  edad?: number;
  sexo?: string;
  telefono?: string;
  email?: string;
  domicilio?: string;
  estadoCivil?: string;
  ocupacion?: string;
  responsable?: string;
}

interface ApiError {
  response?: {
    data?: {
      code?: string;
      message?: string;
    }
  }
}

const Pacientes: React.FC = () => {
  const [pacientes, setPacientes] = useState<PacienteConConsultas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [detalleModal, setDetalleModal] = useState<PacienteDetalleModal | null>(null);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [descargandoHistorial, setDescargandoHistorial] = useState<string | null>(null);

  const [nuevoPaciente, setNuevoPaciente] = useState<NuevoPacienteForm>({
    dni: '',
    nombreApellido: '',
    fechaNacimiento: '',
    edad: '',
    sexo: '',
    telefono: '',
    email: '',
    domicilio: '',
    estadoCivil: '',
    ocupacion: '',
    responsable: ''
  });

  useEffect(() => {
    cargarPacientes();
  }, []);

  const cargarPacientes = async () => {
    try {
      setLoading(true);
      const response = await pacienteService.obtenerPacientes();
      if (response.success && response.data) {
        const pacientesConFecha = response.data.pacientes.map(p => ({
          ...p,
          FECHA: p.FECHA || '',
          totalConsultas: 0
        }));
        setPacientes(pacientesConFecha);
      }
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarPacientes = async () => {
    if (!searchTerm.trim()) {
      cargarPacientes();
      return;
    }

    try {
      setLoading(true);
      const response = await pacienteService.buscarPacientes(searchTerm);
      if (response.success && response.data) {
        const pacientesConConsultas = response.data.resultados.map(p => ({
          ...p,
          totalConsultas: 0
        }));
        setPacientes(pacientesConConsultas);
      }
    } catch (error) {
      console.error('Error al buscar pacientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (paciente: PacienteConConsultas) => {
    try {
      const response = await pacienteService.obtenerDetalleCompletoPaciente(paciente.DNI);
      if (response.success && response.data) {
        const totalConsultas = response.data.consultas?.length || 0;
        setDetalleModal({
          paciente: {
            ...paciente,
            totalConsultas
          },
          totalConsultas
        });
      }
    } catch (error) {
      console.error('Error al obtener detalle:', error);
    }
  };

  const handleCrearPaciente = async () => {
    try {
      // Validar DNI
      if (nuevoPaciente.dni.length !== 8) {
        alert('El DNI debe tener 8 dígitos');
        return;
      }

      // Validar nombre
      if (nuevoPaciente.nombreApellido.length < 3) {
        alert('El nombre debe tener al menos 3 caracteres');
        return;
      }

      const pacienteData: CreatePacienteData = {
        dni: nuevoPaciente.dni,
        nombreApellido: nuevoPaciente.nombreApellido,
        fechaNacimiento: nuevoPaciente.fechaNacimiento || undefined,
        edad: nuevoPaciente.edad ? parseInt(nuevoPaciente.edad) : undefined,
        sexo: nuevoPaciente.sexo || undefined,
        telefono: nuevoPaciente.telefono || undefined,
        email: nuevoPaciente.email || undefined,
        domicilio: nuevoPaciente.domicilio || undefined,
        estadoCivil: nuevoPaciente.estadoCivil || undefined,
        ocupacion: nuevoPaciente.ocupacion || undefined,
        responsable: nuevoPaciente.responsable || undefined
      };

      const response = await pacienteService.crearPaciente(pacienteData);
      
      if (response.success) {
        alert('Paciente creado exitosamente');
        setShowNuevoModal(false);
        setNuevoPaciente({
          dni: '',
          nombreApellido: '',
          fechaNacimiento: '',
          edad: '',
          sexo: '',
          telefono: '',
          email: '',
          domicilio: '',
          estadoCivil: '',
          ocupacion: '',
          responsable: ''
        });
        cargarPacientes();
      }
    } catch (error: unknown) {
      console.error('Error al crear paciente:', error);
      
      // Verificación de tipo para el error
      const apiError = error as ApiError;
      if (apiError.response?.data?.code === 'PACIENTE_EXISTENTE') {
        alert('Ya existe un paciente con este DNI');
      } else {
        alert('Error al crear paciente');
      }
    }
  };

  const handleDescargarHistorial = async (dni: string, nombre: string) => {
    try {
      setDescargandoHistorial(dni);
      const blob = await pacienteService.descargarHistorialClinico(dni, 'json');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historial_${dni}_${nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error al descargar historial:', error);
      alert('Error al descargar historial');
    } finally {
      setDescargandoHistorial(null);
    }
  };

  const pacientesFiltrados = pacientes.filter(paciente =>
    paciente.DNI.includes(searchTerm) ||
    paciente.NOMBRE_APELLIDO.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatearFecha = (fechaString: string) => {
    if (!fechaString) return 'No registrada';
    try {
      return new Date(fechaString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Gestión de Pacientes</h1>
        <p className="text-gray-600 mt-2">Administre la información de los pacientes del sistema</p>
      </div>

      {/* Barra de búsqueda y acciones */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por DNI o nombre..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && buscarPacientes()}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={buscarPacientes}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
            >
              <Search size={20} />
              Buscar
            </button>
            <button
              onClick={() => setShowNuevoModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <UserPlus size={20} />
              Nuevo Paciente
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de pacientes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <UserPlus className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-700">No hay pacientes</h3>
            <p className="text-gray-500 mt-1">Comience agregando un nuevo paciente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    DNI
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Contacto
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Edad/Sexo
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Última Consulta
                  </th>
                  <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pacientesFiltrados.map((paciente) => (
                  <tr key={paciente.ID_FICHA_CLINICA} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 font-mono">{paciente.DNI}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{paciente.NOMBRE_APELLIDO}</div>
                      <div className="text-xs text-gray-500 truncate max-w-[150px] md:max-w-none">
                        {paciente.EMAIL || 'Sin email'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-2 text-sm text-gray-900">
                        {paciente.TELEFONO && <Phone size={14} />}
                        {paciente.TELEFONO || 'Sin teléfono'}
                      </div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">
                        {paciente.DOMICILIO || 'Sin domicilio'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {paciente.EDAD || 'N/A'} años
                      </div>
                      <div className="text-xs text-gray-500">
                        {paciente.SEXO === 'M' ? 'Masculino' : 
                         paciente.SEXO === 'F' ? 'Femenino' : 'No especificado'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                      <div className="text-sm text-gray-900 flex items-center gap-1">
                        <Calendar size={14} />
                        {paciente.FECHA ? formatearFecha(paciente.FECHA) : 'Sin consultas'}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex flex-col md:flex-row gap-2">
                        <button
                          onClick={() => handleVerDetalle(paciente)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1 text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={14} />
                          <span className="hidden sm:inline">Ver</span>
                        </button>
                        <Link
                          to={`/pacientes/editar/${paciente.DNI}`}
                          className="text-yellow-600 hover:text-yellow-900 flex items-center gap-1 text-sm px-2 py-1 rounded hover:bg-yellow-50 transition-colors"
                          title="Editar"
                        >
                          <Edit size={14} />
                          <span className="hidden sm:inline">Editar</span>
                        </Link>
                        <button
                          onClick={() => handleDescargarHistorial(paciente.DNI, paciente.NOMBRE_APELLIDO)}
                          disabled={descargandoHistorial === paciente.DNI}
                          className={`flex items-center gap-1 text-sm px-2 py-1 rounded transition-colors ${
                            descargandoHistorial === paciente.DNI
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                          }`}
                          title="Descargar historial"
                        >
                          <Download size={14} />
                          <span className="hidden sm:inline">
                            {descargandoHistorial === paciente.DNI ? 'Descargando...' : 'Historial'}
                          </span>
                        </button>
                        <Link
                          to={`/consultas/nueva/${paciente.ID_FICHA_CLINICA}`}
                          className="text-purple-600 hover:text-purple-900 flex items-center gap-1 text-sm px-2 py-1 rounded hover:bg-purple-50 transition-colors"
                          title="Nueva consulta"
                        >
                          <FileText size={14} />
                          <span className="hidden sm:inline">Consulta</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalle Paciente */}
      {detalleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Detalle del Paciente</h2>
                <button
                  onClick={() => setDetalleModal(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Información Personal */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <User size={20} />
                    Información Personal
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500 block">DNI</label>
                      <p className="font-medium font-mono">{detalleModal.paciente.DNI}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Nombre Completo</label>
                      <p className="font-medium">{detalleModal.paciente.NOMBRE_APELLIDO}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500 block">Fecha Nacimiento</label>
                        <p className="font-medium">
                          {detalleModal.paciente.FECHA_NACIMIENTO 
                            ? formatearFecha(detalleModal.paciente.FECHA_NACIMIENTO)
                            : 'No registrada'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500 block">Edad</label>
                        <p className="font-medium">{detalleModal.paciente.EDAD || 'N/A'} años</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Sexo</label>
                      <p className="font-medium">
                        {detalleModal.paciente.SEXO === 'M' ? 'Masculino' : 
                         detalleModal.paciente.SEXO === 'F' ? 'Femenino' : 'No especificado'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Información de Contacto */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <Phone size={20} />
                    Información de Contacto
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500 block">Teléfono</label>
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-gray-400" />
                        <p className="font-medium">{detalleModal.paciente.TELEFONO || 'No registrado'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Email</label>
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-gray-400" />
                        <p className="font-medium">{detalleModal.paciente.EMAIL || 'No registrado'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Domicilio</label>
                      <div className="flex items-center gap-2">
                        <Home size={16} className="text-gray-400" />
                        <p className="font-medium">{detalleModal.paciente.DOMICILIO || 'No registrado'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información Adicional */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-700 mb-4">Información Adicional</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500 block">Estado Civil</label>
                      <p className="font-medium">{detalleModal.paciente.ESTADO_CIVIL || 'No registrado'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Ocupación</label>
                      <div className="flex items-center gap-2">
                        <Briefcase size={16} className="text-gray-400" />
                        <p className="font-medium">{detalleModal.paciente.OCUPACION || 'No registrada'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Responsable</label>
                      <p className="font-medium">{detalleModal.paciente.RESPONSABLE || 'No registrado'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Institución</label>
                      <p className="font-medium">{detalleModal.paciente.INSTITUCION || 'No registrada'}</p>
                    </div>
                  </div>
                </div>

                {/* Estadísticas */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h3 className="font-semibold text-gray-700 mb-4">Estadísticas</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500 block">Total Consultas</label>
                      <p className="font-medium text-blue-600 text-xl">{detalleModal.totalConsultas}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Última Consulta</label>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-gray-400" />
                        <p className="font-medium">
                          {detalleModal.paciente.FECHA ? formatearFecha(detalleModal.paciente.FECHA) : 'Sin consultas'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500 block">Fecha Registro</label>
                      <p className="font-medium">
                        {detalleModal.paciente.FECHA ? formatearFecha(detalleModal.paciente.FECHA) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  onClick={() => setDetalleModal(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cerrar
                </button>
                <Link
                  to={`/consultas/nueva/${detalleModal.paciente.ID_FICHA_CLINICA}`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
                >
                  Nueva Consulta
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Paciente */}
      {showNuevoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">Nuevo Paciente</h2>
                <button
                  onClick={() => setShowNuevoModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* DNI y Nombre */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      DNI *
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      pattern="[0-9]*"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.dni}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, dni: e.target.value.replace(/\D/g, '')})}
                      placeholder="12345678"
                    />
                    <p className="text-xs text-gray-500 mt-1">8 dígitos sin puntos</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.nombreApellido}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, nombreApellido: e.target.value})}
                      placeholder="Juan Pérez"
                    />
                  </div>
                </div>

                {/* Datos Personales */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Nacimiento
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.fechaNacimiento}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, fechaNacimiento: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Edad
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="150"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.edad}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, edad: e.target.value})}
                      placeholder="30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sexo
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.sexo}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, sexo: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                    </select>
                  </div>
                </div>

                {/* Contacto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.telefono}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, telefono: e.target.value})}
                      placeholder="+51 123 456 789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.email}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, email: e.target.value})}
                      placeholder="paciente@email.com"
                    />
                  </div>
                </div>

                {/* Domicilio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Domicilio
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={nuevoPaciente.domicilio}
                    onChange={(e) => setNuevoPaciente({...nuevoPaciente, domicilio: e.target.value})}
                    placeholder="Av. Principal 123, Ciudad"
                  />
                </div>

                {/* Estado Civil y Ocupación */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estado Civil
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.estadoCivil}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, estadoCivil: e.target.value})}
                    >
                      <option value="">Seleccionar</option>
                      <option value="Soltero">Soltero</option>
                      <option value="Casado">Casado</option>
                      <option value="Divorciado">Divorciado</option>
                      <option value="Viudo">Viudo</option>
                      <option value="Conviviente">Conviviente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ocupación
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={nuevoPaciente.ocupacion}
                      onChange={(e) => setNuevoPaciente({...nuevoPaciente, ocupacion: e.target.value})}
                      placeholder="Profesión o trabajo"
                    />
                  </div>
                </div>

                {/* Responsable */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Responsable (opcional)
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={nuevoPaciente.responsable}
                    onChange={(e) => setNuevoPaciente({...nuevoPaciente, responsable: e.target.value})}
                    placeholder="Nombre del familiar o tutor"
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  onClick={() => setShowNuevoModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCrearPaciente}
                  disabled={!nuevoPaciente.dni || !nuevoPaciente.nombreApellido}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    !nuevoPaciente.dni || !nuevoPaciente.nombreApellido
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Guardar Paciente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pacientes;