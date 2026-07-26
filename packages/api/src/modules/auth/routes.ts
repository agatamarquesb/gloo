import type { FastifyInstance } from 'fastify';

import type { LoginInput, UserDto } from '@gloo/shared';

import { verifyPassword } from '../../lib/hash';
import { prisma } from '../../lib/prisma';

function toUserDto(user: { id: string; email: string; name: string; role: string; avatarUrl: string | null }): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as UserDto['role'],
    avatarUrl: user.avatarUrl,
  };
}

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
