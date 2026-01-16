const express = require('express');
const router = express.Router();
const citaController = require('../controllers/citaController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/', 
    verifyRole(['asistente','administrador']), 
    citaController.createCita
);

router.get('/today', 
    verifyRole(['doctor','administrador']), 
    citaController.getTodayCita
);

router.get('/', 
    verifyRole(['asistente','administrador']), 
    citaController.getAllCitas
);

router.get('/doctor/:idDoctor', 
    verifyRole(['asistente','administrador']), 
    citaController.getCitasByDoctor
);

router.get('/paciente/:dniPaciente', 
    verifyRole(['administrador', 'doctor', 'asistente']), 
    citaController.getCitasByPaciente
);

router.get('/proximas', 
    verifyRole(['administrador', 'doctor', 'asistente']), 
    citaController.getProximasCitas
);

router.put('/estado/:idCita', 
    verifyRole(['doctor','administrador']), 
    citaController.updateCitaStatus
);

router.put('/:idCita', 
    verifyRole(['asistente','administrador']), 
    citaController.editCita
);

router.patch('/:idCita', 
    verifyRole(['asistente','administrador']), 
    citaController.editCita
);

router.delete('/:idCita', 
    verifyRole(['asistente','administrador']), 
    citaController.deleteCita
);

module.exports = router;