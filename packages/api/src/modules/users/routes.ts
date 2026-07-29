import type { FastifyInstance } from 'fastify';

import { prisma } from '../../lib/prisma';
import { toUserDto } from '../../lib/userDto';

const MAX_NAME_LENGTH = 60;
const MAX_JOB_TITLE_LENGTH = 60;

export async function userRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map(toUserDto);
  });

  // Self-service profile edit. Scoped to the authenticated user rather than
  // taking an id: nobody — admin included — renames someone else from the UI.
  //
  // `role` is deliberately not accepted here. The editable "função" is
  // `jobTitle`, a cosmetic label; the permission role stays a DB-only change,
  // so this endpoint can never be used to escalate privileges.
  app.patch<{ Body: { name?: string; jobTitle?: string | null } }>(
    '/me',
    async (request, reply) => {
      const name = request.body?.name?.trim();
      const jobTitle = request.body?.jobTitle?.trim();

      if (!name) {
        return reply.code(400).send({ error: 'name é obrigatório' });
      }
      if (name.length > MAX_NAME_LENGTH) {
        return reply
          .code(400)
          .send({ error: `Nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres` });
      }
      if (jobTitle && jobTitle.length > MAX_JOB_TITLE_LENGTH) {
        return reply
          .code(400)
          .send({ error: `Função deve ter no máximo ${MAX_JOB_TITLE_LENGTH} caracteres` });
      }

      const user = await prisma.user.update({
        where: { id: request.authUser.id },
        data: {
          name,
          // Only touched when the client sends the field; clearing it is an
          // explicit empty string, which stores NULL rather than ''.
          ...(request.body?.jobTitle !== undefined ? { jobTitle: jobTitle || null } : {}),
        },
      });

      return toUserDto(user);
    },
  );
}
