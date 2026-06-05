// =============================================================================
// Kavana CleanOps — JWT Authentication & Role Authorization Middleware
// =============================================================================

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// ---------------------------------------------------------------------------
// authenticate — Verifica que el token JWT sea válido y añade usuario a req
// ---------------------------------------------------------------------------
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id_usuario: decoded.id_usuario,
      email: decoded.email,
      rol: decoded.rol,
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Inicie sesión nuevamente.' });
    }
    return res.status(401).json({ error: 'Token inválido.' });
  }
}

// ---------------------------------------------------------------------------
// authorize — Middleware factory: verifica que el rol del usuario esté entre
//            los permitidos para la ruta.
//   Uso: router.get('/ruta', authorize('supervisor', 'admin'), handler)
// ---------------------------------------------------------------------------
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    if (!allowedRoles.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${allowedRoles.join(' o ')}.`,
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };