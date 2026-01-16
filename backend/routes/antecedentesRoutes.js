const express = require('express');
const router = express.Router();
const antecedentesController = require('../controllers/antecedentesController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/paciente/:dni/primera-consulta',
    verifyRole(['doctor', 'asistente', 'administrador']),
    antecedentesController.checkPrimeraConsulta
);

router.post('/paciente/:dni/antecedentes-completos',
    verifyRole(['doctor', 'administrador']),
    antecedentesController.crearAntecedentesCompletos
);

router.get('/paciente/:dni/antecedentes-completos',
    verifyRole(['doctor', 'asistente', 'administrador']),
    antecedentesController.obtenerAntecedentesCompletos
);

router.put('/paciente/:dni/antecedentes',
    verifyRole(['doctor', 'administrador']),
    antecedentesController.actualizarAntecedentes
);

router.delete('/paciente/:dni/antecedentes',
    verifyRole(['administrador']),
    antecedentesController.eliminarAntecedentes
);

module.exports = router;