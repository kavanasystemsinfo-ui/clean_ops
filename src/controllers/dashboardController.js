// =============================================================================
// Kavana CleanOps — Dashboard Controller
//   - consumption: Analítica de consumo por centro/producto/período
//   - alerts:      Alertas críticas de stock (concentrado para dashboard)
// =============================================================================

const prisma = require('../lib/prisma');
const logger = require('../lib/logger');

// ---------------------------------------------------------------------------
// GET /api/v1/dashboard/consumption
// Query: ?centro=:id&producto=:id&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// ---------------------------------------------------------------------------
async function consumption(req, res) {
  try {
    const { centro, producto, desde, hasta } = req.query;

    // Filtro base: solo movimientos de consumo (cantidad < 0)
    const where = {
      cantidad: { lt: 0 },
    };

    if (centro) where.id_centro = Number(centro);
    if (producto) where.id_producto = Number(producto);
    if (desde) {
      where.fecha_hora = { ...where.fecha_hora, gte: new Date(desde) };
    }
    if (hasta) {
      where.fecha_hora = { ...where.fecha_hora, lte: new Date(hasta + 'T23:59:59.999Z') };
    }

    // Obtener movimientos de consumo
    const movements = await prisma.registroMovimiento.findMany({
      where,
      include: {
        producto: { select: { id_producto: true, nombre_producto: true, unidad_medida: true } },
        centro: { select: { id_centro: true, nombre_centro: true } },
        usuario: { select: { id_usuario: true, nombre: true } },
      },
      orderBy: { fecha_hora: 'desc' },
    });

    // Agrupar por centro para el resumen
    const groupedByCenter = movements.reduce((acc, m) => {
      const key = m.centro.nombre_centro;
      if (!acc[key]) {
        acc[key] = {
          centro: m.centro,
          total_consumo: 0,
          productos: {},
          movimientos: 0,
        };
      }
      acc[key].total_consumo += Math.abs(m.cantidad);
      acc[key].movimientos += 1;
      const prodKey = m.producto.nombre_producto;
      if (!acc[key].productos[prodKey]) {
        acc[key].productos[prodKey] = {
          ...m.producto,
          cantidad: 0,
        };
      }
      acc[key].productos[prodKey].cantidad += Math.abs(m.cantidad);
      return acc;
    }, {});

    // Totales globales
    const totalConsumo = movements.reduce((sum, m) => sum + Math.abs(m.cantidad), 0);

    logger.info('Dashboard consumo consultado', {
      filtros: { centro, producto, desde, hasta },
      totalMovimientos: movements.length,
    });

    res.json({
      total_consumo: totalConsumo,
      total_movimientos: movements.length,
      resumen_por_centro: Object.values(groupedByCenter).map((g) => ({
        ...g,
        productos: Object.values(g.productos),
      })),
      movimientos: movements.slice(0, 100), // últimos 100 movimientos
    });
  } catch (error) {
    logger.error('Error en dashboard consumption:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/dashboard/alerts
// ---------------------------------------------------------------------------
async function alerts(req, res) {
  try {
    // Obtener todo el inventario con datos de producto y centro
    const inventario = await prisma.inventarioCentro.findMany({
      include: {
        producto: true,
        centro: true,
      },
      orderBy: [
        { cantidad_actual: 'asc' },
      ],
    });

    // Filtrar los que están por debajo del umbral
    const criticalAlerts = inventario
      .filter((item) => item.cantidad_actual <= item.producto.stock_minimo_alerta)
      .map((item) => {
        const stockMinimo = item.producto.stock_minimo_alerta;
        return {
          id_centro: item.id_centro,
          centro: item.centro.nombre_centro,
          id_producto: item.id_producto,
          producto: item.producto.nombre_producto,
          unidad_medida: item.producto.unidad_medida,
          cantidad_actual: item.cantidad_actual,
          stock_minimo_alerta: stockMinimo,
          deficit: stockMinimo - item.cantidad_actual,
        };
      });

    // Separar por nivel de criticidad
    const critical = criticalAlerts.filter((a) => a.cantidad_actual <= 0);
    const warning = criticalAlerts.filter((a) => a.cantidad_actual > 0 && a.cantidad_actual <= a.stock_minimo_alerta);

    logger.info('Dashboard alertas consultado', {
      totalCritical: critical.length,
      totalWarning: warning.length,
    });

    res.json({
      total_alertas: criticalAlerts.length,
      criticas: critical,
      advertencias: warning,
    });
  } catch (error) {
    logger.error('Error en dashboard alerts:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

module.exports = { consumption, alerts };