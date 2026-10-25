import { installTransferGate } from './services/dataTransfer/gate.js';
import { recoverTransfer, isTransferBlocked } from './services/dataTransfer/service.js';
/**
 * Main Application Entry Point
 * Sets up Fastify server with all routes, middleware, and plugins
 */
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyFormbody from '@fastify/formbody';
import fastifyMultipart from '@fastify/multipart';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import { initDatabase } from './models/database.js';
import { setupViewEngine, renderView } from './utils/viewEngine.js';
import { authService } from './services/authService.js';
import { publicRoutes } from './routes/publicRoutes.js';
import { adminRoutes } from './routes/adminRoutes.js';
import { ensureReferencePages } from './services/referenceSiteService.js';
import { referenceSiteController } from './controllers/referenceSiteController.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildApp() {
  await recoverTransfer();
  const fastify = Fastify({
    ignoreTrailingSlash: true,
    bodyLimit: 2 * 1024 * 1024,
    logger: config.nodeEnv !== 'test',
    disableRequestLogging: config.nodeEnv === 'production',
  });

  installTransferGate(fastify);
  fastify.addHook('onRequest', async (_request, reply) => {
    if (isTransferBlocked()) return reply.code(503).send('Database recovery is required. Restart the app after resolving the storage error.');
  });

  // Register plugins
  await fastify.register(fastifyFormbody);
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: config.maxFileSize,
    },
    attachFieldsToBody: true,
  });
  await fastify.register(fastifyCookie);
  await fastify.register(fastifySession, {
    secret: config.sessionSecret,
    cookie: {
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    saveUninitialized: false,
  });

  // Static files (public + uploads)
  await fastify.register(fastifyStatic, {
    root: path.resolve(__dirname, '../public'),
    prefix: '/',
    wildcard: false,
  });

  // Register a wildcard route so newly uploaded files are served without restarting.
  await fastify.register(fastifyStatic, {
    root: path.resolve(config.uploadDir),
    prefix: '/uploads/',
    decorateReply: false,
  });

  // View engine
  setupViewEngine(fastify);

  // Make renderView available
  fastify.decorate('renderView', renderView);

  // Initialize database
  await initDatabase();
  await ensureReferencePages();

  // Initialize admin user
  await authService.initializeAdmin();

  // Error handling
  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? notFoundHandler(request, reply) : referenceSiteController.notFound(request, reply));

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Register routes
  await fastify.register(publicRoutes);
  await fastify.register(adminRoutes, { prefix: '/admin' });

  // 404 for API routes
  fastify.get('/api/*', notFoundHandler);

  return fastify;
}

let serverInstance = null;

async function start() {
  try {
    const app = await buildApp();
    serverInstance = app;
    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 WCoS Server running at http://${config.host}:${config.port}`);
    console.log(`📚 Environment: ${config.nodeEnv}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (serverInstance) {
    try { await serverInstance.close(); } catch (e) { /* ignore */ }
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (serverInstance) {
    try { await serverInstance.close(); } catch (e) { /* ignore */ }
  }
  process.exit(0);
});

// Start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildApp, start };