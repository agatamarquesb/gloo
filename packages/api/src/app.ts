import { mkdirSync } from 'node:fs';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';

import { env } from './config/env';
import { authRoutes } from './modules/auth/routes';
import { labelRoutes } from './modules/labels/routes';
import { routineRoutes } from './modules/routines/routes';
import { sectorRoutes } from './modules/sectors/routes';
import { subtaskRoutes } from './modules/subtasks/routes';
import { taskRoutes } from './modules/tasks/routes';
import { uploadRoutes } from './modules/uploads/routes';
import { avatarRoutes } from './modules/users/avatar';
import { userRoutes } from './modules/users/routes';
import { authPlugin } from './plugins/auth';

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: WEB_ORIGIN,
    credentials: true,
    // @fastify/cors defaults to GET,HEAD,POST — without PATCH/DELETE listed,
    // the browser's preflight blocks every update/delete the UI issues.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.register(multipart);
  app.register(authPlugin);

  // Avatars are served straight off the uploads volume. Filenames are UUIDs,
  // and the images carry nothing sensitive, so this stays public — the auth
  // preHandler would otherwise reject plain <img> requests.
  mkdirSync(env.UPLOADS_DIR, { recursive: true });
  app.register(fastifyStatic, {
    root: env.UPLOADS_DIR,
    prefix: '/uploads/',
    decorateReply: false,
  });

  app.get('/health', { config: { public: true } }, async () => ({ status: 'ok' }));

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(userRoutes, { prefix: '/api/users' });
  app.register(avatarRoutes, { prefix: '/api/users' });
  app.register(sectorRoutes, { prefix: '/api/sectors' });
  app.register(taskRoutes, { prefix: '/api/tasks' });
  app.register(subtaskRoutes, { prefix: '/api/subtasks' });
  app.register(routineRoutes, { prefix: '/api/routines' });
  app.register(labelRoutes, { prefix: '/api/labels' });
  app.register(uploadRoutes, { prefix: '/api/uploads' });

  return app;
}
