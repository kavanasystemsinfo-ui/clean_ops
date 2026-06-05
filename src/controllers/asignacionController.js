// =============================================================================
// Kavana CleanOps — Asignaciones Controller
//   - getActive:     Devuelve el centro activo del usuario autenticado (hoy)
//   - list:          Lista todas las asignaciones (filtrable por usuario/centro)
//   - create:        Crea una nueva asignación (supervisor+)
//   - update:        Actualiza fechas de una asignación (supervisor+)
// =============================================================================

const prisma = require('../lib/prisma');
const logger = require('../lib/logger');

// ---------------------------------------------------------------------------
// GET /api/v1/asignaciones/active
// Devuelve el centro donde el usuario está asignado hoy.
// ---------------------------------------------------------------------------
async function getActive(req, res) {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const asignacion = await prisma.asignacionPersonal.findFirst({
      where: {
        id_usuario: req.user.id_usuario,
        fecha_inicio: { lte: hoy },
        OR: [
          { fecha_fin: { gte: hoy } },
          { fecha_fin: null },
        ],
      },
      include: {
        centro: true,
      },
    });

    if (!asignacion) {
      return res.status(404).json({ error: 'No tienes un centro activo asignado para la fecha actual.' });
    }

    res.json({ asignacion });
  } catch (error) {
    logger.error('Error en getActive:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/asignaciones?usuario=:id&centro=:id
// ---------------------------------------------------------------------------
async function list(req, res) {
  try {
    const { usuario, centro } = req.query;

    const where = {};
    if (usuario) where.id_usuario = Number(usuario);
    if (centro) where.id_centro = Number(centro);

    const asignaciones = await prisma.asignacionPersonal.findMany({
      where,
      include: {
        usuario: { select: { id_usuario: true, nombre: true, email: true, rol: true } },
        centro: true,
      },
      orderBy: { fecha_inicio: 'desc' },
    });

    res.json({ asignaciones });
  } catch (error) {
    logger.error('Error en list asignaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/asignaciones (supervisor+)
// Body: { id_usuario, id_centro, fecha_inicio, fecha_fin? }
// ---------------------------------------------------------------------------
async function create(req, res) {
  try {
    const { id_usuario, id_centro, fecha_inicio, fecha_fin } = req.body;

    // Validar que usuario exista
    const usuario = await prisma.usuario.findUnique({ where: { id_usuario } });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Validar que centro exista
    const centro = await prisma.centro.findUnique({ where: { id_centro } });
    if (!centro) {
      return res.status(404).json({ error: 'Centro no encontrado.' });
    }

    // Validar que no haya solapamiento de fechas para el mismo usuario
    const fechaInicio = new Date(fecha_inicio);
    fechaInicio.setHours(0, 0, 0, 0);
    const fechaFin = fecha_fin ? new Date(fecha_fin) : null;
    if (fechaFin) fechaFin.setHours(23, 59, 59, 999);

    const solapamiento = await prisma.asignacionPersonal.findFirst({
      where: {
        id_usuario,
        fecha_inicio: { lte: fechaFin || fechaInicio },
        OR: [
          { fecha_fin: { gte: fechaInicio } },
          { fecha_fin: null },
        ],
      },
    });

    if (solapamiento) {
      return res.status(409).json({
        error: 'El usuario ya tiene una asignación en ese período.',
        asignacionExistente: solapamiento,
      });
    }

    const asignacion = await prisma.asignacionPersonal.create({
      data: {
        id_usuario,
        id_centro,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      },
      include: {
        usuario: { select: { id_usuario: true, nombre: true, email: true, rol: true } },
        centro: true,
      },
    });

    res.status(201).json({ asignacion });
  } catch (error) {
    logger.error('Error en create asignacion:', { error: error.message, stack: error.stack, body: req.body, user: req.user?.id_usuario });
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/v1/asignaciones/:id (supervisor+)
// Body: { fecha_inicio?, fecha_fin? }
// ---------------------------------------------------------------------------
async function update(req, res) {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.body;

    if (!fecha_inicio && fecha_fin === undefined) {
      return res.status(400).json({ error: 'Debe proporcionar al menos un campo a actualizar.' });
    }

    const asignacionExistente = await prisma.asignacionPersonal.findUnique({
      where: { id_asignacion: Number(id) },
    });

    if (!asignacionExistente) {
      return res.status(404).json({ error: 'Asignación no encontrada.' });
    }

    const data = {};
    if (fecha_inicio) {
      data.fecha_inicio = new Date(fecha_inicio);
    }
    if (fecha_fin !== undefined) {
      data.fecha_fin = fecha_fin ? new Date(fecha_fin) : null;
    }

    const asignacion = await prisma.asignacionPersonal.update({
      where: { id_asignacion: Number(id) },
      data,
      include: {
        usuario: { select: { id_usuario: true, nombre: true, email: true, rol: true } },
        centro: true,
      },
    });

    res.json({ asignacion });
  } catch (error) {
    logger.error('Error en update asignacion:', { error: error.message, stack: error.stack, body: req.body, user: req.user?.id_usuario });
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/asignaciones/users
// Devuelve todos los usuarios (para selects en dashboard).
// ---------------------------------------------------------------------------
async function getAllUsers(req, res) {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id_usuario: true, nombre: true, email: true, rol: true },
      orderBy: { nombre: 'asc' },
    });
    res.json({ usuarios });
  } catch (error) {
    logger.error('Error en getAllUsers:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

module.exports = { getActive, list, create, update, getAllUsers };