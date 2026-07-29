import type { FastifyInstance } from 'fastify';

import type { LoginInput } from '@gloo/shared';

import { verifyPassword } from '../../lib/hash';
import { prisma } from '../../lib/prisma';
import { toUserDto } from '../../lib/userDto';

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: LoginInput }>(
    '/login',
    { config: { public: true } },
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return reply.code(401).send({ error: 'Email ou senha inválidos' });
      }

      await app.signAuthCookie(reply, user.id);
      return toUserDto(user);
    },
  );

  app.post('/logout', { config: { public: true } }, async (_request, reply) => {
    app.clearAuthCookie(reply);
    return { ok: true };
  });

  app.get('/me', async (request) => {
    return request.authUser;
  });
}
