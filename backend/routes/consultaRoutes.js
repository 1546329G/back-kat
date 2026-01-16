const express = require('express');
const router = express.Router();
const consultaController = require('../controllers/consultaController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(verifyToken);

// Ruta para verificar requisitos antes de iniciar consulta
router.get('/requisitos/:idFichaClinica',
    verifyRole(['doctor', 'asistente','administrador']),
    consultaController.verificarRequisitosConsulta
);

// Rutas para gestión de consultas
router.post('/iniciar',
    verifyRole(['doctor','administrador']),
    consultaController.iniciarConsulta
);

router.get('/:idConsulta/estado',
    verifyRole(['doctor', 'asistente','administrador']),
    consultaController.obtenerEstadoConsulta
);

router.get('/:idConsulta/completa',
    verifyRole(['doctor','administrador']),
    consultaController.obtenerConsultaCompleta
);

router.put('/:idConsulta/finalizar',
    verifyRole(['doctor','administrador']),
    consultaController.finalizarConsulta
);

router.put('/:idConsulta/cancelar',
    verifyRole(['doctor', 'administrador']),
    consultaController.cancelarConsulta
);

// Rutas para el flujo paso a paso de la consulta
router.get('/:idConsulta/signos-vitales',
    verifyRole(['doctor', 'asistente','administrador']),
    consultaController.obtenerSignosVitales
);

router.put('/:idConsulta/relato',
    verifyRole(['doctor','administrador']),
    consultaController.guardarRelato
);

router.get('/:idConsulta/antecedentes',
    verifyRole(['doctor', 'asistente','administrador']),
    consultaController.obtenerAntecedentes
);

router.put('/:idConsulta/examen-fisico',
    verifyRole(['doctor','administrador']),
    consultaController.guardarExamenFisico
);

router.put('/:idConsulta/plan-trabajo',
    verifyRole(['doctor','administrador']),
    consultaController.guardarPlanTrabajo
);

// Rutas para diagnóstico
router.get('/diagnosticos/buscar',
    verifyRole(['doctor', 'asistente','administrador']),
    consultaController.buscarDiagnosticos
);

router.post('/:idConsulta/diagnosticos',
    verifyRole(['doctor','administrador']),
    consultaController.agregarDiagnostico
);

router.get('/:idConsulta/diagnosticos',
    verifyRole(['doctor', 'asistente','administrador']),
    consultaController.obtenerDiagnosticos
);

router.delete('/:idConsulta/diagnosticos/:idDiagnosticoConsulta',
    verifyRole(['doctor','administrador']),
    consultaController.eliminarDiagnostico
);

// Rutas para recetas
router.get('/medicamentos/buscar',
    verifyRole(['doctor', 'asistente','administrador']),
    consultaController.buscarMedicamentos
);

router.post('/:idConsulta/recetas',
    verifyRole(['doctor','administrador']),
    consultaController.crearReceta
);

router.get('/:idConsulta/recetas',
    verifyRole(['doctor', 'asistente','administrador']),
    consultaController.obtenerReceta
);

module.exports = router;