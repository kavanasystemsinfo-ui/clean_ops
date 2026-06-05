// =============================================================================
// Kavana CleanOps — Authentication Controller
//   - login:    Valida credenciales y devuelve JWT + refresh token
//   - register: Crea un nuevo usuario (solo admin)
//   - verify:   Verifica que el token sea válido y devuelve datos del usuario
//   - refresh:  Emite un nuevo access token usando refresh token
//   - logout:   Revoca un refresh token
// =============================================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const logger = require('../lib/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateAccessToken(usuario) {
  return jwt.sign(
    { id_usuario: usuario.id_usuario, email: usuario.email, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

async function generateRefreshToken(usuario) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: {
      id_usuario: usuario.id_usuario,
      token,
      expires_at: expiresAt,
    },
  });

  return { token, expires_at: expiresAt };
}

function sanitizeUser(usuario) {
  return {
    id_usuario: usuario.id_usuario,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    estado: usuario.estado,
  };
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------
async function login(req, res) {
  try {
    const { email, password } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      logger.warn('Intento de login con email inexistente', { email });
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (usuario.estado !== 'activo') {
      logger.warn('Intento de login con cuenta no activa', {
        email,
        estado: usuario.estado,
      });
      return res.status(403).json({
        error: `Cuenta ${usuario.estado === 'baja_medica' ? 'de baja médica' : 'inactiva'}. Contacte al administrador.`,
      });
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      logger.warn('Intento de login con contraseña incorrecta', { email });
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const accessToken = generateAccessToken(usuario);
    const refreshToken = await generateRefreshToken(usuario);

    logger.info('Login exitoso', {
      id_usuario: usuario.id_usuario,
      email: usuario.email,
      rol: usuario.rol,
    });

    res.json({
      token: accessToken,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: refreshToken.expires_at,
      usuario: sanitizeUser(usuario),
    });
  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register (solo admin)
// ---------------------------------------------------------------------------
async function register(req, res) {
  try {
    const { nombre, email, password, rol } = req.body;

    const rolesValidos = ['limpiador', 'supervisor', 'admin'];
    const rolAsignado = rol && rolesValidos.includes(rol) ? rol : 'limpiador';

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      logger.warn('Intento de registrar email existente', { email });
      return res.status(409).json({ error: 'El email ya está registrado.' });
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        password_hash,
        rol: rolAsignado,
        estado: 'activo',
      },
      select: {
        id_usuario: true,
        nombre: true,
        email: true,
        rol: true,
        estado: true,
      },
    });

    logger.info('Usuario registrado exitosamente', {
      id_usuario: usuario.id_usuario,
      email: usuario.email,
      rol: usuario.rol,
    });

    res.status(201).json({ usuario });
  } catch (error) {
    logger.error('Error en register:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/auth/verify
// ---------------------------------------------------------------------------
async function verify(req, res) {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: req.user.id_usuario },
      select: {
        id_usuario: true,
        nombre: true,
        email: true,
        rol: true,
        estado: true,
      },
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    res.json({ usuario });
  } catch (error) {
    logger.error('Error en verify:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// Body: { refreshToken: string }
// ---------------------------------------------------------------------------
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;

    // Buscar token en BD
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { usuario: true },
    });

    if (!storedToken) {
      logger.warn('Refresh token no encontrado');
      return res.status(401).json({ error: 'Refresh token inválido.' });
    }

    if (storedToken.revoked) {
      logger.warn('Refresh token ya revocado', {
        id_refresh_token: storedToken.id_refresh_token,
      });
      return res.status(401).json({ error: 'Refresh token inválido.' });
    }

    if (new Date() > storedToken.expires_at) {
      logger.warn('Refresh token expirado', {
        id_refresh_token: storedToken.id_refresh_token,
      });
      // Limpiar token expirado
      await prisma.refreshToken.update({
        where: { id_refresh_token: storedToken.id_refresh_token },
        data: { revoked: true },
      });
      return res.status(401).json({ error: 'Refresh token expirado. Inicie sesión nuevamente.' });
    }

    const usuario = storedToken.usuario;

    if (usuario.estado !== 'activo') {
      return res.status(403).json({
        error: `Cuenta ${usuario.estado === 'baja_medica' ? 'de baja médica' : 'inactiva'}.`,
      });
    }

    // Revocar el refresh token usado (rotación)
    await prisma.refreshToken.update({
      where: { id_refresh_token: storedToken.id_refresh_token },
      data: { revoked: true },
    });

    // Emitir nuevos tokens
    const newAccessToken = generateAccessToken(usuario);
    const newRefreshToken = await generateRefreshToken(usuario);

    logger.info('Tokens renovados exitosamente', {
      id_usuario: usuario.id_usuario,
      email: usuario.email,
    });

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken.token,
      refreshTokenExpiresAt: newRefreshToken.expires_at,
      usuario: sanitizeUser(usuario),
    });
  } catch (error) {
    logger.error('Error en refresh:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// Body: { refreshToken: string }
// ---------------------------------------------------------------------------
async function logout(req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken es requerido.' });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (storedToken && !storedToken.revoked) {
      await prisma.refreshToken.update({
        where: { id_refresh_token: storedToken.id_refresh_token },
        data: { revoked: true },
      });
      logger.info('Sesión cerrada — refresh token revocado', {
        id_usuario: req.user?.id_usuario,
      });
    }

    res.json({ message: 'Sesión cerrada correctamente.' });
  } catch (error) {
    logger.error('Error en logout:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// Cleanup programado de refresh tokens expirados/revocados
// (llamar periódicamente desde un cron)
// ---------------------------------------------------------------------------
async function cleanupExpiredTokens() {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expires_at: { lt: new Date() } },
          { revoked: true },
        ],
      },
    });
    if (result.count > 0) {
      logger.info(`Tokens expirados/revocados eliminados: ${result.count}`);
    }
  } catch (error) {
    logger.error('Error en cleanup de refresh tokens:', error);
  }
}

module.exports = {
  login,
  register,
  verify,
  refresh,
  logout,
  cleanupExpiredTokens,
};