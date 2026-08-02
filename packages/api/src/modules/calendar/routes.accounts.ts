import type { FastifyInstance } from 'fastify';

import type { CalendarAccountDto } from '@gloo/shared';

import { prisma } from '../../lib/prisma';
import { revokeGoogleGrant } from './google/routes';
import { agendaSelect, toCalendarAccountDto } from './mapper';
import { ensureCalendarProvisioned } from './provision';

const MAX_NAME_LENGTH = 60;

/**
 * A user's calendar accounts, each with the agendas under it.
 *
 * Everything here is scoped to `request.authUser.id` — an account carries
 * another user's Google tokens, so there is no route that reads one by id
 * without also proving it belongs to the caller.
 */
export async function calendarAccountRoutes(app: FastifyInstance) {
  app.get('/', async (request): Promise<CalendarAccountDto[]> => {
    await ensureCalendarProvisioned(request.authUser.id);

    const accounts = await prisma.calendarAccount.findMany({
      where: { userId: request.authUser.id },
      include: {
        agendas: {
          // Removed Google calendars stay in the table so the importer knows
          // not to walk them back in, but they are gone as far as the UI is
          // concerned.
          where: { removedAt: null },
          select: agendaSelect,
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      // The Gloo account first, then Google accounts oldest-linked first, so
      // the list doesn't reorder itself under the user.
      orderBy: [{ provider: 'asc' }, { createdAt: 'asc' }],
    });

    return accounts.map(toCalendarAccountDto);
  });

  app.patch<{ Body: { displayName?: string; isCollapsed?: boolean }; Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const { displayName, isCollapsed } = request.body ?? {};

      if (displayName !== undefined) {
        if (!displayName.trim()) return reply.code(400).send({ error: 'displayName é obrigatório' });
        if (displayName.trim().length > MAX_NAME_LENGTH) {
          return reply
            .code(400)
            .send({ error: `Nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres` });
        }
      }

      // updateMany with the owner in the where clause, rather than findUnique
      // then update: it makes "not yours" and "not there" the same answer, so
      // the route can't be used to probe which account ids exist.
      const updated = await prisma.calendarAccount.updateMany({
        where: { id: request.params.id, userId: request.authUser.id },
        data: {
          ...(displayName !== undefined ? { displayName: displayName.trim() } : {}),
          ...(isCollapsed !== undefined ? { isCollapsed } : {}),
        },
      });

      if (updated.count === 0) return reply.code(404).send({ error: 'Conta não encontrada' });

      const account = await prisma.calendarAccount.findUniqueOrThrow({
        where: { id: request.params.id },
        include: {
          agendas: {
            where: { removedAt: null },
            select: agendaSelect,
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
      });

      return toCalendarAccountDto(account);
    },
  );

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const account = await prisma.calendarAccount.findFirst({
      where: { id: request.params.id, userId: request.authUser.id },
    });

    if (!account) return reply.code(404).send({ error: 'Conta não encontrada' });

    // The Gloo account is where the user's own agendas live and cannot be
    // unlinked — there would be nowhere left to create an event.
    if (account.provider === 'GLOO') {
      return reply.code(400).send({ error: 'A conta Gloo não pode ser desconectada' });
    }

    // Hand the grant back before forgetting it: dropping only our copy would
    // leave Gloo standing in the user's Google account with access it no longer
    // uses, which is not what "desconectar" says.
    await revokeGoogleGrant(account, (error) =>
      request.log.warn({ err: error }, 'Google token revocation failed'),
    );

    // Agendas and their events cascade from the account row.
    await prisma.calendarAccount.delete({ where: { id: account.id } });
    return reply.code(204).send();
  });
}
