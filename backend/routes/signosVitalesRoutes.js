const express = require('express');
const router = express.Router();
const signosVitalesController = require('../controllers/signosvitalesController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/signos-vitales',
    verifyRole(['asistente', 'administrador']),
    signosVitalesController.registrarSignosVitales
);

router.get('/signos-vitales/hoy/ficha/:idFichaClinica',
    verifyRole(['asistente', 'doctor', 'administrador']),
    signosVitalesController.verificarSignosVitalesHoy
);

router.get('/signos-vitales/:idExamenClinico',
    verifyRole(['asistente', 'doctor', 'administrador']),
    signosVitalesController.obtenerSignosVitalesPorId
);

module.exports = router;