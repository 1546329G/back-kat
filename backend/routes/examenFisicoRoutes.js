const express = require('express');
const router = express.Router();
const examenFisicoController = require('../controllers/examenfisicoController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/registrar',
    verifyRole(['doctor', 'administrador']),
    examenFisicoController.registrarExamenFisico
);

router.get('/consulta/:idConsulta',
    verifyRole(['doctor', 'asistente', 'administrador']),
    examenFisicoController.obtenerExamenFisico
);

router.get('/consulta/:idConsulta/verificar',
    verifyRole(['doctor', 'asistente', 'administrador']),
    examenFisicoController.verificarExamenFisico
);

router.put('/consulta/:idConsulta/observaciones',
    verifyRole(['doctor', 'administrador']),
    examenFisicoController.actualizarObservacionesExamen
);

router.get('/consulta/:idConsulta/resumen',
    verifyRole(['doctor', 'asistente', 'administrador']),
    examenFisicoController.obtenerResumenExamenFisico
);

module.exports = router;
