// =============================================================================
// Kavana CleanOps — Protected API Routes (/api/v1)
//   Stock:
//     GET    /stock/inventory   → Inventario (autenticado)
//     POST   /stock/consume     → Consumir stock (autenticado)
//     POST   /stock/restock     → Reponer stock (supervisor+)
//     GET    /stock/alerts      → Alertas stock mínimo (autenticado)
//
//   Asignaciones:
//     GET    /asignaciones/active → Centro activo (autenticado)
//     GET    /asignaciones        → Listar asignaciones (autenticado)
//     POST   /asignaciones        → Crear asignación (supervisor+)
//     PUT    /asignaciones/:id    → Actualizar asignación (supervisor+)
//
//   Dashboard:
//     GET    /dashboard/consumption → Consumo por centro/producto/período
//     GET    /dashboard/alerts      → Alertas críticas de stock
// =============================================================================

const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validate,
  consumeStockSchema,
  restockSchema,
  createAsignacionSchema,
  updateAsignacionSchema,
} = require('../middleware/validate');
const stockController = require('../controllers/stockController');
const asignacionController = require('../controllers/asignacionController');
const dashboardController = require('../controllers/dashboardController');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// --- Stock ---
router.get('/stock/inventory', stockController.getInventory);
router.get('/stock/centros', stockController.getCentros);
router.post('/stock/consume', validate(consumeStockSchema), stockController.consumeStock);
router.post('/stock/restock', authorize('supervisor', 'admin'), validate(restockSchema), stockController.restock);
router.get('/stock/alerts', stockController.getAlerts);

// --- Asignaciones ---
router.get('/asignaciones/active', asignacionController.getActive);
router.get('/asignaciones/users', asignacionController.getAllUsers);
router.get('/asignaciones', asignacionController.list);
router.post('/asignaciones', authorize('supervisor', 'admin'), validate(createAsignacionSchema), asignacionController.create);
router.put('/asignaciones/:id', authorize('supervisor', 'admin'), validate(updateAsignacionSchema), asignacionController.update);

// --- Dashboard ---
router.get('/dashboard/consumption', authorize('supervisor', 'admin'), dashboardController.consumption);
router.get('/dashboard/alerts', authorize('supervisor', 'admin'), dashboardController.alerts);

module.exports = router;