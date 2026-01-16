const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/', 
    verifyRole(['administrador', 'doctor', 'asistente']), 
    pacienteController.createPaciente
);

router.get('/vista', 
    verifyRole(['administrador', 'doctor', 'asistente']), 
    pacienteController.getPacientesVista
);

router.get('/buscar/:query', 
    verifyRole(['administrador', 'doctor', 'asistente']), 
    pacienteController.searchPacientes
);

router.get('/:idFichaClinica', 
    verifyRole(['administrador', 'doctor', 'asistente']), 
    pacienteController.getPacienteById
);

router.get('/dni/:dni', 
    verifyRole(['administrador', 'doctor', 'asistente']), 
    pacienteController.getPatientFullDetailByDni
);
router.get('/buscar/:dni', 
  verifyRole(['administrador', 'doctor', 'asistente']), 
  pacienteController.buscarPacientePorDNI
);

router.get('/:dni/consultas', 
    verifyRole(['administrador', 'doctor']), 
    pacienteController.getConsultasPaciente
);

router.put('/:dni', 
    verifyRole(['administrador', 'doctor', 'asistente']), 
    pacienteController.updatePaciente
);

router.post('/:dni/examen-clinico', pacienteController.addExamenClinico);
router.post('/:dni/examen-auxiliar', pacienteController.addExamenAuxiliar
);

// Ruta para descargar historial
router.get('/:dni/historial/download', pacienteController.downloadHistorialClinico);

module.exports = router;