const { getPool } = require('../config/db');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { logActivity } = require('../utils/logActivity');
const { 
    verificarPaciente, 
    verificarPacientePorId,
    errorResponse, 
    successResponse,
    calculateIMC 
} = require('../utils/sharedUtils');

const validatePatientData = (patientData) => {
    const errors = [];
    
    if (!patientData.dni || patientData.dni.length !== 8) {
        errors.push('DNI debe tener 8 dígitos');
    }
    if (!patientData.nombreApellido || patientData.nombreApellido.trim().length < 3) {
        errors.push('Nombre y apellido son obligatorios (mínimo 3 caracteres)');
    }
    if (patientData.email && !/\S+@\S+\.\S+/.test(patientData.email)) {
        errors.push('Formato de email inválido');
    }
    return errors;
};

exports.createPaciente = async (req, res) => {
    const pool = getPool();
    const patientData = req.body;

    const validationErrors = validatePatientData(patientData);
    if (validationErrors.length > 0) {
        return errorResponse(res, 400, "VALIDACION_FALLIDA", validationErrors.join(', '));
    }

    try {
        const [existingPatient] = await pool.execute(
            "SELECT ID_FICHA_CLINICA FROM FICHA_CLINICA WHERE DNI = ?",
            [patientData.dni]
        );

        if (existingPatient.length > 0) {
            return errorResponse(res, 409, "PACIENTE_EXISTENTE", "Ya existe un paciente registrado con este DNI");
        }

        const [result] = await pool.execute(
            `INSERT INTO FICHA_CLINICA (
                DNI, NOMBRE_APELLIDO, FECHA_NACIMIENTO, EDAD, SEXO, RAZA,
                ESTADO_CIVIL, OCUPACION, NACIMIENTO, PROCEDENCIA, DOMICILIO, 
                TELEFONO, EMAIL, RESPONSABLE, INSTITUCION
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                patientData.dni, 
                patientData.nombreApellido, 
                patientData.fechaNacimiento || null, 
                patientData.edad || null, 
                patientData.sexo || null, 
                patientData.raza || null,
                patientData.estadoCivil || null, 
                patientData.ocupacion || null, 
                patientData.nacimiento || null, 
                patientData.procedencia || null,
                patientData.domicilio || null, 
                patientData.telefono || null, 
                patientData.email || null, 
                patientData.responsable || null, 
                patientData.institucion || null
            ]
        );

        await logActivity(req.user.dni, 'PATIENT_CREATED', { 
            patientDni: patientData.dni, 
            patientName: patientData.nombreApellido 
        });

        return successResponse(res, "Paciente registrado exitosamente", {
            idFichaClinica: result.insertId,
            paciente: {
                dni: patientData.dni,
                nombre: patientData.nombreApellido
            }
        }, {
            status: 201
        });
    } catch (error) {
        console.error("Error al registrar paciente:", error);
        return errorResponse(res, 500, "ERROR_REGISTRAR_PACIENTE", "Error interno del servidor");
    }
};

exports.getPatientFullDetailByDni = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const patientData = pacienteRows[0];
        const idFichaClinica = patientData.ID_FICHA_CLINICA;

        // Ejecutar consultas en paralelo
        const [
            antecedentesRows,
            consultasRows,
            examenesClinicosRows,
            examenesAuxiliaresRows,
            recetasRows
        ] = await Promise.all([
            pool.execute("SELECT * FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?", [idFichaClinica]),
            pool.execute(`SELECT C.* FROM CONSULTA C WHERE C.ID_FICHA_CLINICA = ? ORDER BY C.FECHA DESC`, [idFichaClinica]),
            pool.execute("SELECT * FROM EXAMEN_CLINICO WHERE ID_FICHA_CLINICA = ? ORDER BY FECHA_REGISTRO DESC", [idFichaClinica]),
            pool.execute("SELECT * FROM EXAMENES_AUXILIARES WHERE ID_FICHA_CLINICA = ? ORDER BY FECHA_REGISTRO DESC", [idFichaClinica]),
            pool.execute("SELECT * FROM RECETAS WHERE ID_FICHA_CLINica = ? ORDER BY FECHA_EMISION DESC", [idFichaClinica])
        ]);

        return successResponse(res, "Detalle completo del paciente recuperado con éxito", {
            paciente: patientData,
            antecedentes: antecedentesRows[0].length > 0 ? antecedentesRows[0][0] : null,
            consultas: consultasRows[0],
            examenes_clinicos: examenesClinicosRows[0],
            examenes_auxiliares: examenesAuxiliaresRows[0],
            recetas: recetasRows[0]
        }, {
            total_consultas: consultasRows[0].length,
            total_examenes: examenesAuxiliaresRows[0].length + examenesClinicosRows[0].length,
            total_recetas: recetasRows[0].length
        });

    } catch (error) {
        console.error("Error al obtener detalle del paciente:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_DETALLE_PACIENTE", "Error interno del servidor");
    }
};

exports.addExamenClinico = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;
    const examenData = req.body;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const idFichaClinica = pacienteRows[0].ID_FICHA_CLINICA;

        // Verificar que la consulta existe si se proporciona ID_CONSULTA
        if (examenData.ID_CONSULTA) {
            const [consultaRows] = await pool.execute(
                "SELECT ID_CONSULTA FROM CONSULTA WHERE ID_CONSULTA = ? AND ID_FICHA_CLINICA = ?",
                [examenData.ID_CONSULTA, idFichaClinica]
            );

            if (consultaRows.length === 0) {
                return errorResponse(res, 404, "CONSULTA_NO_ENCONTRADA", "Consulta no encontrada para este paciente");
            }
        }

        // Calcular IMC
        const imc = calculateIMC(examenData.PESO, examenData.TALLA);

        const [result] = await pool.execute(
            `INSERT INTO EXAMEN_CLINICO (
                ID_CONSULTA, ID_FICHA_CLINICA, PA, PULSO, TIPO_PULSO, 
                SAO2, FR, PESO, TALLA, TEMPERATURA, IMC
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                examenData.ID_CONSULTA || null,
                idFichaClinica,
                examenData.PA || null,
                examenData.PULSO || null,
                examenData.TIPO_PULSO || null,
                examenData.SAO2 || null,
                examenData.FR || null,
                examenData.PESO || null,
                examenData.TALLA || null,
                examenData.TEMPERATURA || null,
                imc
            ]
        );

        // Actualizar IMC si se calculó
        if (imc) {
            await pool.execute(
                "UPDATE EXAMEN_CLINICO SET IMC = ? WHERE ID_EXAMEN_CLINICO = ?",
                [imc, result.insertId]
            );
        }

        return successResponse(res, "Examen clínico registrado exitosamente", {
            id_examen_clinico: result.insertId,
            imc_calculado: imc
        }, {
            status: 201
        });

    } catch (error) {
        console.error("Error al registrar examen clínico:", error);
        return errorResponse(res, 500, "ERROR_REGISTRAR_EXAMEN_CLINICO", "Error interno del servidor");
    }
};

exports.addExamenAuxiliar = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;
    const examenData = req.body;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const idFichaClinica = pacienteRows[0].ID_FICHA_CLINICA;
        let idConsulta = null;

        // Si se proporciona fecha de consulta, buscar la consulta correspondiente
        if (examenData.FECHA_CONSULTA) {
            const [consultaRows] = await pool.execute(
                `SELECT ID_CONSULTA FROM CONSULTA 
                 WHERE ID_FICHA_CLINICA = ? 
                 AND DATE(FECHA) = DATE(?) 
                 ORDER BY FECHA DESC LIMIT 1`,
                [idFichaClinica, examenData.FECHA_CONSULTA]
            );

            if (consultaRows.length > 0) {
                idConsulta = consultasRows[0].ID_CONSULTA;
            }
        }

        // Manejar archivo si existe
        let imagenPath = null;
        if (req.file) {
            const uploadDir = path.join(__dirname, '../uploads/examenes');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const fileName = `examen_${dni}_${Date.now()}${path.extname(req.file.originalname)}`;
            imagenPath = path.join('uploads/examenes', fileName);
            
            fs.writeFileSync(path.join(__dirname, '..', imagenPath), req.file.buffer);
        }

        const [result] = await pool.execute(
            `INSERT INTO EXAMENES_AUXILIARES (
                ID_CONSULTA, ID_FICHA_CLINICA, TIPO_EXAMEN, NOMBRE_EXAMEN,
                DESCRIPCION, RESULTADO, IMAGEN_DOC, COMENTARIO,
                FECHA_SOLICITUD, FECHA_REALIZACION, ESTADO, REGISTRADO_POR
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                idConsulta,
                idFichaClinica,
                examenData.TIPO_EXAMEN,
                examenData.NOMBRE_EXAMEN,
                examenData.DESCRIPCION || null,
                examenData.RESULTADO || null,
                imagenPath,
                examenData.COMENTARIO || null,
                examenData.FECHA_SOLICITUD || new Date(),
                examenData.FECHA_REALIZACION || null,
                examenData.ESTADO || 'solicitado',
                req.user?.id || null
            ]
        );

        return successResponse(res, "Examen auxiliar registrado exitosamente", {
            id_examen_auxiliar: result.insertId,
            imagen_path: imagenPath,
            id_consulta_asociada: idConsulta
        }, {
            status: 201
        });

    } catch (error) {
        console.error("Error al registrar examen auxiliar:", error);
        return errorResponse(res, 500, "ERROR_REGISTRAR_EXAMEN_AUXILIAR", "Error interno del servidor");
    }
};

exports.downloadHistorialClinico = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const patientData = pacienteRows[0];
        const idFichaClinica = patientData.ID_FICHA_CLINICA;

        // Obtener todos los datos relacionados en paralelo
        const [
            antecedentesRows,
            consultasRows,
            examenesClinicosRows,
            examenesAuxiliaresRows,
            recetasRows
        ] = await Promise.all([
            pool.execute("SELECT * FROM ANTECEDENTES WHERE ID_FICHA_CLINICA = ?", [idFichaClinica]),
            pool.execute(`SELECT C.*, CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR 
                FROM CONSULTA C
                LEFT JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
                WHERE C.ID_FICHA_CLINICA = ?
                ORDER BY C.FECHA DESC`, [idFichaClinica]),
            pool.execute("SELECT * FROM EXAMEN_CLINICO WHERE ID_FICHA_CLINICA = ? ORDER BY FECHA_REGISTRO DESC", [idFichaClinica]),
            pool.execute("SELECT * FROM EXAMENES_AUXILIARES WHERE ID_FICHA_CLINica = ? ORDER BY FECHA_REGISTRO DESC", [idFichaClinica]),
            pool.execute("SELECT * FROM RECETAS WHERE ID_FICHA_CLINICA = ? ORDER BY FECHA_EMISION DESC", [idFichaClinica])
        ]);

        // Crear estructura de datos para el historial
        const historialClinico = {
            paciente: patientData,
            antecedentes: antecedentesRows[0].length > 0 ? antecedentesRows[0][0] : null,
            consultas: consultasRows[0],
            examenes_clinicos: examenesClinicosRows[0],
            examenes_auxiliares: examenesAuxiliaresRows[0],
            recetas: recetasRows[0],
            fecha_generacion: new Date().toISOString()
        };

        // Determinar el formato de salida
        const format = req.query.format || 'json';

        if (format === 'json') {
            // Descargar como JSON
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 
                `attachment; filename="historial_${dni}_${new Date().toISOString().split('T')[0]}.json"`);
            return res.send(JSON.stringify(historialClinico, null, 2));
            
        } else if (format === 'zip') {
            // Crear archivo ZIP con JSON y archivos adjuntos
            const archive = archiver('zip', {
                zlib: { level: 9 }
            });

            const fileName = `historial_completo_${dni}_${new Date().toISOString().split('T')[0]}.zip`;
            
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            archive.pipe(res);

            // Agregar JSON con historial
            archive.append(JSON.stringify(historialClinico, null, 2), { 
                name: `historial_${dni}.json` 
            });

            // Agregar archivos de exámenes auxiliares
            const examenesConArchivos = examenesAuxiliaresRows[0].filter(e => e.IMAGEN_DOC);
            
            for (const examen of examenesConArchivos) {
                const filePath = path.join(__dirname, '..', examen.IMAGEN_DOC);
                if (fs.existsSync(filePath)) {
                    const fileName = path.basename(examen.IMAGEN_DOC);
                    archive.file(filePath, { name: `examenes_auxiliares/${fileName}` });
                }
            }

            await archive.finalize();
            return;

        } else {
            return errorResponse(res, 400, "FORMATO_INVALIDO", "Formato no válido. Use 'json' o 'zip'");
        }

    } catch (error) {
        console.error("Error al generar historial clínico:", error);
        return errorResponse(res, 500, "ERROR_GENERAR_HISTORIAL", "Error interno del servidor");
    }
};

exports.updatePaciente = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;
    const body = req.body;
    
    if (!dni) {
        return errorResponse(res, 400, "DNI_REQUERIDO", "El DNI del paciente es obligatorio para la actualización");
    }

    const updates = [];
    const values = [];
    const fieldMap = {
        nombreApellido: 'NOMBRE_APELLIDO',
        fechaNacimiento: 'FECHA_NACIMIENTO',
        edad: 'EDAD',
        sexo: 'SEXO',
        estadoCivil: 'ESTADO_CIVIL',
        ocupacion: 'OCUPACION',
        domicilio: 'DOMICILIO',
        telefono: 'TELEFONO',
        email: 'EMAIL',
        responsable: 'RESPONSABLE',
        institucion: 'INSTITUCION',
        raza: 'RAZA',
        nacimiento: 'NACIMIENTO',
        procedencia: 'PROCEDENCIA',
    };

    for (const key in body) {
        if (body[key] !== undefined && fieldMap[key]) {
            updates.push(`${fieldMap[key]} = ?`);
            values.push(body[key]);
        }
    }

    if (updates.length === 0) {
        return errorResponse(res, 400, "SIN_CAMPOS_ACTUALIZAR", "No se proporcionaron campos válidos para actualizar");
    }
    values.push(dni);

    try {
        const [result] = await pool.execute(
            `UPDATE FICHA_CLINICA SET ${updates.join(', ')} WHERE DNI = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", `Paciente con DNI ${dni} no encontrado para actualizar`);
        }

        return successResponse(res, `Ficha clínica del paciente con DNI ${dni} actualizada con éxito`, {
            affectedRows: result.affectedRows
        });

    } catch (error) {
        console.error("Error al actualizar ficha clínica:", error);
        return errorResponse(res, 500, "ERROR_ACTUALIZAR_PACIENTE", "Error interno del servidor al actualizar los datos");
    }
};

exports.getPacientesVista = async (req, res) => {
    const pool = getPool();
    
    try {
        const [rows] = await pool.execute(
            `SELECT 
                ID_FICHA_CLINICA,
                DNI,
                NOMBRE_APELLIDO,
                FECHA_NACIMIENTO,
                EDAD,
                SEXO,
                ESTADO_CIVIL,
                OCUPACION,
                DOMICILIO,
                TELEFONO,
                EMAIL,
                RESPONSABLE,
                INSTITUCION,
                RAZA,
                NACIMIENTO,
                PROCEDENCIA
             FROM FICHA_CLINICA 
             ORDER BY FECHA DESC`
        );

        return successResponse(res, "Pacientes recuperados con éxito", {
            pacientes: rows,
            total: rows.length
        });

    } catch (error) {
        console.error("Error al obtener pacientes:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_PACIENTES", "Error interno del servidor al obtener pacientes");
    }
};

exports.getPacienteById = async (req, res) => {
    const pool = getPool();
    const { idFichaClinica } = req.params;

    try {
        const pacienteRows = await verificarPacientePorId(pool, idFichaClinica);
        
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        return successResponse(res, "Paciente encontrado", {
            paciente: pacienteRows[0]
        });
    } catch (error) {
        console.error("Error al buscar paciente por ID:", error);
        return errorResponse(res, 500, "ERROR_BUSCAR_PACIENTE_ID", "Error interno del servidor");
    }
};

exports.buscarPacientePorDNI = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        return successResponse(res, "Paciente encontrado", {
            paciente: pacienteRows[0]
        });
    } catch (error) {
        console.error("Error al buscar paciente por DNI:", error);
        return errorResponse(res, 500, "ERROR_BUSCAR_PACIENTE_DNI", "Error interno del servidor");
    }
};

exports.searchPacientes = async (req, res) => {
    const pool = getPool();
    const { query } = req.params;

    try {
        const [rows] = await pool.execute(
            `SELECT 
                ID_FICHA_CLINICA, DNI, NOMBRE_APELLIDO, 
                FECHA_NACIMIENTO, EDAD, SEXO, TELEFONO
             FROM FICHA_CLINICA 
             WHERE DNI LIKE ? OR NOMBRE_APELLIDO LIKE ?
             ORDER BY NOMBRE_APELLIDO ASC`,
            [`%${query}%`, `%${query}%`]
        );

        return successResponse(res, "Búsqueda de pacientes completada", {
            resultados: rows,
            total: rows.length,
            query: query
        });
    } catch (error) {
        console.error("Error al buscar pacientes:", error);
        return errorResponse(res, 500, "ERROR_BUSCAR_PACIENTES", "Error interno del servidor");
    }
};

exports.getConsultasPaciente = async (req, res) => {
    const pool = getPool();
    const { dni } = req.params;

    try {
        const pacienteRows = await verificarPaciente(pool, dni);
        if (pacienteRows.length === 0) {
            return errorResponse(res, 404, "PACIENTE_NO_ENCONTRADO", "Paciente no encontrado");
        }

        const idFichaClinica = pacienteRows[0].ID_FICHA_CLINICA;

        const [rows] = await pool.execute(
            `SELECT 
                C.ID_CONSULTA,
                C.FECHA,
                C.RELATO,
                C.PLAN_TRABAJO,
                C.ES_PRIMERA_CONSULTA,
                D.CODIGO AS CIE10,
                D.DESCRIPCION AS DIAGNOSTICO,
                CONCAT(U.NOMBRE, ' ', U.APELLIDO) AS DOCTOR
             FROM CONSULTA C
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             LEFT JOIN DIAGNOSTICOS_CONSULTA DC ON C.ID_CONSULTA = DC.ID_CONSULTA
             LEFT JOIN CATALOGO_CIE10 D ON DC.ID_CIE_10 = D.ID_CIE_10
             LEFT JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
             WHERE F.DNI = ?
             ORDER BY C.FECHA DESC`,
            [dni]
        );

        return successResponse(res, "Historial de consultas recuperado con éxito", {
            consultas: rows,
            total: rows.length
        });
    } catch (error) {
        console.error("Error al obtener consultas del paciente:", error);
        return errorResponse(res, 500, "ERROR_OBTENER_CONSULTAS", "Error interno del servidor");
    }
};