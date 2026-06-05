// =============================================================================
// Kavana CleanOps — Auth Controller Tests
// Tests for src/controllers/authController.js
// =============================================================================

const httpMocks = require('node-mocks-http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Mock Prisma is already set up in setup.js
const { mockPrisma } = require('./setup');
const prisma = require('../lib/prisma');

const {
  login,
  register,
  verify,
  refresh,
  logout,
  cleanupExpiredTokens,
} = require('../controllers/authController');

describe('authController.login', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({ body: { email: 'test@kavana.com', password: '123456' } });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return 401 if user not found', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await login(req, res);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Credenciales inválidas.');
  });

  test('should return 403 if user is baja_medica', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      email: 'test@kavana.com',
      estado: 'baja_medica',
    });

    await login(req, res);

    expect(res.statusCode).toBe(403);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('baja médica');
  });

  test('should return 403 if user is inactivo', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      email: 'test@kavana.com',
      estado: 'inactivo',
    });

    await login(req, res);

    expect(res.statusCode).toBe(403);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('inactiva');
  });

  test('should return 401 if password is incorrect', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      email: 'test@kavana.com',
      password_hash: '$2a$12$hashedpassword',
      estado: 'activo',
      nombre: 'Test',
      rol: 'limpiador',
    });
    bcrypt.compare = jest.fn().mockResolvedValue(false);

    await login(req, res);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Credenciales inválidas.');
  });

  test('should return tokens and user data on successful login', async () => {
    const mockUser = {
      id_usuario: 1,
      nombre: 'Test User',
      email: 'test@kavana.com',
      password_hash: '$2a$12$hashedpassword',
      rol: 'limpiador',
      estado: 'activo',
    };

    mockPrisma.usuario.findUnique.mockResolvedValue(mockUser);
    bcrypt.compare = jest.fn().mockResolvedValue(true);
    jwt.sign = jest.fn().mockReturnValue('fake-jwt-token');
    crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('a'.repeat(64), 'hex'));

    mockPrisma.refreshToken.create.mockResolvedValue({
      token: 'a'.repeat(128),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await login(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.token).toBe('fake-jwt-token');
    expect(data.refreshToken).toBeDefined();
    expect(data.usuario).toBeDefined();
    expect(data.usuario.email).toBe('test@kavana.com');
    expect(data.usuario.password_hash).toBeUndefined(); // Should not expose hash
  });
});

describe('authController.register', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      body: {
        nombre: 'New User',
        email: 'new@kavana.com',
        password: '123456',
        rol: 'limpiador',
      },
      user: { id_usuario: 1, rol: 'admin' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return 409 if email already exists', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id_usuario: 1 });

    await register(req, res);

    expect(res.statusCode).toBe(409);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('ya está registrado');
  });

  test('should create user and return 201', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);
    bcrypt.genSalt = jest.fn().mockResolvedValue('salt');
    bcrypt.hash = jest.fn().mockResolvedValue('hashedpassword');

    mockPrisma.usuario.create.mockResolvedValue({
      id_usuario: 2,
      nombre: 'New User',
      email: 'new@kavana.com',
      rol: 'limpiador',
      estado: 'activo',
    });

    await register(req, res);

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res._getData());
    expect(data.usuario.email).toBe('new@kavana.com');
    expect(data.usuario.rol).toBe('limpiador');
  });
});

describe('authController.verify', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      user: { id_usuario: 1, email: 'test@kavana.com', rol: 'limpiador' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return user data for valid token', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({
      id_usuario: 1,
      nombre: 'Test User',
      email: 'test@kavana.com',
      rol: 'limpiador',
      estado: 'activo',
    });

    await verify(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.usuario).toBeDefined();
  });

  test('should return 404 if user not found', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await verify(req, res);

    expect(res.statusCode).toBe(404);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('no encontrado');
  });
});

describe('authController.refresh', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      body: { refreshToken: 'valid-refresh-token' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return 401 if refresh token not found', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Refresh token inválido.');
  });

  test('should return 401 if refresh token is revoked', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id_refresh_token: 1,
      revoked: true,
      expires_at: new Date(Date.now() + 100000),
    });

    await refresh(req, res);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Refresh token inválido.');
  });

  test('should rotate tokens on successful refresh', async () => {
    const mockStoredToken = {
      id_refresh_token: 1,
      token: 'old-refresh-token',
      revoked: false,
      expires_at: new Date(Date.now() + 100000),
      usuario: {
        id_usuario: 1,
        email: 'test@kavana.com',
        rol: 'limpiador',
        estado: 'activo',
        nombre: 'Test User',
      },
    };

    mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
    mockPrisma.refreshToken.update.mockResolvedValue({ ...mockStoredToken, revoked: true });
    jwt.sign = jest.fn().mockReturnValue('new-jwt-token');
    crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('b'.repeat(64), 'hex'));
    mockPrisma.refreshToken.create.mockResolvedValue({
      token: 'b'.repeat(128),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    await refresh(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.token).toBe('new-jwt-token');
    expect(data.refreshToken).toBeDefined();

    // Verify old token was revoked
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_refresh_token: 1 },
        data: { revoked: true },
      })
    );
  });
});

describe('authController.logout', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      body: { refreshToken: 'token-to-revoke' },
      user: { id_usuario: 1 },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return 400 if refreshToken missing', async () => {
    req.body = {};

    await logout(req, res);

    expect(res.statusCode).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('refreshToken es requerido');
  });

  test('should revoke token and return success', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id_refresh_token: 1,
      revoked: false,
    });
    mockPrisma.refreshToken.update.mockResolvedValue({
      id_refresh_token: 1,
      revoked: true,
    });

    await logout(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.message).toContain('Sesión cerrada');
  });

  test('should not fail if token not found', async () => {
    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

    await logout(req, res);

    expect(res.statusCode).toBe(200);
  });
});

describe('authController.cleanupExpiredTokens', () => {
  test('should delete expired and revoked tokens', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

    await cleanupExpiredTokens();

    expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { expires_at: { lt: expect.any(Date) } },
          { revoked: true },
        ],
      },
    });
  });

  test('should not throw if no tokens to clean', async () => {
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    await expect(cleanupExpiredTokens()).resolves.not.toThrow();
  });
});