// =============================================================================
// Kavana CleanOps — Asignacion Controller Tests
// Tests for src/controllers/asignacionController.js
// =============================================================================

const httpMocks = require('node-mocks-http');
const { mockPrisma } = require('./setup');
const prisma = require('../lib/prisma');

const {
  getActive,
  list,
  create,
  update,
} = require('../controllers/asignacionController');

describe('asignacionController.getActive', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      user: { id_usuario: 1, email: 'test@kavana.com', rol: 'limpiador' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return active center for user', async () => {
    const mockAsignacion = {
      id_asignacion: 1,
      id_usuario: 1,
      id_centro: 1,
      fecha_inicio: new Date('2026-01-01'),
      fecha_fin: null,
      centro: { id_centro: 1, nombre_centro: 'CEIP San Juan', direccion: 'Calle Mayor 15' },
    };

    mockPrisma.asignacionPersonal.findFirst.mockResolvedValue(mockAsignacion);

    await getActive(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.asignacion).toBeDefined();
    expect(data.asignacion.centro.nombre_centro).toBe('CEIP San Juan');
  });

  test('should return 404 if no active assignment', async () => {
    mockPrisma.asignacionPersonal.findFirst.mockResolvedValue(null);

    await getActive(req, res);

    expect(res.statusCode).toBe(404);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('No tienes un centro activo');
  });
});

describe('asignacionController.list', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      query: {},
      user: { id_usuario: 1, rol: 'supervisor' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return all asignaciones', async () => {
    const mockAsignaciones = [
      {
        id_asignacion: 1,
        id_usuario: 1,
        id_centro: 1,
        fecha_inicio: new Date('2026-01-01'),
        fecha_fin: null,
        usuario: { id_usuario: 1, nombre: 'Carlos López', email: 'carlos@kavana.com', rol: 'limpiador' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
      },
    ];

    mockPrisma.asignacionPersonal.findMany.mockResolvedValue(mockAsignaciones);

    await list(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.asignaciones).toHaveLength(1);
    expect(data.asignaciones[0].usuario.nombre).toBe('Carlos López');
  });

  test('should filter by usuario query param', async () => {
    req.query.usuario = '2';

    mockPrisma.asignacionPersonal.findMany.mockResolvedValue([]);

    await list(req, res);

    expect(mockPrisma.asignacionPersonal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_usuario: 2 },
      })
    );
  });

  test('should filter by centro query param', async () => {
    req.query.centro = '1';

    mockPrisma.asignacionPersonal.findMany.mockResolvedValue([]);

    await list(req, res);

    expect(mockPrisma.asignacionPersonal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_centro: 1 },
      })
    );
  });
});

describe('asignacionController.create', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      body: {
        id_usuario: 1,
        id_centro: 1,
        fecha_inicio: '2026-07-01',
        fecha_fin: '2026-08-01',
      },
      user: { id_usuario: 2, rol: 'supervisor' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return 404 if user not found', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue(null);

    await create(req, res);

    expect(res.statusCode).toBe(404);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Usuario no encontrado');
  });

  test('should return 404 if center not found', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id_usuario: 1, nombre: 'Test' });
    mockPrisma.centro.findUnique.mockResolvedValue(null);

    await create(req, res);

    expect(res.statusCode).toBe(404);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Centro no encontrado');
  });

  test('should return 409 if overlapping assignment exists', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id_usuario: 1, nombre: 'Test' });
    mockPrisma.centro.findUnique.mockResolvedValue({ id_centro: 1, nombre_centro: 'Test Center' });
    mockPrisma.asignacionPersonal.findFirst.mockResolvedValue({
      id_asignacion: 5,
      id_usuario: 1,
      id_centro: 2,
    });

    await create(req, res);

    expect(res.statusCode).toBe(409);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('ya tiene una asignación');
  });

  test('should create assignment and return 201', async () => {
    mockPrisma.usuario.findUnique.mockResolvedValue({ id_usuario: 1, nombre: 'Test User' });
    mockPrisma.centro.findUnique.mockResolvedValue({ id_centro: 1, nombre_centro: 'CEIP San Juan' });
    mockPrisma.asignacionPersonal.findFirst.mockResolvedValue(null);

    const newAsignacion = {
      id_asignacion: 10,
      id_usuario: 1,
      id_centro: 1,
      fecha_inicio: new Date('2026-07-01'),
      fecha_fin: new Date('2026-08-01'),
      usuario: { id_usuario: 1, nombre: 'Test User', email: 'test@kavana.com', rol: 'limpiador' },
      centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
    };

    mockPrisma.asignacionPersonal.create.mockResolvedValue(newAsignacion);

    await create(req, res);

    expect(res.statusCode).toBe(201);
    const data = JSON.parse(res._getData());
    expect(data.asignacion).toBeDefined();
    expect(data.asignacion.id_asignacion).toBe(10);
  });

  test('should create assignment without fecha_fin (permanent)', async () => {
    req.body = { id_usuario: 1, id_centro: 1, fecha_inicio: '2026-07-01' };

    mockPrisma.usuario.findUnique.mockResolvedValue({ id_usuario: 1, nombre: 'Test User' });
    mockPrisma.centro.findUnique.mockResolvedValue({ id_centro: 1, nombre_centro: 'CEIP San Juan' });
    mockPrisma.asignacionPersonal.findFirst.mockResolvedValue(null);

    mockPrisma.asignacionPersonal.create.mockResolvedValue({
      id_asignacion: 11,
      id_usuario: 1,
      id_centro: 1,
      fecha_inicio: new Date('2026-07-01'),
      fecha_fin: null,
      usuario: { id_usuario: 1, nombre: 'Test User', email: 'test@kavana.com', rol: 'limpiador' },
      centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
    });

    await create(req, res);

    expect(res.statusCode).toBe(201);
  });
});

describe('asignacionController.update', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      params: { id: '5' },
      body: { fecha_fin: '2026-09-01' },
      user: { id_usuario: 2, rol: 'supervisor' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return 400 if no fields provided', async () => {
    req.body = {};

    await update(req, res);

    expect(res.statusCode).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Debe proporcionar al menos un campo');
  });

  test('should return 404 if assignment not found', async () => {
    mockPrisma.asignacionPersonal.findUnique.mockResolvedValue(null);

    await update(req, res);

    expect(res.statusCode).toBe(404);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Asignación no encontrada');
  });

  test('should update assignment and return it', async () => {
    mockPrisma.asignacionPersonal.findUnique.mockResolvedValue({
      id_asignacion: 5,
      id_usuario: 1,
      id_centro: 1,
      fecha_inicio: new Date('2026-06-01'),
      fecha_fin: null,
    });

    mockPrisma.asignacionPersonal.update.mockResolvedValue({
      id_asignacion: 5,
      id_usuario: 1,
      id_centro: 1,
      fecha_inicio: new Date('2026-06-01'),
      fecha_fin: new Date('2026-09-01'),
      usuario: { id_usuario: 1, nombre: 'Carlos López', email: 'carlos@kavana.com', rol: 'limpiador' },
      centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
    });

    await update(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.asignacion).toBeDefined();
    expect(mockPrisma.asignacionPersonal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_asignacion: 5 },
      })
    );
  });

  test('should allow setting fecha_fin to null', async () => {
    req.body = { fecha_fin: null };

    mockPrisma.asignacionPersonal.findUnique.mockResolvedValue({
      id_asignacion: 5,
      fecha_inicio: new Date('2026-06-01'),
      fecha_fin: new Date('2026-08-01'),
    });

    mockPrisma.asignacionPersonal.update.mockResolvedValue({
      id_asignacion: 5,
      fecha_inicio: new Date('2026-06-01'),
      fecha_fin: null,
      usuario: {},
      centro: {},
    });

    await update(req, res);

    expect(res.statusCode).toBe(200);
  });
});