// =============================================================================
// Kavana CleanOps — Auth Middleware Tests
// Tests for src/middleware/auth.js
// =============================================================================

const httpMocks = require('node-mocks-http');

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const jwt = require('jsonwebtoken');

const { authenticate, authorize } = require('../middleware/auth');

describe('authenticate middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('should return 401 if no authorization header', () => {
    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Token no proporcionado');
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is expired', () => {
    req.headers.authorization = 'Bearer expired.token.here';
    jwt.verify.mockImplementation(() => {
      throw { name: 'TokenExpiredError' };
    });

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Token expirado');
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token is invalid', () => {
    req.headers.authorization = 'Bearer invalid.token.here';
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    authenticate(req, res, next);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Token inválido');
    expect(next).not.toHaveBeenCalled();
  });

  test('should accept token without Bearer prefix', () => {
    req.headers.authorization = 'rawtoken';
    const decoded = { id_usuario: 1, email: 'test@test.com', rol: 'limpiador' };
    jwt.verify.mockReturnValue(decoded);

    authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('rawtoken', expect.any(String));
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(decoded);
  });

  test('should set req.user and call next for valid token', () => {
    req.headers.authorization = 'Bearer valid.jwt.token';
    const decoded = { id_usuario: 1, email: 'test@test.com', rol: 'limpiador' };
    jwt.verify.mockReturnValue(decoded);

    authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid.jwt.token', expect.any(String));
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id_usuario: 1,
      email: 'test@test.com',
      rol: 'limpiador',
    });
  });
});

describe('authorize middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();
  });

  test('should return 401 if req.user is not set', () => {
    const middleware = authorize('supervisor', 'admin');

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('No autenticado');
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 if role is not allowed', () => {
    req.user = { id_usuario: 1, rol: 'limpiador' };
    const middleware = authorize('supervisor', 'admin');

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Acceso denegado');
    expect(data.error).toContain('supervisor');
    expect(data.error).toContain('admin');
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next if role is allowed (supervisor)', () => {
    req.user = { id_usuario: 2, rol: 'supervisor' };
    const middleware = authorize('supervisor', 'admin');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should call next if role is allowed (admin)', () => {
    req.user = { id_usuario: 3, rol: 'admin' };
    const middleware = authorize('supervisor', 'admin');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should work with single allowed role', () => {
    req.user = { id_usuario: 1, rol: 'limpiador' };
    const middleware = authorize('limpiador');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
