const { getPool } = require('../config/db');
const { logActivity } = require('../utils/logActivity');
const { 
    verificarPacientePorId, 
    verificarSignosVitalesHoy, 
    verificarEsPrimeraConsulta,
    errorResponse,
    successResponse 
} = require('../utils/sharedUtils');

// Verificar requisitos antes de iniciar consulta
exports.verificarRequisitosConsulta = async (req, res) => {
    const pool = getPool();
    const { idFichaClinica } = req.params;
    
    try {
        // Verificar que el paciente existe
        const pacienteRows = await verificarPacientePorId(pool, idFichaClinica);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const signosRows = await verificarSignosVitalesHoy(pool, idFichaClinica);
        const esPrimeraConsulta = await verificarEsPrimeraConsulta(pool, idFichaClinica);
        
        let tieneAntecedentes = false;
        if (esPrimeraConsulta) {
            const [antecedentesRows] = await pool.execute(
                "SELECT ID_ANTECEDENTE FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?",
                [idFichaClinica]
            );
            tieneAntecedentes = antecedentesRows.length > 0;
        }
        
        const puedeContinuar = signosRows.length > 0 && (!esPrimeraConsulta || tieneAntecedentes);
        
        return successResponse(res, "Requisitos de consulta verificados", {
            requisitos: {
                signosVitales: {
                    requerido: true,
                    cumplido: signosRows.length > 0,
                    mensaje: signosRows.length > 0 
                        ? "✓ Signos vitales registrados" 
                        : "✗ Requiere signos vitales del día",
                    idExamenClinico: signosRows.length > 0 ? signosRows[0].ID_EXAMEN_CLINICO : null
                },
                antecedentes: {
                    requerido: esPrimeraConsulta,
                    cumplido: tieneAntecedentes || !esPrimeraConsulta,
                    mensaje: esPrimeraConsulta 
                        ? (tieneAntecedentes ? "✓ Antecedentes registrados" : "✗ Requiere antecedentes")
                        : "No requerido para consulta de control"
                }
            },
            puedeContinuar,
            esPrimeraConsulta,
            idFichaClinica
        }, {
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error al verificar requisitos:", error);
        return errorResponse(res, 500, "ERROR_VERIFICAR_REQUISITOS", "Error interno del servidor al verificar requisitos");
    }
};

// Iniciar nueva consulta
exports.iniciarConsulta = async (req, res) => {
    const pool = getPool();
    const { idFichaClinica, idCita } = req.body;
    
    try {
        // Verificar que el paciente existe
        const pacienteRows = await verificarPacientePorId(pool, idFichaClinica);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }
        
        const paciente = pacienteRows[0];
        
        // Verificar si es primera consulta
        const esPrimeraConsulta = await verificarEsPrimeraConsulta(pool, idFichaClinica);
        
        // Verificar signos vitales del día
        const signosRows = await verificarSignosVitalesHoy(pool, idFichaClinica);
        if (signosRows.length === 0) {
            return errorResponse(res, 400, "SIN_SIGNOS_VITALES", "No se pueden iniciar consultas sin signos vitales del día");
        }
        
        const idExamenClinico = signosRows[0].ID_EXAMEN_CLINICO;
        
        // Crear nueva consulta
        const [result] = await pool.execute(
            `INSERT INTO CONSULTA 
             (ID_FICHA_CLINICA, ID_USUARIO, ES_PRIMERA_CONSULTA, 
              FECHA, ESTADO, CREATED_AT)
             VALUES (?, ?, ?, NOW(), 'pendiente', NOW())`,
            [
                idFichaClinica,
                req.user.id,
                esPrimeraConsulta ? 1 : 0
            ]
        );
        
        const idConsulta = result.insertId;
        
        // Actualizar examen clínico con ID_CONSULTA
        await pool.execute(
            `UPDATE EXAMEN_CLINICO SET ID_CONSULTA = ? WHERE ID_EXAMEN_CLINICO = ?`,
            [idConsulta, idExamenClinico]
        );
        
        // Si viene de cita, actualizar estado
        if (idCita) {
            await pool.execute(
                "UPDATE CITAS SET ESTADO = 'EN CONSULTA' WHERE ID_CITAS = ?",
                [idCita]
            );
        }
        
        await logActivity(req.user.dni, "CONSULTA_INICIADA", {
            idConsulta: idConsulta,
            idFichaClinica: idFichaClinica,
            pacienteDni: paciente.DNI,
            esPrimeraConsulta: esPrimeraConsulta
        });
        
        return successResponse(res, "Consulta iniciada exitosamente", {
            idConsulta: idConsulta,
            idFichaClinica: idFichaClinica,
            paciente: paciente,
            esPrimeraConsulta: esPrimeraConsulta,
            fechaInicio: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error al iniciar consulta:", error);
        return errorResponse(res, 500, "ERROR_INICIAR_CONSULTA", "Error interno del servidor al iniciar consulta");
    }
};

// Obtener signos vitales de la consulta
exports.obtenerSignosVitales = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    
    try {
        const [signosRows] = await pool.execute(
            `SELECT 
                ec.*,
                DATE_FORMAT(ec.FECHA_REGISTRO, '%d/%m/%Y %H:%i') as FECHA_FORMATEADA
             FROM EXAMEN_CLINICO ec
             JOIN CONSULTA c ON ec.ID_CONSULTA = c.ID_CONSULTA
             WHERE ec.ID_CONSULTA = ?`,
            [idConsulta]
        );
        
        if (signosRows.length === 0) {
            return errorResponse(res, 404, "SIGNOS_VITALES_NO_ENCONTRADOS", "Signos vitales no encontrados para esta consulta");
        }
        
        return successResponse(res, "Signos vitales recuperados", {
            signosVitales: signosRows[0]
        }, {
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error al obtener signos vitales:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_SIGNOS_VITALES", "Error interno del servidor al obtener signos vitales");
    }
};

// Guardar relato de la consulta
exports.guardarRelato = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    const { relato } = req.body;
    
    try {
        // Verificar que la consulta existe
        const [consultaRows] = await pool.execute(
            `SELECT c.*, f.NOMBRE_APELLIDO 
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ? AND c.ID_USUARIO = ?`,
            [idConsulta, req.user.id]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada o no tiene permisos");
        }
        
        // Actualizar relato
        await pool.execute(
            `UPDATE CONSULTA SET 
                RELATO = ?,
                UPDATED_AT = NOW()
             WHERE ID_CONSULTA = ?`,
            [relato, idConsulta]
        );
        
        await logActivity(req.user.dni, "RELATO_GUARDADO", {
            idConsulta: idConsulta,
            paciente: consultaRows[0].NOMBRE_APELLIDO,
            tieneRelato: !!relato
        });
        
        return successResponse(res, "Relato guardado exitosamente", null, {
            paso: 'relato',
            siguientePaso: 'antecedentes',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error al guardar relato:", error);
        return errorResponse(res, 500, "ERROR_GUARDAR_RELATO", "Error interno del servidor al guardar relato");
    }
};

// Obtener antecedentes del paciente
exports.obtenerAntecedentes = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    
    try {
        // Obtener ID_FICHA_CLINICA desde la consulta
        const [consultaRows] = await pool.execute(
            `SELECT ID_FICHA_CLINICA FROM CONSULTA WHERE ID_CONSULTA = ?`,
            [idConsulta]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada");
        }
        
        const idFichaClinica = consultaRows[0].ID_FICHA_CLINICA;
        
        // Obtener antecedentes
        const [antecedentesRows] = await pool.execute(
            `SELECT * FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?`,
            [idFichaClinica]
        );
        
        const antecedentes = antecedentesRows.length > 0 ? antecedentesRows[0] : null;
        
        return successResponse(res, "Antecedentes recuperados", {
            antecedentes: antecedentes,
            existeAntecedentes: !!antecedentes
        }, {
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error al obtener antecedentes:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_ANTECEDENTES", "Error interno del servidor al obtener antecedentes");
    }
};

// Guardar examen físico
exports.guardarExamenFisico = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    const { tipo, datos } = req.body;
    
    try {
        // Verificar que la consulta existe
        const [consultaRows] = await pool.execute(
            `SELECT c.*, f.NOMBRE_APELLIDO 
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ? AND c.ID_USUARIO = ?`,
            [idConsulta, req.user.id]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada o no tiene permisos");
        }
        
        const consulta = consultaRows[0];
        const esPrimeraConsulta = consulta.ES_PRIMERA_CONSULTA === 1;
        
        // Validar tipo de examen según tipo de consulta
        if (esPrimeraConsulta && tipo !== 'detallado') {
            return errorResponse(res, 400, "EXAMEN_TIPO_INCORRECTO", "Primera consulta requiere examen físico detallado");
        }
        
        if (!esPrimeraConsulta && tipo !== 'simplificado') {
            return errorResponse(res, 400, "EXAMEN_TIPO_INCORRECTO", "Consulta de control requiere examen físico simplificado");
        }
        
        // Guardar según el tipo
        if (tipo === 'detallado') {
            await pool.execute(
                `UPDATE CONSULTA SET 
                    EXAMEN_FISICO_GENERAL = ?,
                    EXAMEN_FISICO_REGIONAL = ?,
                    EXAMEN_FISICO_CARDIOVASCULAR = ?,
                    EXAMEN_FISICO_ABDOMINAL = ?,
                    EXAMEN_FISICO_EXTREMIDADES = ?,
                    EXAMEN_FISICO_NEUROLOGICO = ?,
                    UPDATED_AT = NOW()
                 WHERE ID_CONSULTA = ?`,
                [
                    datos.general || null,
                    datos.regional || null,
                    datos.cardiovascular || null,
                    datos.abdominal || null,
                    datos.extremidades || null,
                    datos.neurologico || null,
                    idConsulta
                ]
            );
        } else {
            await pool.execute(
                `UPDATE CONSULTA SET 
                    EXAMEN_FISICO_SIMPLIFICADO = ?,
                    UPDATED_AT = NOW()
                 WHERE ID_CONSULTA = ?`,
                [datos.simplificado || null, idConsulta]
            );
        }
        
        await logActivity(req.user.dni, "EXAMEN_FISICO_GUARDADO", {
            idConsulta: idConsulta,
            tipo: tipo,
            paciente: consulta.NOMBRE_APELLIDO,
            esPrimeraConsulta: esPrimeraConsulta
        });
        
        return successResponse(res, `Examen físico ${tipo} guardado exitosamente`, null, {
            paso: 'examen_fisico',
            siguientePaso: 'diagnostico',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error al guardar examen físico:", error);
        return errorResponse(res, 500, "ERROR_GUARDAR_EXAMEN_FISICO", "Error interno del servidor al guardar examen físico");
    }
};

// Buscar diagnósticos CIE-10
exports.buscarDiagnosticos = async (req, res) => {
    const pool = getPool();
    const { query } = req.query;
    
    try {
        let diagnosticos;
        
        if (query) {
            [diagnosticos] = await pool.execute(
                `SELECT ID_CIE_10, CODIGO, DESCRIPCION, CAPITULO 
                 FROM CATALOGO_CIE10 
                 WHERE (CODIGO LIKE ? OR DESCRIPCION LIKE ?) 
                 AND ACTIVO = 1
                 ORDER BY CODIGO
                 LIMIT 50`,
                [`%${query}%`, `%${query}%`]
            );
        } else {
            [diagnosticos] = await pool.execute(
                `SELECT ID_CIE_10, CODIGO, DESCRIPCION, CAPITULO 
                 FROM CATALOGO_CIE10 
                 WHERE ACTIVO = 1
                 ORDER BY CODIGO
                 LIMIT 50`
            );
        }
        
        return successResponse(res, "Diagnósticos encontrados", {
            diagnosticos: diagnosticos,
            total: diagnosticos.length
        });
        
    } catch (error) {
        console.error("Error al buscar diagnósticos:", error);
        return errorResponse(res, 500, "ERROR_BUSCAR_DIAGNOSTICOS", "Error interno del servidor al buscar diagnósticos");
    }
};

// Agregar diagnóstico a la consulta
exports.agregarDiagnostico = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    const { idCie10, tipo, observaciones } = req.body;
    
    try {
        // Verificar que la consulta existe
        const [consultaRows] = await pool.execute(
            `SELECT c.*, f.NOMBRE_APELLIDO 
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ? AND c.ID_USUARIO = ?`,
            [idConsulta, req.user.id]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada o no tiene permisos");
        }
        
        // Verificar que el diagnóstico existe
        const [diagnosticoRows] = await pool.execute(
            `SELECT CODIGO, DESCRIPCION FROM CATALOGO_CIE10 WHERE ID_CIE_10 = ? AND ACTIVO = 1`,
            [idCie10]
        );
        
        if (diagnosticoRows.length === 0) {
            return errorResponse(res, 404, "DIAGNOSTICO_NO_ENCONTRADO", "Diagnóstico no encontrado");
        }
        
        const diagnostico = diagnosticoRows[0];
        
        // Verificar si ya existe el mismo diagnóstico en la consulta
        const [existenteRows] = await pool.execute(
            `SELECT * FROM DIAGNOSTICOS_CONSULTA 
             WHERE ID_CONSULTA = ? AND ID_CIE_10 = ?`,
            [idConsulta, idCie10]
        );
        
        if (existenteRows.length > 0) {
            return errorResponse(res, 400, "DIAGNOSTICO_DUPLICADO", "Este diagnóstico ya ha sido agregado a la consulta");
        }
        
        // Insertar diagnóstico
        const [result] = await pool.execute(
            `INSERT INTO DIAGNOSTICOS_CONSULTA 
             (ID_CONSULTA, ID_CIE_10, TIPO, OBSERVACIONES, CREATED_AT)
             VALUES (?, ?, ?, ?, NOW())`,
            [idConsulta, idCie10, tipo || 'principal', observaciones || null]
        );
        
        await logActivity(req.user.dni, "DIAGNOSTICO_AGREGADO", {
            idConsulta: idConsulta,
            idDiagnostico: result.insertId,
            codigo: diagnostico.CODIGO,
            descripcion: diagnostico.DESCRIPCION,
            tipo: tipo || 'principal',
            paciente: consultaRows[0].NOMBRE_APELLIDO
        });
        
        return successResponse(res, "Diagnóstico agregado exitosamente", {
            idDiagnosticoConsulta: result.insertId,
            idCie10: idCie10,
            codigo: diagnostico.CODIGO,
            descripcion: diagnostico.DESCRIPCION,
            tipo: tipo || 'principal',
            observaciones: observaciones || null
        }, {
            status: 201
        });
        
    } catch (error) {
        console.error("Error al agregar diagnóstico:", error);
        return errorResponse(res, 500, "ERROR_AGREGAR_DIAGNOSTICO", "Error interno del servidor al agregar diagnóstico");
    }
};

// Obtener diagnósticos de la consulta
exports.obtenerDiagnosticos = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    
    try {
        const [diagnosticosRows] = await pool.execute(
            `SELECT 
                dc.ID_DIAGNOSTICO_CONSULTA,
                dc.ID_CIE_10,
                dc.TIPO,
                dc.OBSERVACIONES,
                dc.CREATED_AT,
                c.CODIGO,
                c.DESCRIPCION,
                c.CAPITULO
             FROM DIAGNOSTICOS_CONSULTA dc
             JOIN CATALOGO_CIE10 c ON dc.ID_CIE_10 = c.ID_CIE_10
             WHERE dc.ID_CONSULTA = ?
             ORDER BY 
                 CASE dc.TIPO 
                     WHEN 'principal' THEN 1
                     WHEN 'secundario' THEN 2
                     WHEN 'comorbilidad' THEN 3
                     ELSE 4
                 END,
                 dc.CREATED_AT`,
            [idConsulta]
        );
        
        return successResponse(res, "Diagnósticos de consulta recuperados", {
            diagnosticos: diagnosticosRows,
            total: diagnosticosRows.length
        });
        
    } catch (error) {
        console.error("Error al obtener diagnósticos:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_DIAGNOSTICOS", "Error interno del servidor al obtener diagnósticos");
    }
};

// Eliminar diagnóstico de la consulta
exports.eliminarDiagnostico = async (req, res) => {
    const pool = getPool();
    const { idConsulta, idDiagnosticoConsulta } = req.params;
    
    try {
        // Verificar que el diagnóstico pertenece a la consulta
        const [diagnosticoRows] = await pool.execute(
            `SELECT dc.*, f.NOMBRE_APELLIDO, c.CODIGO, c.DESCRIPCION
             FROM DIAGNOSTICOS_CONSULTA dc
             JOIN CONSULTA co ON dc.ID_CONSULTA = co.ID_CONSULTA
             JOIN FICHA_CLINICA f ON co.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             JOIN CATALOGO_CIE10 c ON dc.ID_CIE_10 = c.ID_CIE_10
             WHERE dc.ID_DIAGNOSTICO_CONSULTA = ? AND dc.ID_CONSULTA = ?`,
            [idDiagnosticoConsulta, idConsulta]
        );
        
        if (diagnosticoRows.length === 0) {
            return errorResponse(res, 404, "DIAGNOSTICO_NO_ENCONTRADO", "Diagnóstico no encontrado o no pertenece a esta consulta");
        }
        
        const diagnostico = diagnosticoRows[0];
        
        // Eliminar diagnóstico
        await pool.execute(
            `DELETE FROM DIAGNOSTICOS_CONSULTA 
             WHERE ID_DIAGNOSTICO_CONSULTA = ?`,
            [idDiagnosticoConsulta]
        );
        
        await logActivity(req.user.dni, "DIAGNOSTICO_ELIMINADO", {
            idConsulta: idConsulta,
            idDiagnosticoConsulta: idDiagnosticoConsulta,
            codigo: diagnostico.CODIGO,
            descripcion: diagnostico.DESCRIPCION,
            paciente: diagnostico.NOMBRE_APELLIDO
        });
        
        return successResponse(res, "Diagnóstico eliminado exitosamente", {
            eliminado: true
        });
        
    } catch (error) {
        console.error("Error al eliminar diagnóstico:", error);
        return errorResponse(res, 500, "ERROR_ELIMINAR_DIAGNOSTICO", "Error interno del servidor al eliminar diagnóstico");
    }
};

// Guardar plan de trabajo
exports.guardarPlanTrabajo = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    const { planTrabajo } = req.body;
    
    try {
        // Verificar que la consulta existe
        const [consultaRows] = await pool.execute(
            `SELECT c.*, f.NOMBRE_APELLIDO 
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ? AND c.ID_USUARIO = ?`,
            [idConsulta, req.user.id]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada o no tiene permisos");
        }
        
        // Actualizar plan de trabajo
        await pool.execute(
            `UPDATE CONSULTA SET 
                PLAN_TRABAJO = ?,
                UPDATED_AT = NOW()
             WHERE ID_CONSULTA = ?`,
            [planTrabajo, idConsulta]
        );
        
        await logActivity(req.user.dni, "PLAN_TRABAJO_GUARDADO", {
            idConsulta: idConsulta,
            paciente: consultaRows[0].NOMBRE_APELLIDO,
            tienePlan: !!planTrabajo
        });
        
        return successResponse(res, "Plan de trabajo guardado exitosamente", null, {
            paso: 'plan_trabajo',
            siguientePaso: 'receta',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error al guardar plan de trabajo:", error);
        return errorResponse(res, 500, "ERROR_GUARDAR_PLAN_TRABAJO", "Error interno del servidor al guardar plan de trabajo");
    }
};

// Buscar medicamentos para receta
exports.buscarMedicamentos = async (req, res) => {
    const pool = getPool();
    const { query } = req.query;
    
    try {
        let medicamentos;
        
        if (query) {
            [medicamentos] = await pool.execute(
                `SELECT ID_MEDICAMENTO, NOMBRE, CONCENTRACION, FORMA_FARMACEUTICA 
                 FROM MEDICAMENTOS 
                 WHERE (NOMBRE LIKE ? OR CONCENTRACION LIKE ?) 
                 AND ACTIVO = 1
                 ORDER BY NOMBRE
                 LIMIT 50`,
                [`%${query}%`, `%${query}%`]
            );
        } else {
            [medicamentos] = await pool.execute(
                `SELECT ID_MEDICAMENTO, NOMBRE, CONCENTRACION, FORMA_FARMACEUTICA 
                 FROM MEDICAMENTOS 
                 WHERE ACTIVO = 1
                 ORDER BY NOMBRE
                 LIMIT 50`
            );
        }
        
        return successResponse(res, "Medicamentos encontrados", {
            medicamentos: medicamentos,
            total: medicamentos.length
        });
        
    } catch (error) {
        console.error("Error al buscar medicamentos:", error);
        return errorResponse(res, 500, "ERROR_BUSCAR_MEDICAMENTOS", "Error interno del servidor al buscar medicamentos");
    }
};

// Crear receta
exports.crearReceta = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    const { indicacionesGenerales, medicamentos } = req.body;
    
    try {
        // Verificar que la consulta existe
        const [consultaRows] = await pool.execute(
            `SELECT c.*, f.NOMBRE_APELLIDO, f.ID_FICHA_CLINICA 
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ? AND c.ID_USUARIO = ?`,
            [idConsulta, req.user.id]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada o no tiene permisos");
        }
        
        const consulta = consultaRows[0];
        
        // Crear receta principal
        const [recetaResult] = await pool.execute(
            `INSERT INTO RECETAS 
             (ID_CONSULTA, ID_FICHA_CLINICA, ID_USUARIO, 
              FECHA_EMISION, INDICACIONES_GENERALES)
             VALUES (?, ?, ?, NOW(), ?)`,
            [
                idConsulta,
                consulta.ID_FICHA_CLINICA,
                req.user.id,
                indicacionesGenerales || null
            ]
        );
        
        const idReceta = recetaResult.insertId;
        
        // Agregar medicamentos si existen
        if (medicamentos && Array.isArray(medicamentos) && medicamentos.length > 0) {
            for (const medicamento of medicamentos) {
                await pool.execute(
                    `INSERT INTO RECETA_DETALLE 
                     (ID_RECETA, ID_MEDICamento, DOSIS, FRECUENCIA, DURACION)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        idReceta,
                        medicamento.idMedicamento,
                        medicamento.dosis,
                        medicamento.frecuencia,
                        medicamento.duracion
                    ]
                );
            }
        }
        
        // Actualizar consulta con ID_RECETA
        await pool.execute(
            `UPDATE CONSULTA SET 
                ID_RECETA = ?,
                UPDATED_AT = NOW()
             WHERE ID_CONSULTA = ?`,
            [idReceta, idConsulta]
        );
        
        await logActivity(req.user.dni, "RECETA_CREADA", {
            idConsulta: idConsulta,
            idReceta: idReceta,
            paciente: consulta.NOMBRE_APELLIDO,
            totalMedicamentos: medicamentos ? medicamentos.length : 0
        });
        
        return successResponse(res, "Receta creada exitosamente", {
            idReceta: idReceta,
            idConsulta: idConsulta,
            fechaEmision: new Date().toISOString(),
            indicacionesGenerales: indicacionesGenerales,
            totalMedicamentos: medicamentos ? medicamentos.length : 0
        }, {
            status: 201
        });
        
    } catch (error) {
        console.error("Error al crear receta:", error);
        return errorResponse(res, 500, "ERROR_CREAR_RECETA", "Error interno del servidor al crear receta");
    }
};

// Obtener receta de la consulta
exports.obtenerReceta = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    
    try {
        // Obtener receta principal
        const [recetaRows] = await pool.execute(
            `SELECT 
                r.*,
                u.NOMBRE as DOCTOR_NOMBRE,
                u.APELLIDO as DOCTOR_APELLIDO,
                u.DNI as DOCTOR_DNI,
                u.FIRMA_DIGITAL,
                f.NOMBRE_APELLIDO as PACIENTE_NOMBRE,
                f.DNI as PACIENTE_DNI,
                f.FECHA_NACIMIENTO,
                f.EDAD,
                f.SEXO,
                f.DOMICILIO,
                f.TELEFONO
             FROM RECETAS r
             JOIN USUARIOS u ON r.ID_USUARIO = u.ID_USUARIO
             JOIN FICHA_CLINICA f ON r.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE r.ID_CONSULTA = ?`,
            [idConsulta]
        );
        
        if (recetaRows.length === 0) {
            return errorResponse(res, 404, "RECETA_NO_ENCONTRADA", "Receta no encontrada");
        }
        
        const receta = recetaRows[0];
        
        // Obtener detalles de medicamentos
        const [detalleRows] = await pool.execute(
            `SELECT 
                rd.*,
                m.NOMBRE as MEDICAMENTO_NOMBRE,
                m.CONCENTRACION,
                m.FORMA_FARMACEUTICA
             FROM RECETA_DETALLE rd
             JOIN MEDICAMENTOS m ON rd.ID_MEDICAMENTO = m.ID_MEDICAMENTO
             WHERE rd.ID_RECETA = ?
             ORDER BY rd.ID_DETALLE`,
            [receta.ID_RECETA]
        );
        
        receta.medicamentos = detalleRows;
        
        return successResponse(res, "Receta recuperada", {
            receta: receta,
            puedeImprimir: true
        });
        
    } catch (error) {
        console.error("Error al obtener receta:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_RECETA", "Error interno del servidor al obtener receta");
    }
};

// Finalizar consulta
exports.finalizarConsulta = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    
    try {
        // Verificar que la consulta existe y está pendiente
        const [consultaRows] = await pool.execute(
            `SELECT 
                c.*,
                f.NOMBRE_APELLIDO,
                (SELECT COUNT(*) FROM DIAGNOSTICOS_CONSULTA dc WHERE dc.ID_CONSULTA = c.ID_CONSULTA) as TOTAL_DIAGNOSTICOS
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ? AND c.ID_USUARIO = ? AND c.ESTADO = 'pendiente'`,
            [idConsulta, req.user.id]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada, no tiene permisos o ya está finalizada");
        }
        
        const consulta = consultaRows[0];
        
        // Validar campos obligatorios
        const errores = [];
        
        if (!consulta.RELATO) errores.push("Relato no completado");
        
        const tieneExamenFisico = consulta.EXAMEN_FISICO_SIMPLIFICADO || 
                                 (consulta.EXAMEN_FISICO_GENERAL && consulta.EXAMEN_FISICO_REGIONAL);
        if (!tieneExamenFisico) errores.push("Examen físico no completado");
        
        if (!consulta.PLAN_TRABAJO) errores.push("Plan de trabajo no completado");
        
        if (consulta.TOTAL_DIAGNOSTICOS === 0) errores.push("Debe agregar al menos un diagnóstico");
        
        const tieneReceta = consulta.ID_RECETA !== null;
        
        if (errores.length > 0) {
            return errorResponse(res, 400, "CONSULTA_INCOMPLETA", "No se puede finalizar la consulta", errores);
        }
        
        // Actualizar estado de la consulta
        await pool.execute(
            `UPDATE CONSULTA SET 
                ESTADO = 'completada',
                UPDATED_AT = NOW()
             WHERE ID_CONSULTA = ?`,
            [idConsulta]
        );
        
        // Si viene de cita, actualizar estado de la cita
        if (consulta.ID_CITA) {
            await pool.execute(
                "UPDATE CITAS SET ESTADO = 'ATENDIDA' WHERE ID_CITAS = ?",
                [consulta.ID_CITA]
            );
        }
        
        // Log de actividad
        await logActivity(req.user.dni, "CONSULTA_FINALIZADA", {
            idConsulta: idConsulta,
            paciente: consulta.NOMBRE_APELLIDO,
            esPrimeraConsulta: consulta.ES_PRIMERA_CONSULTA === 1,
            totalDiagnosticos: consulta.TOTAL_DIAGNOSTICOS,
            tieneReceta: tieneReceta,
            duracion: consulta.FECHA ? 
                Math.round((new Date() - new Date(consulta.FECHA)) / (1000 * 60)) : null
        });
        
        return successResponse(res, "Consulta finalizada exitosamente", {
            consultaFinalizada: true,
            idConsulta: idConsulta,
            paciente: consulta.NOMBRE_APELLIDO,
            esPrimeraConsulta: consulta.ES_PRIMERA_CONSULTA === 1,
            fechaFinalizacion: new Date().toISOString(),
            tieneReceta: tieneReceta
        });
        
    } catch (error) {
        console.error("Error al finalizar consulta:", error);
        return errorResponse(res, 500, "ERROR_FINALIZAR_CONSULTA", "Error interno del servidor al finalizar consulta");
    }
};

// Obtener estado completo de la consulta
exports.obtenerEstadoConsulta = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    
    try {
        const [consultaRows] = await pool.execute(
            `SELECT 
                c.*,
                f.*,
                u.NOMBRE as DOCTOR_NOMBRE,
                u.APELLIDO as DOCTOR_APELLIDO,
                ec.*,
                DATE_FORMAT(ec.FECHA_REGISTRO, '%d/%m/%Y %H:%i') as FECHA_SIGNOS_FORMATEADA
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             JOIN USUARIOS u ON c.ID_USUARIO = u.ID_USUARIO
             LEFT JOIN EXAMEN_CLINICO ec ON c.ID_CONSULTA = ec.ID_CONSULTA
             WHERE c.ID_CONSULTA = ?`,
            [idConsulta]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada");
        }
        
        const consulta = consultaRows[0];
        const esPrimeraConsulta = consulta.ES_PRIMERA_CONSULTA === 1;
        
        // Obtener datos adicionales en paralelo
        const [
            diagnosticosRows,
            recetaRows,
            antecedentesRows,
            examenesAuxRows
        ] = await Promise.all([
            pool.execute(`SELECT COUNT(*) as total FROM DIAGNOSTICOS_CONSULTA WHERE ID_CONSULTA = ?`, [idConsulta]),
            pool.execute(`SELECT COUNT(*) as total FROM RECETAS WHERE ID_CONSULTA = ?`, [idConsulta]),
            pool.execute(`SELECT COUNT(*) as total FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?`, [consulta.ID_FICHA_CLINICA]),
            pool.execute(`SELECT COUNT(*) as total FROM EXAMENES_AUXILIARES WHERE ID_CONSULTA = ?`, [idConsulta])
        ]);
        
        // Determinar progreso
        const pasosCompletados = [];
        if (consulta.RELATO) pasosCompletados.push('relato');
        if (consulta.EXAMEN_FISICO_SIMPLIFICADO || consulta.EXAMEN_FISICO_GENERAL) pasosCompletados.push('examen_fisico');
        if (consulta.PLAN_TRABAJO) pasosCompletados.push('plan_trabajo');
        if (diagnosticosRows[0][0].total > 0) pasosCompletados.push('diagnostico');
        if (recetaRows[0][0].total > 0) pasosCompletados.push('receta');
        
        // Flujo completo
        const flujo = ['signos_vitales', 'relato', 'antecedentes', 'examen_fisico', 'diagnostico', 'plan_trabajo', 'receta'];
        const progreso = Math.round((pasosCompletados.length / flujo.length) * 100);
        
        return successResponse(res, "Estado de consulta recuperado", {
            consulta: {
                ...consulta,
                ES_PRIMERA_CONSULTA: esPrimeraConsulta
            },
            progreso: {
                porcentaje: progreso,
                pasosCompletados: pasosCompletados,
                totalPasos: flujo.length,
                faltantes: flujo.filter(paso => !pasosCompletados.includes(paso))
            },
            resumen: {
                tieneSignosVitales: !!consulta.ID_EXAMEN_CLINICO,
                tieneRelato: !!consulta.RELATO,
                tieneAntecedentes: antecedentesRows[0][0].total > 0,
                tieneExamenFisico: !!(consulta.EXAMEN_FISICO_SIMPLIFICADO || consulta.EXAMEN_FISICO_GENERAL),
                tieneDiagnosticos: diagnosticosRows[0][0].total > 0,
                tienePlanTrabajo: !!consulta.PLAN_TRABAJO,
                tieneReceta: recetaRows[0][0].total > 0,
                tieneExamenesAux: examenesAuxRows[0][0].total > 0,
                puedeFinalizar: pasosCompletados.length >= 4
            },
            esPrimeraConsulta: esPrimeraConsulta,
            estado: consulta.ESTADO
        });
        
    } catch (error) {
        console.error("Error al obtener estado de consulta:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_ESTADO_CONSULTA", "Error interno del servidor al obtener estado de consulta");
    }
};

// Obtener consulta completa para visualización
exports.obtenerConsultaCompleta = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    
    try {
        // Información básica de la consulta
        const [consultaRows] = await pool.execute(
            `SELECT 
                c.*,
                f.*,
                u.NOMBRE as DOCTOR_NOMBRE,
                u.APELLIDO as DOCTOR_APELLIDO,
                u.DNI as DOCTOR_DNI,
                u.FIRMA_DIGITAL,
                u.NUMERO_COLEGIATURA,
                ec.*,
                DATE_FORMAT(c.FECHA, '%d/%m/%Y %H:%i') as FECHA_CONSULTA_FORMATEADA,
                DATE_FORMAT(ec.FECHA_REGISTRO, '%d/%m/%Y %H:%i') as FECHA_SIGNOS_FORMATEADA
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             JOIN USUARIOS u ON c.ID_USUARIO = u.ID_USUARIO
             LEFT JOIN EXAMEN_CLINICO ec ON c.ID_CONSULTA = ec.ID_CONSULTA
             WHERE c.ID_CONSULTA = ?`,
            [idConsulta]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada");
        }
        
        const consulta = consultaRows[0];
        const esPrimeraConsulta = consulta.ES_PRIMERA_CONSULTA === 1;
        
        // Obtener todos los datos relacionados en paralelo
        const [
            diagnosticosRows,
            recetaRows,
            antecedentesRows,
            examenesAuxRows
        ] = await Promise.all([
            pool.execute(
                `SELECT 
                    dc.*,
                    c.CODIGO,
                    c.DESCRIPCION,
                    c.CAPITULO
                 FROM DIAGNOSTICOS_CONSULTA dc
                 JOIN CATALOGO_CIE10 c ON dc.ID_CIE_10 = c.ID_CIE_10
                 WHERE dc.ID_CONSULTA = ?
                 ORDER BY 
                     CASE dc.TIPO 
                         WHEN 'principal' THEN 1
                         WHEN 'secundario' THEN 2
                         WHEN 'comorbilidad' THEN 3
                         ELSE 4
                     END`,
                [idConsulta]
            ),
            pool.execute(
                `SELECT 
                    r.*,
                    rd.*,
                    m.NOMBRE as MEDICAMENTO_NOMBRE,
                    m.CONCENTRACION,
                    m.FORMA_FARMACEUTICA
                 FROM RECETAS r
                 LEFT JOIN RECETA_DETALLE rd ON r.ID_RECETA = rd.ID_RECETA
                 LEFT JOIN MEDICAMENTOS m ON rd.ID_MEDICAMENTO = m.ID_MEDICAMENTO
                 WHERE r.ID_CONSULTA = ?`,
                [idConsulta]
            ),
            pool.execute(
                `SELECT * FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?`,
                [consulta.ID_FICHA_CLINICA]
            ),
            pool.execute(
                `SELECT * FROM EXAMENES_AUXILIARES WHERE ID_CONSULTA = ?`,
                [idConsulta]
            )
        ]);
        
        // Procesar recetas
        const recetasProcesadas = this.procesarRecetas(recetaRows[0]);
        
        return successResponse(res, "Consulta completa recuperada", {
            consulta: {
                ...consulta,
                ES_PRIMERA_CONSULTA: esPrimeraConsulta
            },
            signosVitales: consulta.ID_EXAMEN_CLINICO ? {
                pa: consulta.PA,
                pulso: consulta.PULSO,
                sao2: consulta.SAO2,
                fr: consulta.FR,
                peso: consulta.PESO,
                talla: consulta.TALLA,
                temperatura: consulta.TEMPERATURA,
                imc: consulta.IMC,
                fecha: consulta.FECHA_SIGNOS_FORMATEADA
            } : null,
            relato: consulta.RELATO,
            antecedentes: antecedentesRows[0][0] || null,
            examenFisico: {
                tipo: esPrimeraConsulta ? 'detallado' : 'simplificado',
                detallado: esPrimeraConsulta ? {
                    general: consulta.EXAMEN_FISICO_GENERAL,
                    regional: consulta.EXAMEN_FISICO_REGIONAL,
                    cardiovascular: consulta.EXAMEN_FISICO_CARDIOVASCULAR,
                    abdominal: consulta.EXAMEN_FISICO_ABDOMINAL,
                    extremidades: consulta.EXAMEN_FISICO_EXTREMIDADES,
                    neurologico: consulta.EXAMEN_FISICO_NEUROLOGICO
                } : null,
                simplificado: !esPrimeraConsulta ? consulta.EXAMEN_FISICO_SIMPLIFICADO : null
            },
            diagnosticos: diagnosticosRows[0],
            planTrabajo: consulta.PLAN_TRABAJO,
            recetas: recetasProcesadas,
            examenesAuxiliares: examenesAuxRows[0]
        }, {
            metadata: {
                totalDiagnosticos: diagnosticosRows[0].length,
                totalRecetas: recetasProcesadas.length,
                totalExamenesAux: examenesAuxRows[0].length,
                tieneAntecedentes: !!antecedentesRows[0][0],
                puedeImprimir: consulta.ESTADO === 'completada',
                estado: consulta.ESTADO
            }
        });
        
    } catch (error) {
        console.error("Error al obtener consulta completa:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_CONSULTA_COMPLETA", "Error interno del servidor al obtener consulta completa");
    }
};

// Función auxiliar para procesar recetas
exports.procesarRecetas = (recetasData) => {
    if (!recetasData || recetasData.length === 0) return [];
    
    const recetasMap = new Map();
    
    recetasData.forEach(item => {
        if (!recetasMap.has(item.ID_RECETA)) {
            recetasMap.set(item.ID_RECETA, {
                idReceta: item.ID_RECETA,
                fechaEmision: item.FECHA_EMISION,
                indicacionesGenerales: item.INDICACIONES_GENERALES,
                medico: {
                    nombre: item.DOCTOR_NOMBRE,
                    apellido: item.DOCTOR_APELLIDO,
                    dni: item.DOCTOR_DNI,
                    firmaDigital: item.FIRMA_DIGITAL,
                    numeroColegiatura: item.NUMERO_COLEGIATURA
                },
                medicamentos: []
            });
        }
        
        if (item.ID_DETALLE) {
            recetasMap.get(item.ID_RECETA).medicamentos.push({
                idDetalle: item.ID_DETALLE,
                idMedicamento: item.ID_MEDICAMENTO,
                medicamentoNombre: item.MEDICAMENTO_NOMBRE,
                concentracion: item.CONCENTRACION,
                formaFarmaceutica: item.FORMA_FARMACEUTICA,
                dosis: item.DOSIS,
                frecuencia: item.FRECUENCIA,
                duracion: item.DURACION
            });
        }
    });
    
    return Array.from(recetasMap.values());
};

// Cancelar consulta
exports.cancelarConsulta = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    const { motivo } = req.body;
    
    try {
        const [consultaRows] = await pool.execute(
            `SELECT c.*, f.NOMBRE_APELLIDO 
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ? AND c.ID_USUARIO = ?`,
            [idConsulta, req.user.id]
        );
        
        if (consultaRows.length === 0) {
            return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada o no tiene permisos");
        }
        
        // Actualizar estado a cancelada
        await pool.execute(
            `UPDATE CONSULTA SET 
                ESTADO = 'cancelada',
                UPDATED_AT = NOW()
             WHERE ID_CONSULTA = ?`,
            [idConsulta]
        );
        
        await logActivity(req.user.dni, "CONSULTA_CANCELADA", {
            idConsulta: idConsulta,
            paciente: consultaRows[0].NOMBRE_APELLIDO,
            motivo: motivo || "Sin motivo especificado"
        });
        
        return successResponse(res, "Consulta cancelada exitosamente", {
            cancelada: true
        });
        
    } catch (error) {
        console.error("Error al cancelar consulta:", error);
        return errorResponse(res, 500, "ERROR_CANCELAR_CONSULTA", "Error interno del servidor al cancelar consulta");
    }
};