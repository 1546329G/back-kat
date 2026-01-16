const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reporteController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const { DOCTOR, ADMIN } = require('../config/roles');

router.get('/diagnostico', verifyToken, verifyRole(DOCTOR , ADMIN), reportController.generateDiagnosticoReporte);
module.exports = router;