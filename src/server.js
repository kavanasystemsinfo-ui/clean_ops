// =============================================================================
// Kavana CleanOps — Express Server Entry Point
// =============================================================================

const http = require('http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const logger = require('./lib/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const { cleanupExpiredTokens } = require('./controllers/authController');
const { createSocketServer } = require('./lib/socket');

const app = express();
const PORT = process.env.PORT || 4000;
const TOKEN_CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // cada 6 horas

// ---------------------------------------------------------------------------
// Middleware Chain
// ---------------------------------------------------------------------------
app.use(helmet());                                          // Security headers
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));  // CORS
app.use(express.json());                                    // Body parsing

// Swagger UI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Kavana CleanOps API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}));

// HTTP request logging via Winston (replaces morgan)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      userAgent: req.get('user-agent') || '-',
    });
  });
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', apiRoutes);

// ---------------------------------------------------------------------------
// 404 Handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  logger.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ---------------------------------------------------------------------------
// Create HTTP Server (needed for Socket.IO)
// ---------------------------------------------------------------------------
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Initialize Socket.IO
// ---------------------------------------------------------------------------
createSocketServer(server);

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  logger.info(`[Kavana CleanOps] Server running on http://localhost:${PORT}`);
  logger.info(`[Kavana CleanOps] Socket.IO ready for real-time connections`);
  logger.info(`[Kavana CleanOps] Environment: ${process.env.NODE_ENV || 'development'}`);

  // Programar limpieza periódica de refresh tokens expirados
  cleanupExpiredTokens(); // Ejecutar al inicio
  setInterval(cleanupExpiredTokens, TOKEN_CLEANUP_INTERVAL);
  logger.info(`[Kavana CleanOps] Token cleanup scheduled every ${TOKEN_CLEANUP_INTERVAL / 60000} minutes`);
});

module.exports = app;
