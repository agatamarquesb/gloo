import type { FastifyInstance } from 'fastify';

import { prisma } from '../../lib/prisma';

export async function userRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      avatarUrl: u.avatarUrl,
    }));
  });
}
