const { getPool } = require('../config/db');
const { logActivity } = require('../utils/logActivity');

exports.agregarDiagnosticoSecundario = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;
    const { codigoCIE } = req.body;

    if (!codigoCIE) {
        return res.status(400).json({ 
            error: "El código CIE-10 es requerido." 
        });
    }

    try {
        const [consultaRows] = await pool.execute(
            `SELECT C.ID_CONSULTA, F.NOMBRE_APELLIDO 
             FROM CONSULTA C 
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA 
             WHERE C.ID_CONSULTA = ?`,
            [idConsulta]
        );

        if (consultaRows.length === 0) {
            return res.status(404).json({ 
                error: "Consulta no encontrada." 
            });
        }

        const [diagnosticoRows] = await pool.execute(
            "SELECT ID_DIAGNOSTICO, CODIGO, DESCRIPCION FROM DIAGNOSTICO WHERE CODIGO = ?",
            [codigoCIE]
        );

        if (diagnosticoRows.length === 0) {
            return res.status(404).json({ 
                error: "Código CIE-10 no encontrado." 
            });
        }

        const idDiagnostico = diagnosticoRows[0].ID_DIAGNOSTICO;

        const [existenteRows] = await pool.execute(
            `SELECT ID_DIAGNOSTICO_SECUNDARIO 
             FROM CONSULTA_DIAGNOSTICOS_SECUNDARIOS 
             WHERE ID_CONSULTA = ? AND ID_DIAGNOSTICO = ?`,
            [idConsulta, idDiagnostico]
        );

        if (existenteRows.length > 0) {
            return res.status(409).json({ 
                error: "Este diagnóstico ya está registrado como secundario para esta consulta." 
            });
        }

        const [result] = await pool.execute(
            `INSERT INTO CONSULTA_DIAGNOSTICOS_SECUNDARIOS 
             (ID_CONSULTA, ID_DIAGNOSTICO, FECHA_REGISTRO) 
             VALUES (?, ?, NOW())`,
            [idConsulta, idDiagnostico]
        );

        await logActivity(
            req.user.dni,
            'DIAGNOSTICO_SECUNDARIO_AGREGADO',
            {
                idConsulta,
                codigoCIE,
                paciente: consultaRows[0].NOMBRE_APELLIDO,
                idDiagnosticoSecundario: result.insertId
            }
        );

        res.status(201).json({
            message: "Diagnóstico secundario agregado exitosamente.",
            idDiagnosticoSecundario: result.insertId,
            diagnostico: {
                codigo: diagnosticoRows[0].CODIGO,
                descripcion: diagnosticoRows[0].DESCRIPCION
            },
            paciente: consultaRows[0].NOMBRE_APELLIDO
        });

    } catch (error) {
        console.error("Error al agregar diagnóstico secundario:", error);
        res.status(500).json({ 
            error: "Error interno del servidor.",
            details: error.message 
        });
    }
};

exports.obtenerDiagnosticosConsulta = async (req, res) => {
    const pool = getPool();
    const { idConsulta } = req.params;

    try {
        const [consultaRows] = await pool.execute(
            `SELECT C.ID_CONSULTA, F.NOMBRE_APELLIDO 
             FROM CONSULTA C 
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA 
             WHERE C.ID_CONSULTA = ?`,
            [idConsulta]
        );

        if (consultaRows.length === 0) {
            return res.status(404).json({ 
                error: "Consulta no encontrada." 
            });
        }

        const [diagnosticoPrincipalRows] = await pool.execute(
            `SELECT D.CODIGO, D.DESCRIPCION, 'principal' as tipo
             FROM CONSULTA C
             JOIN DIAGNOSTICO D ON C.ID_DIAGNOSTICO = D.ID_DIAGNOSTICO
             WHERE C.ID_CONSULTA = ?`,
            [idConsulta]
        );

        const [diagnosticosSecundariosRows] = await pool.execute(
            `SELECT CDS.ID_DIAGNOSTICO_SECUNDARIO, D.CODIGO, D.DESCRIPCION, 
                    CDS.FECHA_REGISTRO, 'secundario' as tipo
             FROM CONSULTA_DIAGNOSTICOS_SECUNDARIOS CDS
             JOIN DIAGNOSTICO D ON CDS.ID_DIAGNOSTICO = D.ID_DIAGNOSTICO
             WHERE CDS.ID_CONSULTA = ?
             ORDER BY CDS.FECHA_REGISTRO DESC`,
            [idConsulta]
        );

        const diagnosticos = [];

        if (diagnosticoPrincipalRows.length > 0) {
            diagnosticos.push({
                id: 'principal',
                codigo: diagnosticoPrincipalRows[0].CODIGO,
                descripcion: diagnosticoPrincipalRows[0].DESCRIPCION,
                tipo: 'principal',
                esPrincipal: true
            });
        }

        diagnosticosSecundariosRows.forEach(ds => {
            diagnosticos.push({
                id: ds.ID_DIAGNOSTICO_SECUNDARIO,
                codigo: ds.CODIGO,
                descripcion: ds.DESCRIPCION,
                tipo: 'secundario',
                esPrincipal: false,
                fechaRegistro: ds.FECHA_REGISTRO
            });
        });

        await logActivity(
            req.user.dni,
            'DIAGNOSTICOS_CONSULTA_CONSULTADOS',
            {
                idConsulta,
                totalDiagnosticos: diagnosticos.length,
                paciente: consultaRows[0].NOMBRE_APELLIDO
            }
        );

        res.json({
            message: "Diagnósticos de la consulta recuperados exitosamente.",
            diagnosticos: diagnosticos,
            total: diagnosticos.length,
            paciente: consultaRows[0].NOMBRE_APELLIDO,
            idConsulta: parseInt(idConsulta)
        });

    } catch (error) {
        console.error("Error al obtener diagnósticos de la consulta:", error);
        res.status(500).json({ 
            error: "Error interno del servidor." 
        });
    }
};
exports.eliminarDiagnosticoSecundario = async (req, res) => {
    const pool = getPool();
    const { idConsulta, idDiagnosticoSecundario } = req.params;

    try{
        const [diagnosticoRows] = await pool.execute(
            `SELECT CDS.ID_DIAGNOSTICO_SECUNDARIO, D.CODIGO, D.DESCRIPCION, F.NOMBRE_APELLIDO
             FROM CONSULTA_DIAGNOSTICOS_SECUNDARIOS CDS
             JOIN CONSULTA C ON CDS.ID_CONSULTA = C.ID_CONSULTA
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA
             JOIN DIAGNOSTICO D ON CDS.ID_DIAGNOSTICO = D.ID_DIAGNOSTICO
             WHERE CDS.ID_DIAGNOSTICO_SECUNDARIO = ? AND CDS.ID_CONSULTA = ?`,
            [idDiagnosticoSecundario, idConsulta]
        );

        if (diagnosticoRows.length === 0) {
            return res.status(404).json({ 
                error: "Diagnóstico secundario no encontrado para esta consulta." 
            });
        }

        const [result] = await pool.execute(
            `DELETE FROM CONSULTA_DIAGNOSTICOS_SECUNDARIOS 
             WHERE ID_DIAGNOSTICO_SECUNDARIO = ? AND ID_CONSULTA = ?`,
            [idDiagnosticoSecundario, idConsulta]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                error: "No se pudo eliminar el diagnóstico secundario." 
            });
        }

        await logActivity(
            req.user.dni,
            'DIAGNOSTICO_SECUNDARIO_ELIMINADO',
            {
                idConsulta,
                idDiagnosticoSecundario,
                codigoCIE: diagnosticoRows[0].CODIGO,
                paciente: diagnosticoRows[0].NOMBRE_APELLIDO
            }
        );

        res.json({
            message: "Diagnóstico secundario eliminado exitosamente.",
            affectedRows: result.affectedRows,
            diagnosticoEliminado: {
                codigo: diagnosticoRows[0].CODIGO,
                descripcion: diagnosticoRows[0].DESCRIPCION
            },
            paciente: diagnosticoRows[0].NOMBRE_APELLIDO
        });

    } catch (error) {
        console.error("Error al eliminar diagnóstico secundario:", error);
        res.status(500).json({ 
            error: "Error interno del servidor.",
            details: error.message 
        });
    }
};

exports.buscarCIE10Avanzado = async (req, res) => {
    const pool = getPool();
    const { query, limit = 20, categoria } = req.query;

    if (!query || query.length < 2) {
        return res.status(400).json({ 
            error: "Se requiere un término de búsqueda con al menos 2 caracteres." 
        });
    }

    try {
        let sql = `
            SELECT CODIGO, DESCRIPCION, CATEGORIA
            FROM DIAGNOSTICO 
            WHERE (CODIGO LIKE ? OR DESCRIPCION LIKE ?)
        `;
        const params = [`%${query}%`, `%${query}%`];

        if (categoria) {
            sql += " AND CATEGORIA LIKE ?";
            params.push(`%${categoria}%`);
        }

        sql += " ORDER BY CODIGO ASC LIMIT ?";
        params.push(parseInt(limit));

        const [rows] = await pool.execute(sql, params);

        res.json({
            message: "Búsqueda avanzada de CIE-10 completada.",
            data: rows,
            total: rows.length,
            query: query,
            filtros: {
                categoria: categoria || 'todas',
                limite: parseInt(limit)
            }
        });

    } catch (error) {
        console.error("Error en búsqueda avanzada CIE-10:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

exports.obtenerCategoriasCIE10 = async (req, res) => {
    const pool = getPool();

    try {
        const [rows] = await pool.execute(
            `SELECT DISTINCT CATEGORIA 
             FROM DIAGNOSTICO 
             WHERE CATEGORIA IS NOT NULL AND CATEGORIA != ''
             ORDER BY CATEGORIA ASC`
        );

        res.json({
            message: "Categorías de CIE-10 recuperadas.",
            categorias: rows.map(row => ({
                codigo: row.CATEGORIA,
                descripcion: row.CATEGORIA
            })),
            total: rows.length
        });

    } catch (error) {
        console.error("Error al obtener categorías CIE-10:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

exports.obtenerDiagnosticoPorCodigo = async (req, res) => {
    const pool = getPool();
    const { codigo } = req.params;

    try {
        const [rows] = await pool.execute(
            "SELECT CODIGO, DESCRIPCION, CATEGORIA FROM DIAGNOSTICO WHERE CODIGO = ?",
            [codigo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ 
                error: "Código CIE-10 no encontrado." 
            });
        }

        res.json({
            message: "Diagnóstico encontrado.",
            diagnostico: rows[0]
        });

    } catch (error) {
        console.error("Error al obtener diagnóstico por código:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

exports.agregarMultiplesDiagnosticos = async (req, res) => {
    const pool = getPool();
    const { idConsulta, diagnosticos } = req.body;

    if (!idConsulta || !diagnosticos || !Array.isArray(diagnosticos)) {
        return res.status(400).json({ 
            error: "Se requiere ID de consulta y array de diagnósticos." 
        });
    }

    if (diagnosticos.length === 0) {
        return res.status(400).json({ 
            error: "El array de diagnósticos no puede estar vacío." 
        });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [consultaRows] = await connection.execute(
            `SELECT C.ID_CONSULTA, F.NOMBRE_APELLIDO 
             FROM CONSULTA C 
             JOIN FICHA_CLINICA F ON C.ID_FICHA_CLINICA = F.ID_FICHA_CLINICA 
             WHERE C.ID_CONSULTA = ?`,
            [idConsulta]
        );

        if (consultaRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                error: "Consulta no encontrada." 
            });
        }

        const diagnosticosRegistrados = [];
        const diagnosticosConError = [];

        for (const diag of diagnosticos) {
            try {
                if (!diag.codigoCIE) {
                    diagnosticosConError.push({
                        codigo: 'N/A',
                        error: 'Código CIE-10 requerido'
                    });
                    continue;
                }

                const [diagnosticoRows] = await connection.execute(
                    "SELECT ID_DIAGNOSTICO, CODIGO, DESCRIPCION FROM DIAGNOSTICO WHERE CODIGO = ?",
                    [diag.codigoCIE]
                );

                if (diagnosticoRows.length === 0) {
                    diagnosticosConError.push({
                        codigo: diag.codigoCIE,
                        error: 'Código CIE-10 no encontrado'
                    });
                    continue;
                }

                const idDiagnostico = diagnosticoRows[0].ID_DIAGNOSTICO;

                if (diag.esPrincipal) {
                    await connection.execute(
                        "UPDATE CONSULTA SET ID_DIAGNOSTICO = ? WHERE ID_CONSULTA = ?",
                        [idDiagnostico, idConsulta]
                    );
                } else {
                    const [result] = await connection.execute(
                        `INSERT INTO CONSULTA_DIAGNOSTICOS_SECUNDARIOS 
                         (ID_CONSULTA, ID_DIAGNOSTICO, FECHA_REGISTRO) 
                         VALUES (?, ?, NOW())`,
                        [idConsulta, idDiagnostico]
                    );

                    diagnosticosRegistrados.push({
                        id: result.insertId,
                        codigo: diagnosticoRows[0].CODIGO,
                        descripcion: diagnosticoRows[0].DESCRIPCION,
                        tipo: diag.esPrincipal ? 'principal' : 'secundario'
                    });
                }

            } catch (error) {
                diagnosticosConError.push({
                    codigo: diag.codigoCIE || 'N/A',
                    error: error.message
                });
            }
        }

        await connection.commit();

        await logActivity(
            req.user.dni,
            'DIAGNOSTICOS_MULTIPLES_AGREGADOS',
            {
                idConsulta,
                totalRegistrados: diagnosticosRegistrados.length,
                totalErrores: diagnosticosConError.length,
                paciente: consultaRows[0].NOMBRE_APELLIDO
            }
        );

        res.status(201).json({
            message: `Procesamiento de diagnósticos completado.`,
            diagnosticosRegistrados: diagnosticosRegistrados.length,
            diagnosticosConError: diagnosticosConError.length,
            detalles: {
                exitosos: diagnosticosRegistrados,
                errores: diagnosticosConError
            },
            paciente: consultaRows[0].NOMBRE_APELLIDO
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error al registrar múltiples diagnósticos:", error);
        res.status(500).json({ 
            error: "Error interno del servidor.",
            details: error.message 
        });
    } finally {
        if (connection) connection.release();
    }
};