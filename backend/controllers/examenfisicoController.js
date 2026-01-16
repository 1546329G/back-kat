const { getPool } = require('../config/db');
const { logActivity } = require('../utils/logActivity');

exports.registrarExamenFisico = async (req, res) => {
    const pool = getPool();
    const { 
        idConsulta,
        esPrimeraConsulta = false,
        examenDetallado = {},
        examenSimplificado = '',
        observaciones = ''
    } = req.body;

    console.log('Datos recibidos para examen físico:', { 
        idConsulta, 
        esPrimeraConsulta,
        tieneExamenDetallado: !!examenDetallado && Object.keys(examenDetallado).length > 0,
        tieneExamenSimplificado: !!examenSimplificado
    });

    if (!idConsulta) {
        return res.status(400).json({ 
            error: "ID de consulta es requerido.",
            code: "ID_CONSULTA_REQUERIDO"
        });
    }

    if (!req.user || !req.user.dni) {
        return res.status(401).json({ 
            error: "Usuario no autenticado correctamente.",
            code: "USUARIO_NO_AUTENTICADO"
        });
    }

    if (esPrimeraConsulta) {
        if (!examenDetallado || Object.keys(examenDetallado).length === 0) {
            return res.status(400).json({
                error: "Examen físico detallado es requerido para primera consulta.",
                code: "EXAMEN_DETALLADO_REQUERIDO"
            });
        }
    } else {
        if (!examenSimplificado || examenSimplificado.trim() === '') {
            return res.status(400).json({
                error: "Examen físico simplificado es requerido para consultas de control.",
                code: "EXAMEN_SIMPLIFICADO_REQUERIDO"
            });
        }
    }

    try {
        const [consultaRows] = await pool.execute(
            `SELECT c.ID_CONSULTA, c.ES_PRIMERA_CONSULTA, f.NOMBRE_APELLIDO 
             FROM CONSULTA c 
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA 
             WHERE c.ID_CONSULTA = ?`,
            [idConsulta]
        );

        if (consultaRows.length === 0) {
            return res.status(404).json({ 
                error: "Consulta no encontrada.",
                code: "CONSULTA_NO_ENCONTRADA"
            });
        }

        const consultaExistente = consultaRows[0];
        const nombrePaciente = consultaExistente.NOMBRE_APELLIDO;
        
        if (consultaExistente.ES_PRIMERA_CONSULTA !== (esPrimeraConsulta ? 1 : 0)) {
            console.warn('Advertencia: Tipo de consulta no coincide con los datos enviados');
        }

        let updateQuery = `UPDATE CONSULTA SET UPDATED_AT = NOW()`;
        const params = [];

        if (esPrimeraConsulta) {
            const {
                estadoGeneral, habitus, hidratacion, conciencia, orientacion,
                
                cabeza, ojos, oidos, nariz, boca, cuello, torax, abdomen,
                
                ritmoCardiaco, ruidosCardiacos, soplos, frotes, pulsosPerifericos,
                
                formaAbdomen, peristalsis, visceromegalias, dolorPalpacion, signosIrritacion,
                
                extremidadesSuperiores, extremidadesInferiores, edema, pulsosExtremidades, temperaturaPiel,
            
                motilidad, sensibilidad, reflejos, fuerzaMuscular, coordinacion
            } = examenDetallado;

            updateQuery += `, 
                EXAMEN_FISICO_GENERAL = ?,
                EXAMEN_FISICO_REGIONAL = ?,
                EXAMEN_FISICO_CARDIOVASCULAR = ?,
                EXAMEN_FISICO_ABDOMINAL = ?,
                EXAMEN_FISICO_EXTREMIDADES = ?,
                EXAMEN_FISICO_NEUROLOGICO = ?,
                EXAMEN_FISICO_SIMPLIFICADO = NULL`;

            params.push(
                JSON.stringify({
                    estadoGeneral: estadoGeneral || '',
                    habitus: habitus || '',
                    hidratacion: hidratacion || '',
                    conciencia: conciencia || '',
                    orientacion: orientacion || ''
                }),
                JSON.stringify({
                    cabeza: cabeza || '',
                    ojos: ojos || '',
                    oidos: oidos || '',
                    nariz: nariz || '',
                    boca: boca || '',
                    cuello: cuello || '',
                    torax: torax || '',
                    abdomen: abdomen || ''
                }),
                JSON.stringify({
                    ritmoCardiaco: ritmoCardiaco || '',
                    ruidosCardiacos: ruidosCardiacos || '',
                    soplos: soplos || '',
                    frotes: frotes || '',
                    pulsosPerifericos: pulsosPerifericos || ''
                }),
                JSON.stringify({
                    formaAbdomen: formaAbdomen || '',
                    peristalsis: peristalsis || '',
                    visceromegalias: visceromegalias || '',
                    dolorPalpacion: dolorPalpacion || '',
                    signosIrritacion: signosIrritacion || ''
                }),
                JSON.stringify({
                    extremidadesSuperiores: extremidadesSuperiores || '',
                    extremidadesInferiores: extremidadesInferiores || '',
                    edema: edema || '',
                    pulsosExtremidades: pulsosExtremidades || '',
                    temperaturaPiel: temperaturaPiel || ''
                }),
                JSON.stringify({
                    motilidad: motilidad || '',
                    sensibilidad: sensibilidad || '',
                    reflejos: reflejos || '',
                    fuerzaMuscular: fuerzaMuscular || '',
                    coordinacion: coordinacion || ''
                })
            );
        } else {
            // Consulta de control - solo examen simplificado
            updateQuery += `, 
                EXAMEN_FISICO_SIMPLIFICADO = ?,
                EXAMEN_FISICO_GENERAL = NULL,
                EXAMEN_FISICO_REGIONAL = NULL,
                EXAMEN_FISICO_CARDIOVASCULAR = NULL,
                EXAMEN_FISICO_ABDOMINAL = NULL,
                EXAMEN_FISICO_EXTREMIDADES = NULL,
                EXAMEN_FISICO_NEUROLOGICO = NULL`;
            
            params.push(examenSimplificado);
        }

        // Agregar observaciones si existen
        if (observaciones && observaciones.trim() !== '') {
            updateQuery += `, OBSERVACIONES_EXAMEN_FISICO = ?`;
            params.push(observaciones);
        }

        updateQuery += ` WHERE ID_CONSULTA = ?`;
        params.push(idConsulta);

        // Ejecutar la actualización
        const [result] = await pool.execute(updateQuery, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                error: "Consulta no encontrada para actualizar.",
                code: "CONSULTA_NO_ACTUALIZADA"
            });
        }

        // Registrar actividad en el log
        await logActivity(
            req.user.dni,
            esPrimeraConsulta ? 'EXAMEN_FISICO_DETALLADO_REGISTRADO' : 'EXAMEN_FISICO_SIMPLIFICADO_REGISTRADO',
            { 
                idConsulta: idConsulta,
                paciente: nombrePaciente,
                tipoExamen: esPrimeraConsulta ? 'detallado' : 'simplificado',
                tieneObservaciones: !!observaciones
            }
        );

        res.status(200).json({
            message: `Examen físico ${esPrimeraConsulta ? 'detallado' : 'simplificado'} registrado con éxito.`,
            idConsulta: idConsulta,
            tipoExamen: esPrimeraConsulta ? 'detallado' : 'simplificado',
            metadata: {
                paciente: nombrePaciente,
                fecha: new Date().toISOString(),
                tieneObservaciones: !!observaciones
            }
        });

    } catch (error) {
        console.error("❌ Error al registrar examen físico:", error);
        res.status(500).json({ 
            error: "Error interno del servidor al registrar examen físico.",
            code: "ERROR_REGISTRAR_EXAMEN_FISICO",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Obtiene examen físico completo según el tipo de consulta
 */
exports.obtenerExamenFisico = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;

    try {
        const [rows] = await pool.execute(
            `SELECT 
                c.ES_PRIMERA_CONSULTA,
                c.EXAMEN_FISICO_GENERAL,
                c.EXAMEN_FISICO_REGIONAL,
                c.EXAMEN_FISICO_CARDIOVASCULAR,
                c.EXAMEN_FISICO_ABDOMINAL,
                c.EXAMEN_FISICO_EXTREMIDADES,
                c.EXAMEN_FISICO_NEUROLOGICO,
                c.EXAMEN_FISICO_SIMPLIFICADO,
                c.OBSERVACIONES_EXAMEN_FISICO,
                f.NOMBRE_APELLIDO as PACIENTE_NOMBRE,
                f.DNI as PACIENTE_DNI
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ?`,
            [idConsulta]
        );

        if (rows.length === 0) {
            return res.status(404).json({ 
                error: "Consulta no encontrada.",
                code: "CONSULTA_NO_ENCONTRADA"
            });
        }

        const examenData = rows[0];
        const esPrimeraConsulta = examenData.ES_PRIMERA_CONSULTA === 1;
        
        let datosExamen = {
            tipoConsulta: esPrimeraConsulta ? 'primera' : 'control',
            paciente: {
                nombre: examenData.PACIENTE_NOMBRE,
                dni: examenData.PACIENTE_DNI
            }
        };

        if (esPrimeraConsulta) {
            datosExamen.examenDetallado = {};
            
            if (examenData.EXAMEN_FISICO_GENERAL) {
                try {
                    datosExamen.examenDetallado.examenGeneral = JSON.parse(examenData.EXAMEN_FISICO_GENERAL);
                } catch (e) {
                    console.error('Error parseando EXAMEN_FISICO_GENERAL:', e);
                    datosExamen.examenDetallado.examenGeneral = {};
                }
            }
            
            if (examenData.EXAMEN_FISICO_REGIONAL) {
                try {
                    datosExamen.examenDetallado.examenRegional = JSON.parse(examenData.EXAMEN_FISICO_REGIONAL);
                } catch (e) {
                    console.error('Error parseando EXAMEN_FISICO_REGIONAL:', e);
                    datosExamen.examenDetallado.examenRegional = {};
                }
            }
            
            if (examenData.EXAMEN_FISICO_CARDIOVASCULAR) {
                try {
                    datosExamen.examenDetallado.examenCardiovascular = JSON.parse(examenData.EXAMEN_FISICO_CARDIOVASCULAR);
                } catch (e) {
                    console.error('Error parseando EXAMEN_FISICO_CARDIOVASCULAR:', e);
                    datosExamen.examenDetallado.examenCardiovascular = {};
                }
            }
            
            if (examenData.EXAMEN_FISICO_ABDOMINAL) {
                try {
                    datosExamen.examenDetallado.examenAbdominal = JSON.parse(examenData.EXAMEN_FISICO_ABDOMINAL);
                } catch (e) {
                    console.error('Error parseando EXAMEN_FISICO_ABDOMINAL:', e);
                    datosExamen.examenDetallado.examenAbdominal = {};
                }
            }
            
            if (examenData.EXAMEN_FISICO_EXTREMIDADES) {
                try {
                    datosExamen.examenDetallado.examenExtremidades = JSON.parse(examenData.EXAMEN_FISICO_EXTREMIDADES);
                } catch (e) {
                    console.error('Error parseando EXAMEN_FISICO_EXTREMIDADES:', e);
                    datosExamen.examenDetallado.examenExtremidades = {};
                }
            }
            
            if (examenData.EXAMEN_FISICO_NEUROLOGICO) {
                try {
                    datosExamen.examenDetallado.examenNeurologico = JSON.parse(examenData.EXAMEN_FISICO_NEUROLOGICO);
                } catch (e) {
                    console.error('Error parseando EXAMEN_FISICO_NEUROLOGICO:', e);
                    datosExamen.examenDetallado.examenNeurologico = {};
                }
            }
        } else {
            datosExamen.examenSimplificado = examenData.EXAMEN_FISICO_SIMPLIFICADO || '';
        }

        if (examenData.OBSERVACIONES_EXAMEN_FISICO) {
            datosExamen.observaciones = examenData.OBSERVACIONES_EXAMEN_FISICO;
        }

        datosExamen.metadata = {
            tieneExamenDetallado: esPrimeraConsulta && Object.keys(datosExamen.examenDetallado || {}).length > 0,
            tieneExamenSimplificado: !esPrimeraConsulta && !!datosExamen.examenSimplificado,
            tieneObservaciones: !!datosExamen.observaciones,
            seccionesCompletas: esPrimeraConsulta ? {
                general: !!examenData.EXAMEN_FISICO_GENERAL,
                regional: !!examenData.EXAMEN_FISICO_REGIONAL,
                cardiovascular: !!examenData.EXAMEN_FISICO_CARDIOVASCULAR,
                abdominal: !!examenData.EXAMEN_FISICO_ABDOMINAL,
                extremidades: !!examenData.EXAMEN_FISICO_EXTREMIDADES,
                neurologico: !!examenData.EXAMEN_FISICO_NEUROLOGICO
            } : null
        };

        res.json({
            message: `Examen físico ${esPrimeraConsulta ? 'detallado' : 'simplificado'} encontrado exitosamente.`,
            data: datosExamen
        });

    } catch (error) {
        console.error("Error al obtener examen físico:", error);
        res.status(500).json({ 
            error: "Error interno del servidor al obtener examen físico.",
            code: "ERROR_OBTENER_EXAMEN_FISICO",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.actualizarObservacionesExamen = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    const { observaciones } = req.body;

    if (!idConsulta) {
        return res.status(400).json({ 
            error: "ID de consulta es requerido.",
            code: "ID_CONSULTA_REQUERIDO"
        });
    }

    if (!req.user || !req.user.dni) {
        return res.status(401).json({ 
            error: "Usuario no autenticado correctamente.",
            code: "USUARIO_NO_AUTENTICADO"
        });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE CONSULTA SET 
                OBSERVACIONES_EXAMEN_FISICO = ?,
                UPDATED_AT = NOW()
             WHERE ID_CONSULTA = ?`,
            [observaciones || '', idConsulta]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                error: "Consulta no encontrada.",
                code: "CONSULTA_NO_ENCONTRADA"
            });
        }

        await logActivity(
            req.user.dni,
            'OBSERVACIONES_EXAMEN_ACTUALIZADAS',
            { 
                idConsulta: idConsulta,
                tieneObservaciones: !!observaciones
            }
        );

        res.status(200).json({
            message: "Observaciones del examen físico actualizadas con éxito.",
            idConsulta: idConsulta,
            tieneObservaciones: !!observaciones
        });

    } catch (error) {
        console.error("Error al actualizar observaciones:", error);
        res.status(500).json({ 
            error: "Error interno del servidor al actualizar observaciones.",
            code: "ERROR_ACTUALIZAR_OBSERVACIONES",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.verificarExamenFisico = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;

    try {
        const [rows] = await pool.execute(
            `SELECT 
                ES_PRIMERA_CONSULTA,
                EXAMEN_FISICO_GENERAL,
                EXAMEN_FISICO_SIMPLIFICADO,
                OBSERVACIONES_EXAMEN_FISICO
             FROM CONSULTA 
             WHERE ID_CONSULTA = ?`,
            [idConsulta]
        );

        if (rows.length === 0) {
            return res.status(404).json({ 
                error: "Consulta no encontrada.",
                code: "CONSULTA_NO_ENCONTRADA"
            });
        }

        const consulta = rows[0];
        const esPrimeraConsulta = consulta.ES_PRIMERA_CONSULTA === 1;
        
        let tieneExamenFisico = false;
        let tipoExamen = 'no_registrado';

        if (esPrimeraConsulta) {
            tieneExamenFisico = !!consulta.EXAMEN_FISICO_GENERAL || 
                               !!consulta.EXAMEN_FISICO_SIMPLIFICADO; 
            tipoExamen = tieneExamenFisico ? 'detallado' : 'no_registrado';
        } else {
            tieneExamenFisico = !!consulta.EXAMEN_FISICO_SIMPLIFICADO;
            tipoExamen = tieneExamenFisico ? 'simplificado' : 'no_registrado';
        }

        res.json({
            message: "Estado del examen físico verificado.",
            data: {
                tieneExamenFisico,
                tipoExamen,
                esPrimeraConsulta,
                tieneObservaciones: !!consulta.OBSERVACIONES_EXAMEN_FISICO,
                seccionesCompletadas: esPrimeraConsulta ? {
                    general: !!consulta.EXAMEN_FISICO_GENERAL,
                } : null
            }
        });

    } catch (error) {
        console.error("Error al verificar examen físico:", error);
        res.status(500).json({ 
            error: "Error interno del servidor al verificar examen físico.",
            code: "ERROR_VERIFICAR_EXAMEN_FISICO"
        });
    }
};

exports.obtenerResumenExamenFisico = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;

    try {
        const [rows] = await pool.execute(
            `SELECT 
                c.ES_PRIMERA_CONSULTA,
                c.EXAMEN_FISICO_SIMPLIFICADO,
                c.OBSERVACIONES_EXAMEN_FISICO,
                LENGTH(c.EXAMEN_FISICO_GENERAL) as TIENE_GENERAL,
                LENGTH(c.EXAMEN_FISICO_REGIONAL) as TIENE_REGIONAL,
                f.NOMBRE_APELLIDO as PACIENTE_NOMBRE
             FROM CONSULTA c
             JOIN FICHA_CLINICA f ON c.ID_FICHA_CLINICA = f.ID_FICHA_CLINICA
             WHERE c.ID_CONSULTA = ?`,
            [idConsulta]
        );

        if (rows.length === 0) {
            return res.status(404).json({ 
                error: "Consulta no encontrada.",
                code: "CONSULTA_NO_ENCONTRADA"
            });
        }

        const data = rows[0];
        const esPrimeraConsulta = data.ES_PRIMERA_CONSULTA === 1;

        let resumen = '';
        let tipo = 'no_registrado';

        if (esPrimeraConsulta) {
            const seccionesCompletadas = [
                data.TIENE_GENERAL > 0 ? 'General' : null,
                data.TIENE_REGIONAL > 0 ? 'Regional' : null
            ].filter(Boolean);

            if (seccionesCompletadas.length > 0) {
                resumen = `Examen detallado (${seccionesCompletadas.join(', ')})`;
                tipo = 'detallado';
            }
        } else if (data.EXAMEN_FISICO_SIMPLIFICADO) {
            resumen = data.EXAMEN_FISICO_SIMPLIFICADO.substring(0, 100) + 
                     (data.EXAMEN_FISICO_SIMPLIFICADO.length > 100 ? '...' : '');
            tipo = 'simplificado';
        }

        res.json({
            message: "Resumen del examen físico obtenido.",
            data: {
                resumen,
                tipo,
                esPrimeraConsulta,
                tieneObservaciones: !!data.OBSERVACIONES_EXAMEN_FISICO,
                paciente: data.PACIENTE_NOMBRE
            }
        });

    } catch (error) {
        console.error("Error al obtener resumen del examen físico:", error);
        res.status(500).json({ 
            error: "Error interno del servidor al obtener resumen.",
            code: "ERROR_OBTENER_RESUMEN_EXAMEN"
        });
    }
};