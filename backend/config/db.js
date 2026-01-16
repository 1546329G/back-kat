const mysql = require('mysql2/promise');
require('dotenv').config();

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
};

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
};

let pool;

async function connectToDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log(`${colors.green}Conexión a MariaDB establecida exitosamente.${colors.reset}`);
        return pool;
    } catch (error) {
        console.error(`${colors.red}Error al conectar a la base de datos:`, error.message, `${colors.reset}`);
        process.exit(1);
    }
}

function getPool() {
    if (!pool) {
        throw new Error("El pool de la base de datos no está inicializado.");
    }
    return pool;
}

module.exports = { connectToDatabase, getPool };