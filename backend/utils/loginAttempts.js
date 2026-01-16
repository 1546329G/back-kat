const { logActivity, hashDNI } = require('./logActivity');

const colors = { reset: "\x1b[0m", yellow: "\x1b[33m", red: "\x1b[31m" };
const failedAttempts = {}; 
const MAX_ATTEMPTS = 3;
const BLOCK_DURATION_MS = 5 * 60 * 1000; 

const checkBlock = (dni) => {
    const hashedDNI = hashDNI(dni); 
    const attemptData = failedAttempts[hashedDNI];
    const now = Date.now();

    if (attemptData && attemptData.blockedUntil && attemptData.blockedUntil.getTime() > now) {
        const remainingTime = Math.ceil((attemptData.blockedUntil.getTime() - now) / 60000);
        return { blocked: true, remainingTime };
    }
    if (attemptData && attemptData.blockedUntil && attemptData.blockedUntil.getTime() <= now) {
         clearAttempts(dni);
    }
    
    return { blocked: false };
};

const handleFailedAttempt = async (dni, res) => {
    const hashedDNI = hashDNI(dni); 
    
    if (!failedAttempts[hashedDNI]) {
        failedAttempts[hashedDNI] = { count: 0, blockedUntil: null };
    }

    const attemptData = failedAttempts[hashedDNI];
    attemptData.count += 1;

    await logActivity(dni, 'LOGIN_FAILED', { reason: 'Credenciales inválidas, intento #' + attemptData.count });

    if (attemptData.count >= MAX_ATTEMPTS) {
        const blockUntil = new Date(Date.now() + BLOCK_DURATION_MS);
        attemptData.blockedUntil = blockUntil;
        attemptData.count = 0; 
        
        const remainingTime = Math.ceil(BLOCK_DURATION_MS / 60000);
        console.warn(`[${colors.red}ATTEMPT BLOCK${colors.reset}] DNI ${dni} (hashed: ${hashedDNI.substring(0, 8)}...) bloqueado hasta ${blockUntil.toISOString()}`);

        await logActivity(dni, 'ACCOUNT_BLOCKED', { duration_min: remainingTime });

        return res.status(429).json({
            error: `Se ha superado el límite de ${MAX_ATTEMPTS} intentos fallidos. Inténtelo de nuevo en ${remainingTime} minutos.`
        });
    }
    const remaining = MAX_ATTEMPTS - attemptData.count;
    
    return res.status(401).json({ 
        error: `Credenciales inválidas. Le quedan ${remaining} intentos antes de ser bloqueado.`
    });
};

const clearAttempts = (dni) => {
    const hashedDNI = hashDNI(dni); 
    if (failedAttempts[hashedDNI]) {
        delete failedAttempts[hashedDNI];
    }
};

module.exports = { checkBlock, handleFailedAttempt, clearAttempts };