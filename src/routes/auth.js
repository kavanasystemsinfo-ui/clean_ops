// =============================================================================
// Kavana CleanOps — Auth Routes
//   POST   /api/v1/auth/login     → Iniciar sesión (público)
//   POST   /api/v1/auth/register  → Registrar usuario (admin only)
//   GET    /api/v1/auth/verify    → Verificar token (autenticado)
//   POST   /api/v1/auth/refresh   → Renovar access token (público)
//   POST   /api/v1/auth/logout    → Revocar refresh token (autenticado)
// =============================================================================

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, loginSchema, registerSchema, refreshSchema } = require('../middleware/validate');
const authController = require('../controllers/authController');

const router = Router();

// Público
router.post('/login', validate(loginSchema), authController.login);

router.post('/refresh', validate(refreshSchema), authController.refresh);

// Admin only
router.post('/register', authenticate, authorize('admin'), validate(registerSchema), authController.register);

// Autenticado
router.get('/verify', authenticate, authController.verify);
router.post('/logout', authenticate, authController.logout);

module.exports = router;