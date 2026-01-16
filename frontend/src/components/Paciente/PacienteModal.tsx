// components/Paciente/PacienteModal.tsx
import React, { useState, useEffect } from 'react';
import type { Paciente } from '../../types/models';
import '../../styles/paciente.css';

interface PacienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pacienteData: Partial<Paciente>) => Promise<void>;
  pacienteExistente?: Paciente | null;
  loading?: boolean;
}

const PacienteModal: React.FC<PacienteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  pacienteExistente,
  loading = false
}) => {
  const [formData, setFormData] = useState<Partial<Paciente>>({
    DNI: '',
    NOMBRE_APELLIDO: '',
    FECHA_NACIMIENTO: '',
    EDAD: undefined,
    SEXO: undefined,
    ESTADO_CIVIL: undefined,
    OCUPACION: '',
    DOMICILIO: '',
    TELEFONO: '',
    EMAIL: '',
    RAZA: '',
    NACIMIENTO: '',
    PROCEDENCIA: '',
    RESPONSABLE: '',
    INSTITUCION: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (pacienteExistente) {
      setFormData({
        DNI: pacienteExistente.DNI || '',
        NOMBRE_APELLIDO: pacienteExistente.NOMBRE_APELLIDO || '',
        FECHA_NACIMIENTO: pacienteExistente.FECHA_NACIMIENTO || '',
        EDAD: pacienteExistente.EDAD || undefined,
        SEXO: pacienteExistente.SEXO || undefined,
        ESTADO_CIVIL: pacienteExistente.ESTADO_CIVIL || undefined,
        OCUPACION: pacienteExistente.OCUPACION || '',
        DOMICILIO: pacienteExistente.DOMICILIO || '',
        TELEFONO: pacienteExistente.TELEFONO || '',
        EMAIL: pacienteExistente.EMAIL || '',
        RAZA: pacienteExistente.RAZA || '',
        NACIMIENTO: pacienteExistente.NACIMIENTO || '',
        PROCEDENCIA: pacienteExistente.PROCEDENCIA || '',
        RESPONSABLE: pacienteExistente.RESPONSABLE || '',
        INSTITUCION: pacienteExistente.INSTITUCION || ''
      });
    } else {
      setFormData({
        DNI: '',
        NOMBRE_APELLIDO: '',
        FECHA_NACIMIENTO: '',
        EDAD: undefined,
        SEXO: undefined,
        ESTADO_CIVIL: undefined,
        OCUPACION: '',
        DOMICILIO: '',
        TELEFONO: '',
        EMAIL: '',
        RAZA: '',
        NACIMIENTO: '',
        PROCEDENCIA: '',
        RESPONSABLE: '',
        INSTITUCION: ''
      });
    }
    setErrors({});
  }, [pacienteExistente, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar DNI
    if (!formData.DNI || !/^\d{8}$/.test(formData.DNI)) {
      newErrors.DNI = 'El DNI debe tener 8 dígitos numéricos';
    }

    // Validar nombre
    if (!formData.NOMBRE_APELLIDO || formData.NOMBRE_APELLIDO.trim().length < 3) {
      newErrors.NOMBRE_APELLIDO = 'El nombre y apellido son obligatorios (mínimo 3 caracteres)';
    }

    // Validar email si existe
    if (formData.EMAIL && !/\S+@\S+\.\S+/.test(formData.EMAIL)) {
      newErrors.EMAIL = 'Formato de email inválido';
    }

    // Validar teléfono si existe
    if (formData.TELEFONO && !/^\d{9}$/.test(formData.TELEFONO)) {
      newErrors.TELEFONO = 'El teléfono debe tener 9 dígitos';
    }

    // Validar fecha de nacimiento
    if (formData.FECHA_NACIMIENTO) {
      const fechaNac = new Date(formData.FECHA_NACIMIENTO);
      const hoy = new Date();
      if (fechaNac > hoy) {
        newErrors.FECHA_NACIMIENTO = 'La fecha de nacimiento no puede ser futura';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error al guardar paciente:', error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void => {
    const { name, value, type } = e.target;
    
    let processedValue: string | number | undefined = value;
    
    if (type === 'number') {
      processedValue = value === '' ? undefined : parseInt(value, 10);
    } else if (name === 'EDAD') {
      processedValue = value === '' ? undefined : parseInt(value, 10);
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFechaNacimientoChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const fechaNac = e.target.value;
    setFormData(prev => ({
      ...prev,
      FECHA_NACIMIENTO: fechaNac
    }));

    // Calcular edad automáticamente
    if (fechaNac) {
      const fechaNacDate = new Date(fechaNac);
      const hoy = new Date();
      let edad = hoy.getFullYear() - fechaNacDate.getFullYear();
      const mes = hoy.getMonth() - fechaNacDate.getMonth();
      
      if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNacDate.getDate())) {
        edad--;
      }
      
      setFormData(prev => ({
        ...prev,
        EDAD: edad > 0 ? edad : undefined
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        EDAD: undefined
      }));
    }

    if (errors.FECHA_NACIMIENTO) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.FECHA_NACIMIENTO;
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  const hoy = new Date().toISOString().split('T')[0];
  const esEdicion = !!pacienteExistente;

  return (
    <div className="modal-overlay">
      <div className="paciente-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {esEdicion ? 'Editar Paciente' : 'Registrar Nuevo Paciente'}
          </h2>
          <button
            onClick={onClose}
            className="modal-close"
            disabled={loading}
            type="button"
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" noValidate>
          <div className="form-grid">
            {/* Sección 1: Datos Personales */}
            <div className="form-section">
              <h3 className="section-title">Datos Personales</h3>
              
              <div className="form-group">
                <label htmlFor="DNI" className="form-label">
                  DNI *
                </label>
                <input
                  id="DNI"
                  name="DNI"
                  type="text"
                  value={formData.DNI || ''}
                  onChange={handleChange}
                  className={`form-input ${errors.DNI ? 'error' : ''}`}
                  placeholder="Ingrese DNI (8 dígitos)"
                  maxLength={8}
                  pattern="\d{8}"
                  disabled={esEdicion || loading}
                  required
                />
                {errors.DNI && (
                  <span className="form-error">{errors.DNI}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="NOMBRE_APELLIDO" className="form-label">
                  Nombre y Apellido *
                </label>
                <input
                  id="NOMBRE_APELLIDO"
                  name="NOMBRE_APELLIDO"
                  type="text"
                  value={formData.NOMBRE_APELLIDO || ''}
                  onChange={handleChange}
                  className={`form-input ${errors.NOMBRE_APELLIDO ? 'error' : ''}`}
                  placeholder="Nombre completo del paciente"
                  minLength={3}
                  required
                  disabled={loading}
                />
                {errors.NOMBRE_APELLIDO && (
                  <span className="form-error">{errors.NOMBRE_APELLIDO}</span>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="FECHA_NACIMIENTO" className="form-label">
                    Fecha de Nacimiento
                  </label>
                  <input
                    id="FECHA_NACIMIENTO"
                    name="FECHA_NACIMIENTO"
                    type="date"
                    value={formData.FECHA_NACIMIENTO || ''}
                    onChange={handleFechaNacimientoChange}
                    className={`form-input ${errors.FECHA_NACIMIENTO ? 'error' : ''}`}
                    max={hoy}
                    disabled={loading}
                  />
                  {errors.FECHA_NACIMIENTO && (
                    <span className="form-error">{errors.FECHA_NACIMIENTO}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="EDAD" className="form-label">
                    Edad
                  </label>
                  <input
                    id="EDAD"
                    name="EDAD"
                    type="number"
                    value={formData.EDAD || ''}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Edad"
                    min={0}
                    max={150}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="SEXO" className="form-label">
                    Sexo
                  </label>
                  <select
                    id="SEXO"
                    name="SEXO"
                    value={formData.SEXO || ''}
                    onChange={handleChange}
                    className="form-input"
                    disabled={loading}
                  >
                    <option value="">Seleccionar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="ESTADO_CIVIL" className="form-label">
                    Estado Civil
                  </label>
                  <select
                    id="ESTADO_CIVIL"
                    name="ESTADO_CIVIL"
                    value={formData.ESTADO_CIVIL || ''}
                    onChange={handleChange}
                    className="form-input"
                    disabled={loading}
                  >
                    <option value="">Seleccionar</option>
                    <option value="Soltero">Soltero</option>
                    <option value="Casado">Casado</option>
                    <option value="Divorciado">Divorciado</option>
                    <option value="Viudo">Viudo</option>
                    <option value="Conviviente">Conviviente</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sección 2: Información de Contacto */}
            <div className="form-section">
              <h3 className="section-title">Información de Contacto</h3>
              
              <div className="form-group">
                <label htmlFor="DOMICILIO" className="form-label">
                  Domicilio
                </label>
                <textarea
                  id="DOMICILIO"
                  name="DOMICILIO"
                  value={formData.DOMICILIO || ''}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Dirección completa"
                  rows={3}
                  disabled={loading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="TELEFONO" className="form-label">
                    Teléfono
                  </label>
                  <input
                    id="TELEFONO"
                    name="TELEFONO"
                    type="tel"
                    value={formData.TELEFONO || ''}
                    onChange={handleChange}
                    className={`form-input ${errors.TELEFONO ? 'error' : ''}`}
                    placeholder="987654321"
                    pattern="\d{9}"
                    disabled={loading}
                  />
                  {errors.TELEFONO && (
                    <span className="form-error">{errors.TELEFONO}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="EMAIL" className="form-label">
                    Email
                  </label>
                  <input
                    id="EMAIL"
                    name="EMAIL"
                    type="email"
                    value={formData.EMAIL || ''}
                    onChange={handleChange}
                    className={`form-input ${errors.EMAIL ? 'error' : ''}`}
                    placeholder="paciente@email.com"
                    disabled={loading}
                  />
                  {errors.EMAIL && (
                    <span className="form-error">{errors.EMAIL}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Sección 3: Información Adicional */}
            <div className="form-section">
              <h3 className="section-title">Información Adicional</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="OCUPACION" className="form-label">
                    Ocupación
                  </label>
                  <input
                    id="OCUPACION"
                    name="OCUPACION"
                    type="text"
                    value={formData.OCUPACION || ''}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Profesión u oficio"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="RAZA" className="form-label">
                    Raza/Etnia
                  </label>
                  <input
                    id="RAZA"
                    name="RAZA"
                    type="text"
                    value={formData.RAZA || ''}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Raza o etnia"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="NACIMIENTO" className="form-label">
                    Lugar de Nacimiento
                  </label>
                  <input
                    id="NACIMIENTO"
                    name="NACIMIENTO"
                    type="text"
                    value={formData.NACIMIENTO || ''}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Ciudad de nacimiento"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="PROCEDENCIA" className="form-label">
                    Procedencia
                  </label>
                  <input
                    id="PROCEDENCIA"
                    name="PROCEDENCIA"
                    type="text"
                    value={formData.PROCEDENCIA || ''}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Lugar de procedencia"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="RESPONSABLE" className="form-label">
                    Responsable
                  </label>
                  <input
                    id="RESPONSABLE"
                    name="RESPONSABLE"
                    type="text"
                    value={formData.RESPONSABLE || ''}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Familiar o tutor responsable"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="INSTITUCION" className="form-label">
                    Institución
                  </label>
                  <input
                    id="INSTITUCION"
                    name="INSTITUCION"
                    type="text"
                    value={formData.INSTITUCION || ''}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Institución de referencia"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Guardando...
                </>
              ) : esEdicion ? (
                'Actualizar Paciente'
              ) : (
                'Registrar Paciente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PacienteModal;