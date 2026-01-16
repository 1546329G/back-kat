const { getPool } = require('../config/db');
const { logActivity } = require('../utils/logActivity');

const validateVitalSigns = (data) => {
    const errors = [];
    
    if (!data.idFichaClinica) errors.push('ID de ficha clínica es requerido');
    if (!data.pa) errors.push('Presión arterial (PA) es requerida');
    if (!data.pulso || data.pulso < 30 || data.pulso > 200) errors.push('Pulso debe estar entre 30-200');
    if (!data.peso || data.peso < 1 || data.peso > 300) errors.push('Peso debe estar entre 1-300 kg');
    if (!data.talla || data.talla < 0.5 || data.talla > 2.5) errors.push('Talla debe estar entre 0.5-2.5 m');
    
    return errors;
};

exports.registrarSignosVitales = async (req, res) => {
    const pool = getPool();
    const { 
        idFichaClinica, pa, pulso, tipoPulso, sao2, fr, peso, talla, temperatura
    } = req.body;

    console.log('Datos recibidos para signos vitales:', req.body);

    if (!idFichaClinica) {
        return res.status(400).json({ error: "ID de ficha clínica es requerido" });
    }

    const validationErrors = validateVitalSigns(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({ error: "Errores de validación:", details: validationErrors.join(', ') });
    }

    try {
        const imc = peso && talla ? (peso / (talla * talla)).toFixed(2) : null;
        
        const [result] = await pool.execute(
            `INSERT INTO EXAMEN_CLINICO 
            (ID_FICHA_CLINICA, PA, PULSO, TIPO_PULSO, SAO2, FR, PESO, TALLA, TEMPERATURA, IMC, FECHA_REGISTRO)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [idFichaClinica, pa, pulso, tipoPulso, sao2, fr, peso, talla, temperatura, imc]
        );

        const idExamenClinico = result.insertId;
        
        logActivity(`Registro de Signos Vitales (ID: ${idExamenClinico}) para Ficha ${idFichaClinica}`);

        res.status(201).json({ 
            message: "Signos vitales registrados con éxito.",
            idExamenClinico: idExamenClinico,
            datos: {
                pa, pulso, peso, talla, imc, temperatura,
                fechaRegistro: new Date()
            }
        });

    } catch (error) {
        console.error("Error al registrar signos vitales:", error);
        res.status(500).json({ error: "Error interno del servidor al registrar signos vitales." });
    }
};

exports.verificarSignosVitalesHoy = async (req, res) => {
    const pool = getPool();
    const { idFichaClinica } = req.params;

    if (!idFichaClinica) {
        return res.status(400).json({ error: "ID de ficha clínica es requerido." });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT ID_EXAMEN_CLINICO, PA, PULSO, PESO, TALLA, TEMPERATURA, IMC, FECHA_REGISTRO
             FROM EXAMEN_CLINICO 
             WHERE ID_FICHA_CLINICA = ? 
             AND DATE(FECHA_REGISTRO) = CURDATE()
             ORDER BY FECHA_REGISTRO DESC 
             LIMIT 1`,
            [idFichaClinica]
        );

        if (rows.length === 0) {
            return res.json({
                message: "No se encontraron signos vitales registrados para hoy.",
                tieneSignosVitalesHoy: false,
                datosSignosVitales: null
            });
        }

        res.json({
            message: "Signos vitales encontrados para hoy.",
            tieneSignosVitalesHoy: true,
            datosSignosVitales: rows[0]
        });

    } catch (error) {
        console.error("Error al verificar signos vitales hoy:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

exports.obtenerSignosVitalesPorId = async (req, res) => {
    const pool = getPool();
    const { idExamenClinico } = req.params;

    if (!idExamenClinico) {
        return res.status(400).json({ error: "ID de Examen Clínico es requerido." });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT * FROM EXAMEN_CLINICO WHERE ID_EXAMEN_CLINICO = ?`,
            [idExamenClinico]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Signos vitales no encontrados." });
        }

        res.json({
            message: "Signos vitales recuperados con éxito.",
            data: rows[0]
        });

    } catch (error) {
        console.error("Error al obtener signos vitales por ID:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};