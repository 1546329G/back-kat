require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression'); // <-- AGREGADO
const morgan = require('morgan'); // <-- AGREGADO
const { connectToDatabase } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const consultationRoutes = require('./routes/consultaRoutes');
const citaRoutes = require('./routes/citaRoutes');
const reportRoutes = require('./routes/reporteRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const antecedentesRoutes = require('./routes/antecedentesRoutes');
const examenFisicoRoutes = require('./routes/examenFisicoRoutes');
const signosVitalesRoutes = require('./routes/signosVitalesRoutes');
/*ola */
const app = express();
const PORT = process.env.PORT || 5000;

const colors = {
    reset: "\x1b[0m",
    bgBlue: "\x1b[44m",
    bgWhite: "\x1b[47m",
    green: "\x1b[32m",
    yellow: "\x1b[33m"
};
/*===*/

connectToDatabase();


if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined')); 
} else {
    app.use(morgan('dev')); 
}

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false, 
    crossOriginResourcePolicy: { policy: "cross-origin" } 
}));


app.use(compression());

const corsOptions = {
    origin: process.env.CLIENT_ORIGIN || [
        'http://localhost:3001', 
        'http://localhost:3000', 
        'https://administracion.ceinco.pe'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

const generalLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: process.env.NODE_ENV === 'production' ? 1000 : 5000,
    message: { 
        success: false,
        error: 'Demasiadas solicitudes desde esta IP. Intenta nuevamente en 15 minutos.' 
    },
    standardHeaders: true,
    legacyHeaders: false, 
});

const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 10 : 50, 
    message: { 
        success: false,
        error: 'Demasiados intentos de login. Intenta más tarde.' 
    },
    skipSuccessfulRequests: true, 
});

app.use(generalLimiter);
app.use('/api/auth/login', authLimiter);


app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${colors.yellow}[${new Date().toISOString()}]${colors.reset} ${req.method} ${req.url}`);
        next();
    });
}


app.use('/api/auth', authRoutes);
app.use('/api/paciente', pacienteRoutes);
app.use('/api/consulta', consultationRoutes);
app.use('/api/cita', citaRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/doctores', doctorRoutes);
app.use('/api/antecedentes', antecedentesRoutes);
app.use('/api/examen-fisico', examenFisicoRoutes);
app.use('/api/signos-vitales', signosVitalesRoutes);


app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.send('Servidor del Sistema de Historial Clínico (HIS) corriendo. Accede a auth/login para comenzar.');
});


app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            error: 'Error al subir archivo',
            message: err.message
        });
    }

    const statusCode = err.statusCode || 500;
    const response = {
        success: false,
        error: 'Error interno del servidor'
    };
    
    if (process.env.NODE_ENV !== 'production') {
        response.message = err.message;
        response.stack = err.stack;
    }
    
    res.status(statusCode).json(response);
});

app.use((req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'Ruta no encontrada',
        message: `La ruta ${req.url} no existe en este servidor.`
    });
});


const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log(`${colors.bgBlue}${colors.bgWhite} SERVIDOR INICIADO ${colors.reset}`);
    console.log('='.repeat(50));
    console.log(`${colors.green}✓${colors.reset} Puerto: ${PORT}`);
    console.log(`${colors.green}✓${colors.reset} Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`${colors.green}✓${colors.reset} Health: http://localhost:${PORT}/health`);
    console.log('='.repeat(50));
});

process.on('SIGTERM', () => {
    console.log('\nRecibido SIGTERM, cerrando servidor...');
    server.close(() => {
        console.log('Servidor cerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nRecibido SIGINT, cerrando servidor...');
    server.close(() => {
        console.log('Servidor cerrado');
        process.exit(0);
    });
});