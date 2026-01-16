const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../config/db');
const { logActivity } = require('../utils/logActivity');
const { checkBlock, handleFailedAttempt, clearAttempts } = require('../utils/loginAttempts');
const { rol_valido } = require('../middleware/authMiddleware');

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    reset: '\x1b[0m'
};

const validateUserInput = (dni, contrasena, cargo) => {
    const errors = [];
    if (!dni || dni.length !== 8) errors.push('DNI debe tener 8 dígitos');
    if (!contrasena || contrasena.length < 6) errors.push('Contraseña debe tener al menos 6 caracteres');
    if (!cargo || !rol_valido.includes(cargo)) errors.push(`Cargo debe ser uno de: ${rol_valido.join(', ')}`);
    return errors;
};

exports.register = async (req, res) => {
    const { dni, nombre = null, apellido = null, cargo, contrasena } = req.body;

    const validationErrors = validateUserInput(dni, contrasena, cargo);
    if (validationErrors.length > 0) {
        return res.status(400).json({ 
            error: validationErrors.join(', ') 
        });
    }

    try {
        const pool = getPool();
        
        const [existingUser] = await pool.execute(
            "SELECT DNI FROM USUARIOS WHERE DNI = ?",
            [dni]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({ 
                error: `Ya existe un usuario con el DNI ${dni}.` 
            });
        }

        const salt = await bcrypt.genSalt(12);
        const contrasena_hash = await bcrypt.hash(contrasena, salt);

        await pool.execute(
            "INSERT INTO USUARIOS (DNI, NOMBRE, APELLIDO, CARGO, CONTRASENA, ESTADO) VALUES (?, ?, ?, ?, ?, 1)",
            [dni, nombre, apellido, cargo, contrasena_hash]
        );

        await logActivity(req.user.dni, 'USER_REGISTERED', { newUserDni: dni, role: cargo });
        
        console.log(`${colors.green}Usuario registrado: ${dni} - Rol: ${cargo}${colors.reset}`);
        res.status(201).json({ 
            message: `Usuario ${cargo} registrado exitosamente.`,
            registered: true 
        });
            
    } catch (error) {
        console.error(`${colors.red}Error al registrar usuario:${colors.reset}`, error);
        res.status(500).json({ 
            error: "Error interno del servidor." 
        });
    }
};

exports.login = async (req, res) => {
    const { dni, contrasena } = req.body;

    if (!dni || !contrasena) {
        return res.status(400).json({ 
            error: 'DNI y contraseña son obligatorios.' 
        });
    }

    const blockState = checkBlock(dni);
    if (blockState.blocked) {
        return res.status(429).json({
            error: `Cuenta bloqueada. Intente nuevamente en ${blockState.remainingTime} minutos.`
        });
    }

    try {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT ID_USUARIO, DNI, CONTRASENA, CARGO, ESTADO FROM USUARIOS WHERE DNI = ?',
            [dni]
        );

        const user = rows[0];
        
        if (!user) {
            return handleFailedAttempt(dni, res);
        }

        if (user.ESTADO === 0) {
            return res.status(403).json({ 
                error: 'Usuario deshabilitado. Contacte al administrador.' 
            });
        }

        const isMatch = await bcrypt.compare(contrasena, user.CONTRASENA);
        if (!isMatch) {
            return handleFailedAttempt(dni, res);
        }

        clearAttempts(dni);
        const sessionId = uuidv4();

        const token = jwt.sign(
            { 
                id: user.ID_USUARIO, 
                dni: user.DNI, 
                cargo: user.CARGO, 
                sid: sessionId 
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        await pool.execute(
            'UPDATE USUARIOS SET ULTIMA_SESION_TOKEN_ID = ? WHERE DNI = ?',
            [sessionId, dni]
        );

        await logActivity(dni, 'LOGIN_SUCCESS', { role: user.CARGO });

        console.log(`${colors.green}Login exitoso: ${dni} (${user.CARGO})${colors.reset}`);
        res.status(200).json({ 
            token, 
            cargo: user.CARGO,
            user: {
                id: user.ID_USUARIO,
                dni: user.DNI,
                nombre: user.NOMBRE,
                apellido: user.APELLIDO
            },
            login: true
        });

    } catch (error) {
        console.error(`${colors.red}Error en login:${colors.reset}`, error);
        res.status(500).json({ 
            error: 'Error interno del servidor.' 
        });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT ID_USUARIO, DNI, NOMBRE, APELLIDO, CARGO, ESTADO, FECHA_CREACION FROM USUARIOS WHERE DNI = ?',
            [req.user.dni]
        );

        const user = rows[0];
        if (!user) {
            return res.status(404).json({ 
                error: 'Usuario no encontrado.'
            });
        }

        res.json({
            id: user.ID_USUARIO,
            dni: user.DNI,
            nombre: user.NOMBRE,
            apellido: user.APELLIDO,
            cargo: user.CARGO,
            estado: user.ESTADO,
            fecha_creacion: user.FECHA_CREACION,
            found: true
        });

    } catch (error) {
        console.error(`${colors.red}Error al obtener perfil:${colors.reset}`, error);
        res.status(500).json({ 
            error: 'Error interno del servidor.'
        });
    }
};

exports.changePassword = async (req, res) => {
    if (!req.user || !req.user.dni) {
        return res.status(401).json({ 
            error: 'Usuario no autenticado. Token requerido.'
        });
    }

    const { dni } = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
            error: 'Contraseña actual y nueva son obligatorias.'
        });
    }

    if (currentPassword === newPassword) {
        return res.status(400).json({ 
            error: 'La nueva contraseña debe ser diferente.'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ 
            error: 'La nueva contraseña debe tener al menos 6 caracteres.'
        });
    }

    try {
        const pool = getPool();
        const [rows] = await pool.execute(
            'SELECT CONTRASENA FROM USUARIOS WHERE DNI = ?',
            [dni]
        );

        const user = rows[0];
        if (!user) {
            return res.status(404).json({ 
                error: 'Usuario no encontrado.'
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.CONTRASENA);
        if (!isMatch) {
            await logActivity(dni, 'PASSWORD_CHANGE_FAILED', { reason: 'Contraseña actual incorrecta' });
            return res.status(401).json({ 
                error: 'Contraseña actual incorrecta.'
            });
        }

        const salt = await bcrypt.genSalt(12);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        await pool.execute(
            'UPDATE USUARIOS SET CONTRASENA = ? WHERE DNI = ?',
            [newPasswordHash, dni]
        );

        await logActivity(dni, 'PASSWORD_CHANGED_SUCCESS');
        console.log(`${colors.green}Contraseña cambiada: ${dni}${colors.reset}`);
        res.status(200).json({ 
            message: 'Contraseña actualizada exitosamente.',
            changed: true 
        });

    } catch (error) {
        console.error(`${colors.red}Error al cambiar contraseña:${colors.reset}`, error);
        res.status(500).json({ 
            error: 'Error interno del servidor.'
        });
    }
};

exports.toggleUserStatus = async (req, res) => {
    const adminDni = req.user.dni;
    const { dniToToggle, status } = req.body;

    if (!dniToToggle || status === undefined) {
        return res.status(400).json({ 
            error: 'DNI y estado son obligatorios.'
        });
    }

    const newStatus = parseInt(status, 10);
    if (newStatus !== 0 && newStatus !== 1) {
        return res.status(400).json({ 
            error: 'Estado debe ser 0 (Inactivo) o 1 (Activo).'
        });
    }

    try {
        const pool = getPool();
    
        if (adminDni === dniToToggle) {
            return res.status(400).json({ 
                error: 'No puede cambiar su propio estado.'
            });
        }
        const [targetUser] = await pool.execute(
            'SELECT CARGO, ESTADO FROM USUARIOS WHERE DNI = ?',
            [dniToToggle]
        );

        if (targetUser.length === 0) {
            return res.status(404).json({ 
                error: `Usuario con DNI ${dniToToggle} no encontrado.`
            });
        }
        if (targetUser[0].CARGO === 'administrador' && req.user.cargo !== 'administrador') {
            return res.status(403).json({ 
                error: 'No tiene permisos para modificar administradores.'
            });
        }
        if (targetUser[0].ESTADO === newStatus) {
            const estadoTexto = newStatus === 1 ? 'activo' : 'inactivo';
            return res.status(400).json({ 
                error: `El usuario ya se encuentra ${estadoTexto}.`
            });
        }

        const [result] = await pool.execute(
            'UPDATE USUARIOS SET ESTADO = ? WHERE DNI = ?',
            [newStatus, dniToToggle]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                error: `Usuario con DNI ${dniToToggle} no encontrado.`
            });
        }

        const action = newStatus === 1 ? 'USER_ENABLED' : 'USER_DISABLED';
        const message = newStatus === 1 ? 'habilitado' : 'deshabilitado';

        await logActivity(adminDni, action, { 
            targetDni: dniToToggle, 
            newStatus,
            targetRole: targetUser[0].CARGO 
        });

        console.log(`${colors.green}Estado cambiado: ${dniToToggle} -> ${message} por ${adminDni}${colors.reset}`);
        res.status(200).json({ 
            message: `Usuario ${dniToToggle} ${message} exitosamente.`,
            toggled: true,
            newStatus,
            targetUser: {
                dni: dniToToggle,
                cargo: targetUser[0].CARGO,
                previousStatus: targetUser[0].ESTADO
            }
        });

    } catch (error) {
        console.error(`${colors.red}Error al cambiar estado:${colors.reset}`, error);
        res.status(500).json({ 
            error: 'Error interno del servidor.'
        });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const pool = getPool();
        
        const [rows] = await pool.execute(
            `SELECT 
                ID_USUARIO, 
                DNI, 
                NOMBRE, 
                APELLIDO, 
                CARGO, 
                ESTADO,
                FECHA_CREACION,
                ULTIMA_SESION_TOKEN_ID
             FROM USUARIOS 
             ORDER BY CARGO, APELLIDO, NOMBRE`
        );

        if (rows.length === 0) {
            return res.status(404).json({ 
                error: "No se encontraron usuarios registrados."
            });
        }

        const usuarios = rows.map(usuario => ({
            id: usuario.ID_USUARIO,
            dni: usuario.DNI,
            nombre: usuario.NOMBRE,
            apellido: usuario.APELLIDO,
            cargo: usuario.CARGO,
            estado: usuario.ESTADO,
            fecha_creacion: usuario.FECHA_CREACION,
            ultima_sesion_token_id: usuario.ULTIMA_SESION_TOKEN_ID
        }));

        await logActivity(
            req.user.dni,
            'USERS_LIST_ACCESSED',
            { total: usuarios.length, role: req.user.cargo }
        );

        console.log(`${colors.green}Lista de usuarios consultada por: ${req.user.dni} (${req.user.cargo}) - Total: ${usuarios.length}${colors.reset}`);
        
        res.json({
            message: "Lista de usuarios recuperada con éxito.",
            data: usuarios,
            total: usuarios.length
        });

    } catch (error) {
        console.error(`${colors.red}Error al obtener lista de usuarios:${colors.reset}`, error);
        res.status(500).json({ 
            error: "Error interno del servidor al obtener la lista de usuarios." 
        });
    }
};