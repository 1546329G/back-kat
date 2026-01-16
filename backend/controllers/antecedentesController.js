const { getPool } = require("../config/db");
const { logActivity } = require("../utils/logActivity");
const { 
    verificarPaciente, 
    verificarEsPrimeraConsulta,
    errorResponse, 
    successResponse,
    convertToBoolean 
} = require("../utils/sharedUtils");

exports.checkPrimeraConsulta = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const idFichaClinica = pacienteRows[0].ID_FICHA_CLINICA;
        const nombrePaciente = pacienteRows[0].NOMBRE_APELLIDO;

        // Verificar si tiene antecedentes registrados
        const [antecedentesRows] = await pool.execute(
            "SELECT ID_ANTECEDENTE FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?",
            [idFichaClinica]
        );

        const esPrimeraConsulta = await verificarEsPrimeraConsulta(pool, idFichaClinica);
        const tieneAntecedentes = antecedentesRows.length > 0;
        const mostrarAntecedentes = esPrimeraConsulta && !tieneAntecedentes;

        // Obtener última consulta si existe
        const [consultasRows] = await pool.execute(
            "SELECT ID_CONSULTA, ES_PRIMERA_CONSULTA FROM CONSULTA WHERE ID_FICHA_CLINICA = ? ORDER BY FECHA DESC LIMIT 1",
            [idFichaClinica]
        );

        const ultimaConsulta = consultasRows.length > 0 ? consultasRows[0] : null;

        return successResponse(res, "Estado de consulta verificado exitosamente", {
            esPrimeraConsulta,
            mostrarAntecedentes,
            tieneAntecedentes,
            totalConsultas: consultasRows.length,
            idFichaClinica,
            nombrePaciente,
            ultimaConsulta: ultimaConsulta ? {
                idConsulta: ultimaConsulta.ID_CONSULTA,
                esPrimeraConsulta: ultimaConsulta.ES_PRIMERA_CONSULTA === 1
            } : null
        });

    } catch (error) {
        console.error("Error al verificar primera consulta:", error);
        return errorResponse(res, 500, "ERROR_VERIFICAR_CONSULTA", "Error interno del servidor al verificar estado de consulta");
    }
};

exports.crearAntecedentesCompletos = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;
    const antecedentesData = req.body;

    if (!antecedentesData || Object.keys(antecedentesData).length === 0) {
        return errorResponse(res, 400, "DATOS_REQUERIDOS", "Datos de antecedentes son requeridos");
    }

    // Validar datos antes de procesar
    const validationErrors = this.validarDatosAntecedentes(antecedentesData);
    if (validationErrors.length > 0) {
        return errorResponse(res, 400, "ERROR_VALIDACION", "Errores de validación en los datos de antecedentes", validationErrors);
    }

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const idFichaClinica = pacienteRows[0].ID_FICHA_CLINICA;
        const nombrePaciente = pacienteRows[0].NOMBRE_APELLIDO;

        // Verificar si ya tiene consultas
        const esPrimeraConsulta = await verificarEsPrimeraConsulta(pool, idFichaClinica);
        if (!esPrimeraConsulta) {
            return errorResponse(res, 400, "CONSULTAS_EXISTENTES", "No se pueden registrar antecedentes. El paciente ya tiene consultas previas");
        }

        // Verificar si ya tiene antecedentes
        const [antecedentesExistente] = await pool.execute(
            "SELECT ID_ANTECEDENTE FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?",
            [idFichaClinica]
        );

        if (antecedentesExistente.length > 0) {
            return errorResponse(res, 409, "ANTECEDENTES_EXISTENTES", "El paciente ya tiene antecedentes registrados", {
                idAntecedentes: antecedentesExistente[0].ID_ANTECEDENTE
            });
        }

        // Extraer datos por sección
        const enfermedadActual = antecedentesData.enfermedadActual || {};
        const sintomas = antecedentesData.sintomas || {};
        const cardiovascular = antecedentesData.cardiovascular || {};
        const patologicos = antecedentesData.patologicos || {};
        const factoresRiesgo = antecedentesData.factoresRiesgo || {};

        const [result] = await pool.execute(
            `INSERT INTO ANTECEDENTES (
                ID_FICHA_CLINICA,
                EA_TIEMPO, EA_INICIO, EA_CURSO, EA_RELATO,
                SX_ANGINA, SX_DISNEA, SX_PALPITACIONES, SX_SINCOPE, SX_CIANOSIS,
                SX_EDEMAS, SX_ORTOPNEA, SX_FIEBRE, SX_CLAUDICACION, SX_OTROS,
                CV_INFARTO, CV_VALVULOPATIA, CV_CARDIOPATIA_CONGENITA, CV_FIEBRE_REUMATICA,
                CV_ARRITMIAS, CV_ENF_ARTERIAL_PERIFERICA, CV_ULTIMA_HOSPITALIZACION,
                CV_DX_HOSPITALIZACION, CV_INTERVENCION_QUIRURGICA, CV_CATETERISMO, CV_MEDICACION_HABITUAL,
                AP_RESPIRATORIO, AP_GASTROINTESTINAL, AP_GENITOURINARIO, AP_NEUROLOGICO,
                AP_LOCOMOTOR, AP_HEMATOLOGICO, AP_ALERGIAS, AP_CIRUGIAS,
                FR_TABAQUISMO, FR_TABAQUISMO_DETALLE,
                FR_HIPERTENSION, FR_HIPERTENSION_DETALLE,
                FR_DIABETES, FR_DIABETES_DETALLE,
                FR_DISLIPIDEMIA, FR_DISLIPIDEMIA_DETALLE,
                FR_OBESIDAD, FR_OBESIDAD_DETALLE,
                FR_HISTORIA_FAMILIAR, FR_HISTORIA_FAMILIAR_DETALLE
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                idFichaClinica,
                // Enfermedad Actual
                enfermedadActual.tiempoEnfermedad?.substring(0, 100) || null,
                enfermedadActual.inicio?.substring(0, 255) || null,
                enfermedadActual.curso?.substring(0, 255) || null,
                enfermedadActual.relato?.substring(0, 1000) || null,
                // Síntomas
                convertToBoolean(sintomas.angina),
                convertToBoolean(sintomas.disnea),
                convertToBoolean(sintomas.palpitaciones),
                convertToBoolean(sintomas.sincope),
                convertToBoolean(sintomas.cianosos),
                convertToBoolean(sintomas.edemas),
                convertToBoolean(sintomas.ortopnea),
                convertToBoolean(sintomas.fiebre),
                convertToBoolean(sintomas.claudicacion),
                sintomas.otros?.substring(0, 500) || null,
                // Cardiovascular
                convertToBoolean(cardiovascular.infartoMiocardio),
                convertToBoolean(cardiovascular.valvulopatia),
                convertToBoolean(cardiovascular.cardiopatiaCongenita),
                convertToBoolean(cardiovascular.fiebreReumatica),
                convertToBoolean(cardiovascular.arritmias),
                convertToBoolean(cardiovascular.enfermedadArterialPeriferica),
                cardiovascular.ultimaHospitalizacion || null,
                cardiovascular.dxHospitalizacion?.substring(0, 255) || null,
                cardiovascular.intervencionQuirurgica?.substring(0, 255) || null,
                cardiovascular.cateterismo?.substring(0, 255) || null,
                cardiovascular.medicacionHabitual?.substring(0, 1000) || null,
                // Patológicos
                patologicos.respiratorio?.substring(0, 255) || null,
                patologicos.gastrointestinal?.substring(0, 255) || null,
                patologicos.genitourinario?.substring(0, 255) || null,
                patologicos.neurologico?.substring(0, 255) || null,
                patologicos.locomotor?.substring(0, 255) || null,
                patologicos.hematologico?.substring(0, 255) || null,
                patologicos.alergias?.substring(0, 255) || null,
                patologicos.cirugias?.substring(0, 255) || null,
                // Factores de Riesgo
                convertToBoolean(factoresRiesgo.tabaquismo),
                factoresRiesgo.tabaquismoDetalle?.substring(0, 500) || null,
                convertToBoolean(factoresRiesgo.hipertension),
                factoresRiesgo.hipertensionDetalle?.substring(0, 500) || null,
                convertToBoolean(factoresRiesgo.diabetes),
                factoresRiesgo.diabetesDetalle?.substring(0, 500) || null,
                convertToBoolean(factoresRiesgo.dislipidemia),
                factoresRiesgo.dislipidemiaDetalle?.substring(0, 500) || null,
                convertToBoolean(factoresRiesgo.obesidad),
                factoresRiesgo.obesidadDetalle?.substring(0, 500) || null,
                convertToBoolean(factoresRiesgo.historiaFamiliar),
                factoresRiesgo.historiaFamiliarDetalle?.substring(0, 500) || null
            ]
        );

        const idAntecedentes = result.insertId;

        await logActivity(req.user.dni, "ANTECEDENTES_COMPLETOS_CREATED", {
            idFichaClinica,
            idAntecedentes: idAntecedentes,
            paciente: nombrePaciente
        });

        return successResponse(res, "Antecedentes completos registrados exitosamente", {
            idAntecedentes: idAntecedentes,
            paciente: nombrePaciente,
            idFichaClinica: idFichaClinica
        }, {
            status: 201
        });

    } catch (error) {
        console.error("Error al registrar antecedentes:", error);
        return errorResponse(res, 500, "ERROR_REGISTRAR_ANTECEDENTES", "Error interno del servidor al registrar antecedentes");
    }
};

exports.obtenerAntecedentesCompletos = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const idFichaClinica = pacienteRows[0].ID_FICHA_CLINICA;
        const nombrePaciente = pacienteRows[0].NOMBRE_APELLIDO;

        const [antecedentesRows] = await pool.execute(
            `SELECT * FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?`,
            [idFichaClinica]
        );

        if (antecedentesRows.length === 0) {
            return successResponse(res, "No se encontraron antecedentes para este paciente", {
                antecedentes: null
            }, {
                idFichaClinica,
                nombrePaciente
            });
        }

        const antecedentes = antecedentesRows[0];

        // Formatear la respuesta según la nueva estructura
        const formattedData = {
            enfermedadActual: {
                tiempoEnfermedad: antecedentes.EA_TIEMPO,
                inicio: antecedentes.EA_INICIO,
                curso: antecedentes.EA_CURSO,
                relato: antecedentes.EA_RELATO
            },
            sintomas: {
                angina: convertToBoolean(antecedentes.SX_ANGINA),
                disnea: convertToBoolean(antecedentes.SX_DISNEA),
                palpitaciones: convertToBoolean(antecedentes.SX_PALPITACIONES),
                sincope: convertToBoolean(antecedentes.SX_SINCOPE),
                cianosos: convertToBoolean(antecedentes.SX_CIANOSIS),
                edemas: convertToBoolean(antecedentes.SX_EDEMAS),
                ortopnea: convertToBoolean(antecedentes.SX_ORTOPNEA),
                fiebre: convertToBoolean(antecedentes.SX_FIEBRE),
                claudicacion: convertToBoolean(antecedentes.SX_CLAUDICACION),
                otros: antecedentes.SX_OTROS
            },
            cardiovascular: {
                infartoMiocardio: convertToBoolean(antecedentes.CV_INFARTO),
                valvulopatia: convertToBoolean(antecedentes.CV_VALVULOPATIA),
                cardiopatiaCongenita: convertToBoolean(antecedentes.CV_CARDIOPATIA_CONGENITA),
                fiebreReumatica: convertToBoolean(antecedentes.CV_FIEBRE_REUMATICA),
                arritmias: convertToBoolean(antecedentes.CV_ARRITMIAS),
                enfermedadArterialPeriferica: convertToBoolean(antecedentes.CV_ENF_ARTERIAL_PERIFERICA),
                ultimaHospitalizacion: antecedentes.CV_ULTIMA_HOSPITALIZACION,
                dxHospitalizacion: antecedentes.CV_DX_HOSPITALIZACION,
                intervencionQuirurgica: antecedentes.CV_INTERVENCION_QUIRURGICA,
                cateterismo: antecedentes.CV_CATETERISMO,
                medicacionHabitual: antecedentes.CV_MEDICACION_HABITUAL
            },
            patologicos: {
                respiratorio: antecedentes.AP_RESPIRATORIO,
                gastrointestinal: antecedentes.AP_GASTROINTESTINAL,
                genitourinario: antecedentes.AP_GENITOURINARIO,
                neurologico: antecedentes.AP_NEUROLOGICO,
                locomotor: antecedentes.AP_LOCOMOTOR,
                hematologico: antecedentes.AP_HEMATOLOGICO,
                alergias: antecedentes.AP_ALERGIAS,
                cirugias: antecedentes.AP_CIRUGIAS
            },
            factoresRiesgo: {
                tabaquismo: convertToBoolean(antecedentes.FR_TABAQUISMO),
                tabaquismoDetalle: antecedentes.FR_TABAQUISMO_DETALLE,
                hipertension: convertToBoolean(antecedentes.FR_HIPERTENSION),
                hipertensionDetalle: antecedentes.FR_HIPERTENSION_DETALLE,
                diabetes: convertToBoolean(antecedentes.FR_DIABETES),
                diabetesDetalle: antecedentes.FR_DIABETES_DETALLE,
                dislipidemia: convertToBoolean(antecedentes.FR_DISLIPIDEMIA),
                dislipidemiaDetalle: antecedentes.FR_DISLIPIDEMIA_DETALLE,
                obesidad: convertToBoolean(antecedentes.FR_OBESIDAD),
                obesidadDetalle: antecedentes.FR_OBESIDAD_DETALLE,
                historiaFamiliar: convertToBoolean(antecedentes.FR_HISTORIA_FAMILIAR),
                historiaFamiliarDetalle: antecedentes.FR_HISTORIA_FAMILIAR_DETALLE
            }
        };

        return successResponse(res, "Antecedentes completos encontrados exitosamente", {
            data: formattedData,
            paciente: {
                idFichaClinica,
                nombre: nombrePaciente,
                dni: dni
            }
        });

    } catch (error) {
        console.error("Error al obtener antecedentes:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_ANTECEDENTES", "Error interno del servidor al obtener antecedentes");
    }
};

exports.actualizarAntecedentes = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;
    const antecedentesData = req.body;

    if (!antecedentesData || Object.keys(antecedentesData).length === 0) {
        return errorResponse(res, 400, "DATOS_REQUERIDOS", "Datos de actualización son requeridos");
    }

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const idFichaClinica = pacienteRows[0].ID_FICHA_CLINICA;
        const nombrePaciente = pacienteRows[0].NOMBRE_APELLIDO;

        // Verificar si existen antecedentes
        const [antecedentesExistente] = await pool.execute(
            "SELECT ID_ANTECEDENTE FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?",
            [idFichaClinica]
        );

        if (antecedentesExistente.length === 0) {
            return errorResponse(res, 404, "ANTECEDENTES_NO_ENCONTRADOS", "No se encontraron antecedentes para actualizar");
        }

        const idAntecedentes = antecedentesExistente[0].ID_ANTECEDENTE;

        // Construir dinámicamente la consulta UPDATE
        const updates = [];
        const values = [];

        // Función auxiliar para agregar campos
        const addField = (fieldName, value, maxLength = null) => {
            if (value !== undefined) {
                updates.push(`${fieldName} = ?`);
                values.push(maxLength ? (value?.substring(0, maxLength) || null) : value);
            }
        };

        // Extraer datos por sección
        const enfermedadActual = antecedentesData.enfermedadActual || {};
        const sintomas = antecedentesData.sintomas || {};
        const cardiovascular = antecedentesData.cardiovascular || {};
        const patologicos = antecedentesData.patologicos || {};
        const factoresRiesgo = antecedentesData.factoresRiesgo || {};

        // Enfermedad Actual
        addField('EA_TIEMPO', enfermedadActual.tiempoEnfermedad, 100);
        addField('EA_INICIO', enfermedadActual.inicio, 255);
        addField('EA_CURSO', enfermedadActual.curso, 255);
        addField('EA_RELATO', enfermedadActual.relato, 1000);

        // Síntomas
        addField('SX_ANGINA', sintomas.angina !== undefined ? convertToBoolean(sintomas.angina) : undefined);
        addField('SX_DISNEA', sintomas.disnea !== undefined ? convertToBoolean(sintomas.disnea) : undefined);
        addField('SX_PALPITACIONES', sintomas.palpitaciones !== undefined ? convertToBoolean(sintomas.palpitaciones) : undefined);
        addField('SX_SINCOPE', sintomas.sincope !== undefined ? convertToBoolean(sintomas.sincope) : undefined);
        addField('SX_CIANOSIS', sintomas.cianosos !== undefined ? convertToBoolean(sintomas.cianosos) : undefined);
        addField('SX_EDEMAS', sintomas.edemas !== undefined ? convertToBoolean(sintomas.edemas) : undefined);
        addField('SX_ORTOPNEA', sintomas.ortopnea !== undefined ? convertToBoolean(sintomas.ortopnea) : undefined);
        addField('SX_FIEBRE', sintomas.fiebre !== undefined ? convertToBoolean(sintomas.fiebre) : undefined);
        addField('SX_CLAUDICACION', sintomas.claudicacion !== undefined ? convertToBoolean(sintomas.claudicacion) : undefined);
        addField('SX_OTROS', sintomas.otros, 500);

        // Cardiovascular
        addField('CV_INFARTO', cardiovascular.infartoMiocardio !== undefined ? convertToBoolean(cardiovascular.infartoMiocardio) : undefined);
        addField('CV_VALVULOPATIA', cardiovascular.valvulopatia !== undefined ? convertToBoolean(cardiovascular.valvulopatia) : undefined);
        addField('CV_CARDIOPATIA_CONGENITA', cardiovascular.cardiopatiaCongenita !== undefined ? convertToBoolean(cardiovascular.cardiopatiaCongenita) : undefined);
        addField('CV_FIEBRE_REUMATICA', cardiovascular.fiebreReumatica !== undefined ? convertToBoolean(cardiovascular.fiebreReumatica) : undefined);
        addField('CV_ARRITMIAS', cardiovascular.arritmias !== undefined ? convertToBoolean(cardiovascular.arritmias) : undefined);
        addField('CV_ENF_ARTERIAL_PERIFERICA', cardiovascular.enfermedadArterialPeriferica !== undefined ? convertToBoolean(cardiovascular.enfermedadArterialPeriferica) : undefined);
        addField('CV_ULTIMA_HOSPITALIZACION', cardiovascular.ultimaHospitalizacion);
        addField('CV_DX_HOSPITALIZACION', cardiovascular.dxHospitalizacion, 255);
        addField('CV_INTERVENCION_QUIRURGICA', cardiovascular.intervencionQuirurgica, 255);
        addField('CV_CATETERISMO', cardiovascular.cateterismo, 255);
        addField('CV_MEDICACION_HABITUAL', cardiovascular.medicacionHabitual, 1000);

        // Patológicos
        addField('AP_RESPIRATORIO', patologicos.respiratorio, 255);
        addField('AP_GASTROINTESTINAL', patologicos.gastrointestinal, 255);
        addField('AP_GENITOURINARIO', patologicos.genitourinario, 255);
        addField('AP_NEUROLOGICO', patologicos.neurologico, 255);
        addField('AP_LOCOMOTOR', patologicos.locomotor, 255);
        addField('AP_HEMATOLOGICO', patologicos.hematologico, 255);
        addField('AP_ALERGIAS', patologicos.alergias, 255);
        addField('AP_CIRUGIAS', patologicos.cirugias, 255);

        // Factores de Riesgo
        addField('FR_TABAQUISMO', factoresRiesgo.tabaquismo !== undefined ? convertToBoolean(factoresRiesgo.tabaquismo) : undefined);
        addField('FR_TABAQUISMO_DETALLE', factoresRiesgo.tabaquismoDetalle, 500);
        addField('FR_HIPERTENSION', factoresRiesgo.hipertension !== undefined ? convertToBoolean(factoresRiesgo.hipertension) : undefined);
        addField('FR_HIPERTENSION_DETALLE', factoresRiesgo.hipertensionDetalle, 500);
        addField('FR_DIABETES', factoresRiesgo.diabetes !== undefined ? convertToBoolean(factoresRiesgo.diabetes) : undefined);
        addField('FR_DIABETES_DETALLE', factoresRiesgo.diabetesDetalle, 500);
        addField('FR_DISLIPIDEMIA', factoresRiesgo.dislipidemia !== undefined ? convertToBoolean(factoresRiesgo.dislipidemia) : undefined);
        addField('FR_DISLIPIDEMIA_DETALLE', factoresRiesgo.dislipidemiaDetalle, 500);
        addField('FR_OBESIDAD', factoresRiesgo.obesidad !== undefined ? convertToBoolean(factoresRiesgo.obesidad) : undefined);
        addField('FR_OBESIDAD_DETALLE', factoresRiesgo.obesidadDetalle, 500);
        addField('FR_HISTORIA_FAMILIAR', factoresRiesgo.historiaFamiliar !== undefined ? convertToBoolean(factoresRiesgo.historiaFamiliar) : undefined);
        addField('FR_HISTORIA_FAMILIAR_DETALLE', factoresRiesgo.historiaFamiliarDetalle, 500);

        if (updates.length === 0) {
            return errorResponse(res, 400, "SIN_DATOS_ACTUALIZACION", "No se proporcionaron datos válidos para actualizar");
        }

        values.push(idAntecedentes);

        const query = `UPDATE ANTECEDENTES SET ${updates.join(', ')} WHERE ID_ANTECEDENTE = ?`;

        const [result] = await pool.execute(query, values);

        await logActivity(req.user.dni, "ANTECEDENTES_UPDATED", {
            idFichaClinica,
            idAntecedentes: idAntecedentes,
            paciente: nombrePaciente
        });

        return successResponse(res, "Antecedentes actualizados exitosamente", {
            idAntecedentes,
            paciente: nombrePaciente,
            camposActualizados: updates.length
        });

    } catch (error) {
        console.error("Error al actualizar antecedentes:", error);
        return errorResponse(res, 500, "ERROR_ACTUALIZAR_ANTECEDENTES", "Error interno del servidor al actualizar antecedentes");
    }
};

exports.eliminarAntecedentes = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const idFichaClinica = pacienteRows[0].ID_FICHA_CLINICA;
        const nombrePaciente = pacienteRows[0].NOMBRE_APELLIDO;

        const [antecedentesExistente] = await pool.execute(
            "SELECT ID_ANTECEDENTE FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?",
            [idFichaClinica]
        );

        if (antecedentesExistente.length === 0) {
            return errorResponse(res, 404, "ANTECEDENTES_NO_ENCONTRADOS", "No se encontraron antecedentes para eliminar");
        }

        const idAntecedentes = antecedentesExistente[0].ID_ANTECEDENTE;

        // Verificar si el paciente tiene consultas
        const [consultasRows] = await pool.execute(
            "SELECT COUNT(*) as total FROM CONSULTA WHERE ID_FICHA_CLINICA = ?",
            [idFichaClinica]
        );

        if (consultasRows[0].total > 0) {
            return errorResponse(res, 400, "CONSULTAS_EXISTENTES", "No se pueden eliminar antecedentes porque el paciente tiene consultas registradas");
        }

        // Eliminar antecedentes
        const [result] = await pool.execute(
            "DELETE FROM ANTECEDENTES WHERE ID_ANTECEDENTE = ?",
            [idAntecedentes]
        );

        await logActivity(req.user.dni, "ANTECEDENTES_DELETED", {
            idFichaClinica,
            idAntecedentes: idAntecedentes,
            paciente: nombrePaciente
        });

        return successResponse(res, "Antecedentes eliminados exitosamente", {
            idAntecedentes,
            paciente: nombrePaciente
        });

    } catch (error) {
        console.error("Error al eliminar antecedentes:", error);
        return errorResponse(res, 500, "ERROR_ELIMINAR_ANTECEDENTES", "Error interno del servidor al eliminar antecedentes");
    }
};

exports.validarDatosAntecedentes = (antecedentesData) => {
    const errors = [];

    // Validar Enfermedad Actual
    if (antecedentesData.enfermedadActual) {
        const ea = antecedentesData.enfermedadActual;
        if (ea.tiempoEnfermedad && ea.tiempoEnfermedad.length > 100) {
            errors.push("Tiempo de enfermedad no puede exceder 100 caracteres");
        }
        if (ea.inicio && ea.inicio.length > 255) {
            errors.push("Inicio de enfermedad no puede exceder 255 caracteres");
        }
        if (ea.curso && ea.curso.length > 255) {
            errors.push("Curso de enfermedad no puede exceder 255 caracteres");
        }
        if (ea.relato && ea.relato.length > 1000) {
            errors.push("Relato de enfermedad no puede exceder 1000 caracteres");
        }
    }

    // Validar Síntomas
    if (antecedentesData.sintomas && antecedentesData.sintomas.otros) {
        if (antecedentesData.sintomas.otros.length > 500) {
            errors.push("Descripción de otros síntomas no puede exceder 500 caracteres");
        }
    }

    // Validar Cardiovascular
    if (antecedentesData.cardiovascular) {
        const cv = antecedentesData.cardiovascular;
        if (cv.dxHospitalizacion && cv.dxHospitalizacion.length > 255) {
            errors.push("Diagnóstico de hospitalización no puede exceder 255 caracteres");
        }
        if (cv.intervencionQuirurgica && cv.intervencionQuirurgica.length > 255) {
            errors.push("Intervención quirúrgica no puede exceder 255 caracteres");
        }
        if (cv.cateterismo && cv.cateterismo.length > 255) {
            errors.push("Cateterismo no puede exceder 255 caracteres");
        }
        if (cv.medicacionHabitual && cv.medicacionHabitual.length > 1000) {
            errors.push("Medicación habitual no puede exceder 1000 caracteres");
        }
    }

    // Validar Patológicos
    if (antecedentesData.patologicos) {
        const campos = ['respiratorio', 'gastrointestinal', 'genitourinario', 
                       'neurologico', 'locomotor', 'hematologico', 'alergias', 'cirugias'];
        
        campos.forEach(campo => {
            if (antecedentesData.patologicos[campo] && antecedentesData.patologicos[campo].length > 255) {
                errors.push(`${campo} no puede exceder 255 caracteres`);
            }
        });
    }

    // Validar Factores de Riesgo
    if (antecedentesData.factoresRiesgo) {
        const camposDetalle = ['tabaquismoDetalle', 'hipertensionDetalle', 'diabetesDetalle',
                              'dislipidemiaDetalle', 'obesidadDetalle', 'historiaFamiliarDetalle'];
        
        camposDetalle.forEach(campo => {
            if (antecedentesData.factoresRiesgo[campo] && antecedentesData.factoresRiesgo[campo].length > 500) {
                errors.push(`Detalle de ${campo} no puede exceder 500 caracteres`);
            }
        });
    }

    return errors;
};