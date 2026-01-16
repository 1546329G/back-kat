const { getPool } = require('../config/db');
const { logActivity } = require('../utils/logActivity');
const { errorResponse, successResponse } = require('../utils/sharedUtils');

exports.generateDiagnosticoReporte = async (req, res) => {
    const pool = getPool();
    const { fechaInicio, fechaFin, codigoCIE } = req.query;

    // Validación de parámetros
    const errors = [];
    if (!fechaInicio) errors.push("fechaInicio es requerida");
    if (!fechaFin) errors.push("fechaFin es requerida");
    if (!codigoCIE) errors.push("codigoCIE es requerido");
    
    if (errors.length > 0) {
        return errorResponse(res, 400, "PARAMETROS_INVALIDOS", "Parámetros requeridos faltantes", errors);
    }

    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);
    
    if (isNaN(fechaInicioDate.getTime()) || isNaN(fechaFinDate.getTime())) {
        return errorResponse(res, 400, "FORMATO_FECHA_INVALIDO", "Formato de fecha inválido. Use YYYY-MM-DD");
    }

    if (fechaInicioDate > fechaFinDate) {
        return errorResponse(res, 400, "FECHAS_INVALIDAS", "fechaInicio no puede ser mayor que fechaFin");
    }

    try {
        // Obtener información del diagnóstico
        const [diagRows] = await pool.execute(
            `SELECT ID_CIE_10, CODIGO, DESCRIPCION 
             FROM CATALOGO_CIE10 
             WHERE CODIGO = ?`,
            [codigoCIE]
        );

        if (diagRows.length === 0) {
            return errorResponse(res, 404, "DIAGNOSTICO_NO_ENCONTRADO", `Código CIE-10 '${codigoCIE}' no encontrado`);
        }
        
        const diagnostico = diagRows[0];

        // Ejecutar consultas en paralelo
        const [
            totalConsultsRows,
            diagnosedConsultsRows,
            pacientesRows,
            statsBySex,
            statsByAge
        ] = await Promise.all([
            pool.execute(
                `SELECT COUNT(ID_CONSULTA) AS total 
                 FROM CONSULTA 
                 WHERE FECHA BETWEEN ? AND ?`,
                [fechaInicio, fechaFin]
            ),
            pool.execute(
                `SELECT COUNT(DISTINCT C.ID_CONSULTA) AS total 
                 FROM CONSULTA C
                 JOIN DIAGNOSTICOS_CONSULTA DC ON C.ID_CONSULTA = DC.ID_CONSULTA
                 JOIN CATALOGO_CIE10 CC ON DC.ID_CIE_10 = CC.ID_CIE_10
                 WHERE C.FECHA BETWEEN ? AND ? 
                 AND CC.CODIGO = ?`,
                [fechaInicio, fechaFin, codigoCIE]
            ),
            pool.execute(
                `SELECT 
                    F.DNI,
                    F.NOMBRE_APELLIDO,
                    F.EDAD,
                    F.SEXO,
                    C.FECHA,
                    U.NOMBRE AS DOCTOR_NOMBRE,
                    U.APELLIDO AS DOCTOR_APELLIDO
                 FROM CONSULTA C
                 JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
                 JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
                 JOIN DIAGNOSTICOS_CONSULTA DC ON C.ID_CONSULTA = DC.ID_CONSULTA
                 JOIN CATALOGO_CIE10 CC ON DC.ID_CIE_10 = CC.ID_CIE_10
                 WHERE C.FECHA BETWEEN ? AND ? 
                 AND CC.CODIGO = ?
                 ORDER BY C.FECHA DESC`,
                [fechaInicio, fechaFin, codigoCIE]
            ),
            pool.execute(
                `SELECT 
                    F.SEXO,
                    COUNT(DISTINCT C.ID_CONSULTA) as cantidad
                 FROM CONSULTA C
                 JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
                 JOIN DIAGNOSTICOS_CONSULTA DC ON C.ID_CONSULTA = DC.ID_CONSULTA
                 JOIN CATALOGO_CIE10 CC ON DC.ID_CIE_10 = CC.ID_CIE_10
                 WHERE C.FECHA BETWEEN ? AND ? 
                 AND CC.CODIGO = ?
                 GROUP BY F.SEXO`,
                [fechaInicio, fechaFin, codigoCIE]
            ),
            pool.execute(
                `SELECT 
                    CASE
                        WHEN F.EDAD < 18 THEN 'Menor de 18'
                        WHEN F.EDAD BETWEEN 18 AND 30 THEN '18-30'
                        WHEN F.EDAD BETWEEN 31 AND 50 THEN '31-50'
                        WHEN F.EDAD BETWEEN 51 AND 65 THEN '51-65'
                        ELSE 'Mayor de 65'
                    END as grupo_edad,
                    COUNT(DISTINCT C.ID_CONSULTA) as cantidad
                 FROM CONSULTA C
                 JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
                 JOIN DIAGNOSTICOS_CONSULTA DC ON C.ID_CONSULTA = DC.ID_CONSULTA
                 JOIN CATALOGO_CIE10 CC ON DC.ID_CIE_10 = CC.ID_CIE_10
                 WHERE C.FECHA BETWEEN ? AND ? 
                 AND CC.CODIGO = ?
                 AND F.EDAD IS NOT NULL
                 GROUP BY grupo_edad
                 ORDER BY 
                     CASE 
                         WHEN grupo_edad = 'Menor de 18' THEN 1
                         WHEN grupo_edad = '18-30' THEN 2
                         WHEN grupo_edad = '31-50' THEN 3
                         WHEN grupo_edad = '51-65' THEN 4
                         ELSE 5
                     END`,
                [fechaInicio, fechaFin, codigoCIE]
            )
        ]);

        const totalConsults = totalConsultsRows[0].total || 0;
        const diagnosedConsults = diagnosedConsultsRows[0].total || 0;
        const percentage = totalConsults > 0 ? ((diagnosedConsults / totalConsults) * 100).toFixed(2) : 0;

        // Registrar actividad
        if (req.user) {
            await logActivity(
                req.user.dni,
                'REPORT_GENERATED',
                { 
                    tipo: 'diagnostico',
                    codigoCIE,
                    fechaInicio,
                    fechaFin,
                    totalConsultas: totalConsults,
                    pacientesDiagnosticados: diagnosedConsults
                }
            );
        }

        return successResponse(res, "Reporte de diagnóstico generado con éxito", {
            parametros: {
                diagnostico: {
                    codigo: diagnostico.CODIGO,
                    descripcion: diagnostico.DESCRIPCION
                },
                rangoFechas: {
                    inicio: fechaInicio,
                    fin: fechaFin,
                    periodoDias: Math.ceil((fechaFinDate - fechaInicioDate) / (1000 * 60 * 60 * 24)) + 1
                }
            },
            resultados: {
                totalConsultasAtendidas: totalConsults,
                pacientesConDiagnostico: diagnosedConsults,
                porcentaje: percentage,
                estadisticasSexo: statsBySex[0],
                estadisticasEdad: statsByAge[0]
            },
            detallePacientes: {
                total: pacientesRows[0].length,
                lista: pacientesRows[0]
            }
        }, {
            generadoPor: req.user?.dni || 'Sistema',
            fechaGeneracion: new Date().toISOString().split('T')[0],
            horaGeneracion: new Date().toLocaleTimeString()
        });

    } catch (error) {
        console.error("Error al generar reporte de diagnóstico:", error);
        return errorResponse(res, 500, "ERROR_GENERAR_REPORTE", "Error interno al procesar el reporte");
    }
};

// Nuevo método para reporte general
exports.generateReporteGeneral = async (req, res) => {
    const pool = getPool();
    const { fechaInicio, fechaFin } = req.query;

    // Validación
    const errors = [];
    if (!fechaInicio) errors.push("fechaInicio es requerida");
    if (!fechaFin) errors.push("fechaFin es requerida");
    
    if (errors.length > 0) {
        return errorResponse(res, 400, "PARAMETROS_INVALIDOS", "Parámetros requeridos faltantes", errors);
    }

    try {
        // Ejecutar múltiples consultas en paralelo
        const [
            totalConsultasRows,
            totalPacientesRows,
            topDiagnosticosRows,
            consultasPorDoctorRows,
            consultasPorDiaRows
        ] = await Promise.all([
            // Total de consultas
            pool.execute(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN ES_PRIMERA_CONSULTA = 1 THEN 1 ELSE 0 END) as primeras_consultas,
                    SUM(CASE WHEN ES_PRIMERA_CONSULTA = 0 THEN 1 ELSE 0 END) as consultas_control
                 FROM CONSULTA 
                 WHERE FECHA BETWEEN ? AND ?`,
                [fechaInicio, fechaFin]
            ),
            // Total de pacientes atendidos
            pool.execute(
                `SELECT COUNT(DISTINCT ID_FICHA_CLINICA) as total_pacientes
                 FROM CONSULTA 
                 WHERE FECHA BETWEEN ? AND ?`,
                [fechaInicio, fechaFin]
            ),
            // Top 10 diagnósticos más comunes
            pool.execute(
                `SELECT 
                    CC.CODIGO,
                    CC.DESCRIPCION,
                    COUNT(DC.ID_DIAGNOSTICO_CONSULTA) as total
                 FROM DIAGNOSTICOS_CONSULTA DC
                 JOIN CATALOGO_CIE10 CC ON DC.ID_CIE_10 = CC.ID_CIE_10
                 JOIN CONSULTA C ON DC.ID_CONSULTA = C.ID_CONSULTA
                 WHERE C.FECHA BETWEEN ? AND ?
                 GROUP BY CC.CODIGO, CC.DESCRIPCION
                 ORDER BY total DESC
                 LIMIT 10`,
                [fechaInicio, fechaFin]
            ),
            // Consultas por doctor
            pool.execute(
                `SELECT 
                    U.NOMBRE,
                    U.APELLIDO,
                    COUNT(C.ID_CONSULTA) as total_consultas
                 FROM CONSULTA C
                 JOIN USUARIOS U ON C.ID_USUARIO = U.ID_USUARIO
                 WHERE C.FECHA BETWEEN ? AND ?
                 GROUP BY U.ID_USUARIO, U.NOMBRE, U.APELLIDO
                 ORDER BY total_consultas DESC`,
                [fechaInicio, fechaFin]
            ),
            // Consultas por día
            pool.execute(
                `SELECT 
                    DATE(FECHA) as fecha,
                    COUNT(*) as total_consultas
                 FROM CONSULTA 
                 WHERE FECHA BETWEEN ? AND ?
                 GROUP BY DATE(FECHA)
                 ORDER BY fecha`,
                [fechaInicio, fechaFin]
            )
        ]);

        const estadisticas = totalConsultasRows[0][0];
        const totalPacientes = totalPacientesRows[0][0].total_pacientes;

        return successResponse(res, "Reporte general generado con éxito", {
            resumen: {
                total_consultas: estadisticas.total || 0,
                primeras_consultas: estadisticas.primeras_consultas || 0,
                consultas_control: estadisticas.consultas_control || 0,
                total_pacientes: totalPacientes || 0,
                promedio_consultas_por_paciente: totalPacientes > 0 ? 
                    (estadisticas.total / totalPacientes).toFixed(2) : 0
            },
            top_diagnosticos: topDiagnosticosRows[0],
            consultas_por_doctor: consultasPorDoctorRows[0],
            consultas_por_dia: consultasPorDiaRows[0]
        }, {
            parametros: {
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin,
                periodo: Math.ceil((new Date(fechaFin) - new Date(fechaInicio)) / (1000 * 60 * 60 * 24)) + 1 + ' días'
            },
            generado_por: req.user?.dni || 'Sistema',
            fecha_generacion: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error al generar reporte general:", error);
        return errorResponse(res, 500, "ERROR_GENERAR_REPORTE_GENERAL", "Error interno al procesar el reporte general");
    }
};