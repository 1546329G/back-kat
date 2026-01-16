const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const {ADMIN } = require('../config/roles');

router.post('/register',  verifyToken, verifyRole(ADMIN), authController.register);
router.post('/login', authController.login);
router.get('/profile', verifyToken, authController.getProfile);
router.put('/contrasena', verifyToken ,authController.changePassword);
router.put('/actestado', verifyToken, verifyRole(ADMIN), authController.toggleUserStatus);
router.get('/usuarios', verifyToken, verifyRole(ADMIN), authController.getAllUsers);

module.exports = router;