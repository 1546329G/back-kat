const express = require('express');
const router = express.Router();
const diagnosticoController = require('../controllers/diagnosticoController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/consulta/:idConsulta/diagnosticos-secundarios',
    verifyRole(['doctor', 'administrador']),
    diagnosticoController.agregarDiagnosticoSecundario
);

router.get('/consulta/:idConsulta/diagnosticos',
    verifyRole(['doctor', 'administrador', 'asistente']),
    diagnosticoController.obtenerDiagnosticosConsulta
);

router.delete('/consulta/:idConsulta/diagnosticos-secundarios/:idDiagnosticoSecundario',
    verifyRole(['doctor', 'administrador']),
    diagnosticoController.eliminarDiagnosticoSecundario
);

router.get('/cie10/busqueda-avanzada',
    verifyRole(['doctor', 'administrador']),
    diagnosticoController.buscarCIE10Avanzado
);

router.get('/cie10/categorias',
    verifyRole(['doctor', 'administrador', 'asistente']),
    diagnosticoController.obtenerCategoriasCIE10
);

router.get('/cie10/:codigo',
    verifyRole(['doctor', 'administrador', 'asistente']),
    diagnosticoController.obtenerDiagnosticoPorCodigo
);

router.post('/diagnosticos-multiples',
    verifyRole(['doctor', 'administrador']),
    diagnosticoController.agregarMultiplesDiagnosticos
);

module.exports = router;