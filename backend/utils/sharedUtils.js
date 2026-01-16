const { getPool } = require('../config/db');

exports.verificarPaciente = async (pool, dni) => {
    const [pacienteRows] = await pool.execute(
        "SELECT ID_FICHA_CLINICA, NOMBRE_APELLIDO, DNI FROM FICHA_CLINICA WHERE DNI = ?",
        [dni]
    );
    return pacienteRows;
};

exports.verificarPacientePorId = async (pool, idFichaClinica) => {
    const [pacienteRows] = await pool.execute(
        "SELECT ID_FICHA_CLINICA, NOMBRE_APELLIDO, DNI FROM FICHA_CLINICA WHERE ID_FICHA_CLINICA = ?",
        [idFichaClinica]
    );
    return pacienteRows;
};

exports.verificarSignosVitalesHoy = async (pool, idFichaClinica) => {
    const [signosRows] = await pool.execute(
        `SELECT ID_EXAMEN_CLINICO 
         FROM EXAMEN_CLINICO 
         WHERE ID_FICHA_CLINICA = ? 
         AND DATE(FECHA_REGISTRO) = CURDATE()
         ORDER BY FECHA_REGISTRO DESC LIMIT 1`,
        [idFichaClinica]
    );
    return signosRows;
};

exports.verificarEsPrimeraConsulta = async (pool, idFichaClinica) => {
    const [consultasRows] = await pool.execute(
        `SELECT COUNT(*) as total FROM CONSULTA 
         WHERE ID_FICHA_CLINICA = ? 
         AND ESTADO IN ('completada', 'pendiente')`,
        [idFichaClinica]
    );
    return consultasRows[0].total === 0;
};

exports.convertToBoolean = (value) => {
    if (value === undefined || value === null) return 0;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number") return value !== 0 ? 1 : 0;
    if (typeof value === "string") {
        const str = value.toLowerCase().trim();
        return str === "true" || str === "1" || str === "sí" ||
            str === "si" || str === "yes" || str === "verdadero" ? 1 : 0;
    }
    return 0;
};

exports.errorResponse = (res, statusCode, code, message, details = null) => {
    const response = {
        error: message,
        code: code
    };
    
    if (details && process.env.NODE_ENV === 'development') {
        response.details = details;
    }
    
    return res.status(statusCode).json(response);
};

exports.successResponse = (res, message, data = null, metadata = null) => {
    const response = {
        message: message,
        success: true
    };
    
    if (data !== null) response.data = data;
    if (metadata !== null) response.metadata = metadata;
    
    return res.json(response);
};

exports.calculateIMC = (peso, talla) => {
    if (peso && talla && talla > 0) {
        const alturaMetros = talla / 100;
        return (peso / (alturaMetros * alturaMetros)).toFixed(2);
    }
    return null;
};