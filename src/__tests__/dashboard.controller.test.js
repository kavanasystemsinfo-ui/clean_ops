// =============================================================================
// Kavana CleanOps — Dashboard Controller Tests
// Tests for src/controllers/dashboardController.js
// =============================================================================

const httpMocks = require('node-mocks-http');
const { mockPrisma } = require('./setup');
const prisma = require('../lib/prisma');

const {
  consumption,
  alerts,
} = require('../controllers/dashboardController');

describe('dashboardController.consumption', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      query: {},
      user: { id_usuario: 2, rol: 'supervisor' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return consumption data grouped by center', async () => {
    const mockMovements = [
      {
        id_movimiento: 1,
        id_usuario: 1,
        id_centro: 1,
        id_producto: 1,
        cantidad: -5,
        fecha_hora: new Date('2026-06-01T10:00:00Z'),
        producto: { id_producto: 1, nombre_producto: 'Lejía 2L', unidad_medida: 'unidades' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
        usuario: { id_usuario: 1, nombre: 'Carlos López' },
      },
      {
        id_movimiento: 2,
        id_usuario: 1,
        id_centro: 1,
        id_producto: 2,
        cantidad: -3,
        fecha_hora: new Date('2026-06-02T10:00:00Z'),
        producto: { id_producto: 2, nombre_producto: 'Fregasuelos 1L', unidad_medida: 'unidades' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
        usuario: { id_usuario: 1, nombre: 'Carlos López' },
      },
    ];

    mockPrisma.registroMovimiento.findMany.mockResolvedValue(mockMovements);

    await consumption(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.total_consumo).toBe(8);
    expect(data.total_movimientos).toBe(2);
    expect(data.resumen_por_centro).toHaveLength(1);
    expect(data.resumen_por_centro[0].centro.nombre_centro).toBe('CEIP San Juan');
    expect(data.resumen_por_centro[0].total_consumo).toBe(8);
    expect(data.resumen_por_centro[0].productos).toHaveLength(2);
    expect(data.movimientos).toHaveLength(2);
  });

  test('should filter by centro query param', async () => {
    req.query.centro = '2';

    mockPrisma.registroMovimiento.findMany.mockResolvedValue([]);

    await consumption(req, res);

    expect(mockPrisma.registroMovimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id_centro: 2 }),
      })
    );
  });

  test('should filter by producto query param', async () => {
    req.query.producto = '1';

    mockPrisma.registroMovimiento.findMany.mockResolvedValue([]);

    await consumption(req, res);

    expect(mockPrisma.registroMovimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id_producto: 1 }),
      })
    );
  });

  test('should filter by date range (desde and hasta)', async () => {
    req.query.desde = '2026-06-01';
    req.query.hasta = '2026-06-30';

    mockPrisma.registroMovimiento.findMany.mockResolvedValue([]);

    await consumption(req, res);

    expect(mockPrisma.registroMovimiento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fecha_hora: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  test('should return empty result when no movements exist', async () => {
    mockPrisma.registroMovimiento.findMany.mockResolvedValue([]);

    await consumption(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.total_consumo).toBe(0);
    expect(data.total_movimientos).toBe(0);
    expect(data.resumen_por_centro).toEqual([]);
    expect(data.movimientos).toEqual([]);
  });

  test('should limit movements to 100 items', async () => {
    const manyMovements = Array.from({ length: 150 }, (_, i) => ({
      id_movimiento: i + 1,
      id_usuario: 1,
      id_centro: 1,
      id_producto: 1,
      cantidad: -1,
      fecha_hora: new Date(),
      producto: { id_producto: 1, nombre_producto: 'Lejía 2L', unidad_medida: 'unidades' },
      centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
      usuario: { id_usuario: 1, nombre: 'Carlos López' },
    }));

    mockPrisma.registroMovimiento.findMany.mockResolvedValue(manyMovements);

    await consumption(req, res);

    const data = JSON.parse(res._getData());
    expect(data.movimientos).toHaveLength(100);
    expect(data.total_movimientos).toBe(150);
  });

  test('should handle multiple centers in grouping', async () => {
    const mockMovements = [
      {
        id_movimiento: 1,
        id_usuario: 1,
        id_centro: 1,
        id_producto: 1,
        cantidad: -5,
        fecha_hora: new Date(),
        producto: { id_producto: 1, nombre_producto: 'Lejía 2L', unidad_medida: 'unidades' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
        usuario: { id_usuario: 1, nombre: 'Carlos López' },
      },
      {
        id_movimiento: 2,
        id_usuario: 2,
        id_centro: 2,
        id_producto: 1,
        cantidad: -10,
        fecha_hora: new Date(),
        producto: { id_producto: 1, nombre_producto: 'Lejía 2L', unidad_medida: 'unidades' },
        centro: { id_centro: 2, nombre_centro: 'IES La Plana' },
        usuario: { id_usuario: 2, nombre: 'María García' },
      },
    ];

    mockPrisma.registroMovimiento.findMany.mockResolvedValue(mockMovements);

    await consumption(req, res);

    const data = JSON.parse(res._getData());
    expect(data.resumen_por_centro).toHaveLength(2);
    expect(data.total_consumo).toBe(15);
  });

  test('should return 500 on database error', async () => {
    mockPrisma.registroMovimiento.findMany.mockRejectedValue(new Error('DB connection failed'));

    await consumption(req, res);

    expect(res.statusCode).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Error interno del servidor');
  });
});

describe('dashboardController.alerts', () => {
  let req, res;

  beforeEach(() => {
    req = httpMocks.createRequest({
      query: {},
      user: { id_usuario: 2, rol: 'supervisor' },
    });
    res = httpMocks.createResponse();
    jest.clearAllMocks();
  });

  test('should return critical and warning alerts separated', async () => {
    const mockInventory = [
      {
        id_centro: 1,
        id_producto: 1,
        cantidad_actual: 0, // critical (stock <= 0)
        producto: { id_producto: 1, nombre_producto: 'Lejía 2L', stock_minimo_alerta: 5, unidad_medida: 'unidades' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
      },
      {
        id_centro: 1,
        id_producto: 2,
        cantidad_actual: 3, // warning (0 < stock <= stock_minimo_alerta)
        producto: { id_producto: 2, nombre_producto: 'Fregasuelos 1L', stock_minimo_alerta: 5, unidad_medida: 'unidades' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
      },
      {
        id_centro: 1,
        id_producto: 3,
        cantidad_actual: 10, // no alert (stock > stock_minimo_alerta)
        producto: { id_producto: 3, nombre_producto: 'Papel WC 6u', stock_minimo_alerta: 5, unidad_medida: 'unidades' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
      },
    ];

    mockPrisma.inventarioCentro.findMany.mockResolvedValue(mockInventory);

    await alerts(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.total_alertas).toBe(2);
    expect(data.criticas).toHaveLength(1);
    expect(data.criticas[0].producto).toBe('Lejía 2L');
    expect(data.criticas[0].cantidad_actual).toBe(0);
    expect(data.criticas[0].deficit).toBe(5);
    expect(data.advertencias).toHaveLength(1);
    expect(data.advertencias[0].producto).toBe('Fregasuelos 1L');
    expect(data.advertencias[0].cantidad_actual).toBe(3);
    expect(data.advertencias[0].deficit).toBe(2);
  });

  test('should return empty alerts when all stock is sufficient', async () => {
    const mockInventory = [
      {
        id_centro: 1,
        id_producto: 1,
        cantidad_actual: 10,
        producto: { id_producto: 1, nombre_producto: 'Lejía 2L', stock_minimo_alerta: 5, unidad_medida: 'unidades' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
      },
    ];

    mockPrisma.inventarioCentro.findMany.mockResolvedValue(mockInventory);

    await alerts(req, res);

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.total_alertas).toBe(0);
    expect(data.criticas).toEqual([]);
    expect(data.advertencias).toEqual([]);
  });

  test('should handle multiple centers with alerts', async () => {
    const mockInventory = [
      {
        id_centro: 1,
        id_producto: 1,
        cantidad_actual: 0,
        producto: { id_producto: 1, nombre_producto: 'Lejía 2L', stock_minimo_alerta: 5, unidad_medida: 'unidades' },
        centro: { id_centro: 1, nombre_centro: 'CEIP San Juan' },
      },
      {
        id_centro: 2,
        id_producto: 1,
        cantidad_actual: 2,
        producto: { id_producto: 1, nombre_producto: 'Lejía 2L', stock_minimo_alerta: 5, unidad_medida: 'unidades' },
        centro: { id_centro: 2, nombre_centro: 'IES La Plana' },
      },
    ];

    mockPrisma.inventarioCentro.findMany.mockResolvedValue(mockInventory);

    await alerts(req, res);

    const data = JSON.parse(res._getData());
    expect(data.total_alertas).toBe(2);
    expect(data.criticas).toHaveLength(1);
    expect(data.criticas[0].centro).toBe('CEIP San Juan');
    expect(data.advertencias).toHaveLength(1);
    expect(data.advertencias[0].centro).toBe('IES La Plana');
  });

  test('should return 500 on database error', async () => {
    mockPrisma.inventarioCentro.findMany.mockRejectedValue(new Error('DB connection failed'));

    await alerts(req, res);

    expect(res.statusCode).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Error interno del servidor');
  });
});
