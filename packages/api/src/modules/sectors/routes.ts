import type { FastifyInstance } from 'fastify';

import { prisma } from '../../lib/prisma';

export async function sectorRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } });
    return sectors.map((s) => ({ id: s.id, name: s.name }));
  });

  app.post<{ Body: { name: string } }>('/', async (request, reply) => {
    if (request.authUser.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Apenas administradores podem criar setores' });
    }

    const { name } = request.body;
    if (!name) {
      return reply.code(400).send({ error: 'name é obrigatório' });
    }

    const sector = await prisma.sector.create({ data: { name } });
    return reply.code(201).send({ id: sector.id, name: sector.name });
  });
}
