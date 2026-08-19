import type { FastifyInstance } from 'fastify';

import {
  isPaletteColor,
  toHex,
  type CreateAgendaInput,
  type UpdateAgendaInput,
} from '@gloo/shared';

import { prisma } from '../../lib/prisma';
import { createRemoteCalendar, updateRemoteCalendar } from './google/push';
import { agendaSelect, toAgendaDto } from './mapper';
import { defaultAgendaFor, ensureCalendarProvisioned, nextAgendaColor } from './provision';

const MAX_NAME_LENGTH = 60;

/**
 * Load an agenda, but only if it belongs to the caller.
 *
 * Agendas are personal, so ownership is the whole of the authorization story
 * here — there is no shared-agenda case for `canMutate` to arbitrate.
 */
async function ownedAgenda(id: string, userId: string) {
  return prisma.agenda.findFirst({
    where: { id, userId, removedAt: null },
    include: { account: true },
  });
}

export async function calendarAgendaRoutes(app: FastifyInstance) {
  app.post<{ Body: CreateAgendaInput }>('/', async (request, reply) => {
    await ensureCalendarProvisioned(request.authUser.id);
    const { accountId, name, color } = request.body ?? {};

    if (!name?.trim()) return reply.code(400).send({ error: 'name é obrigatório' });
    if (name.trim().length > MAX_NAME_LENGTH) {
      return reply.code(400).send({ error: `Nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres` });
    }
    if (color !== undefined && !isPaletteColor(color)) {
      return reply.code(400).send({ error: 'color inválida' });
    }

    const account = await prisma.calendarAccount.findFirst({
      where: { id: accountId, userId: request.authUser.id },
    });
    if (!account) return reply.code(404).send({ error: 'Conta não encontrada' });

    // A Google account gets the calendar created on Google *first*, and only
    // then a local row carrying the id it came back with — so the agenda is a
    // mirror from the moment it exists. Creating locally and reconciling later
    // would leave a Google-looking agenda that silently never synced.
    let googleCalendarId: string | null = null;
    if (account.provider === 'GOOGLE') {
      googleCalendarId = await createRemoteCalendar(account, name.trim(), (error) =>
        request.log.warn({ err: error }, 'calendars.insert failed'),
      );
      if (!googleCalendarId) {
        return reply.code(502).send({ error: 'Não foi possível criar a agenda no Google' });
      }
    }

    const siblings = await prisma.agenda.findMany({
      where: { userId: request.authUser.id, removedAt: null },
      select: { color: true, sortOrder: true, isSharedInbox: true },
    });

    // The shared inbox is pinned to the bottom, so a new agenda goes after the
    // real ones rather than after it.
    const lastRealOrder = Math.max(
      -1,
      ...siblings.filter((agenda) => !agenda.isSharedInbox).map((agenda) => agenda.sortOrder),
    );

    const agenda = await prisma.agenda.create({
      data: {
        accountId: account.id,
        userId: request.authUser.id,
        name: name.trim(),
        color: color ?? nextAgendaColor(siblings.map((sibling) => sibling.color)),
        sortOrder: lastRealOrder + 1,
        googleCalendarId,
      },
      select: agendaSelect,
    });

    return reply.code(201).send(toAgendaDto(agenda));
  });

  app.patch<{ Body: UpdateAgendaInput; Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const agenda = await ownedAgenda(request.params.id, request.authUser.id);
      if (!agenda) return reply.code(404).send({ error: 'Agenda não encontrada' });

      const { name, color, isHidden, isDefault } = request.body ?? {};

      if (name !== undefined) {
        if (!name.trim()) return reply.code(400).send({ error: 'name é obrigatório' });
        if (name.trim().length > MAX_NAME_LENGTH) {
          return reply
            .code(400)
            .send({ error: `Nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres` });
        }
        // The inbox is not a place the user made, so its name is not theirs to
        // change — renaming it would make "Compartilhados comigo" stop
        // describing what lands in it.
        if (agenda.isSharedInbox) {
          return reply.code(400).send({ error: 'Esta agenda não pode ser renomeada' });
        }
      }

      if (color !== undefined && !isPaletteColor(color)) {
        return reply.code(400).send({ error: 'color inválida' });
      }

      // Nothing is authored on the inbox, and a read-only Google calendar
      // rejects writes — neither can be where new events land.
      if (isDefault === true && (agenda.isSharedInbox || agenda.isReadOnly)) {
        return reply.code(400).send({ error: 'Esta agenda não pode ser a padrão' });
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (isDefault === true) {
          // Exactly one default per user, so clearing the old one and setting
          // the new one have to happen together — a failure between them would
          // leave the user with none, and defaultAgendaFor falling back.
          await tx.agenda.updateMany({
            where: { userId: request.authUser.id, isDefault: true },
            data: { isDefault: false },
          });
        }

        return tx.agenda.update({
          where: { id: agenda.id },
          data: {
            ...(name !== undefined ? { name: name.trim() } : {}),
            ...(color !== undefined ? { color } : {}),
            ...(isHidden !== undefined ? { isHidden } : {}),
            // isDefault:false is ignored on purpose: unsetting the default
            // without naming a replacement would leave the user without one.
            // The UI only ever offers "make this the default".
            ...(isDefault === true ? { isDefault: true } : {}),
          },
          select: agendaSelect,
        });
      });

      // A Google agenda is a mirror, so a name or a colour changed here has to
      // reach the calendar it mirrors — otherwise the next sync reads Google's
      // untouched values back over both, and the change simply disappears a
      // minute after it was made. Awaited so the sync polling behind this page
      // cannot overtake it; a failure costs the push and not the local write.
      if (
        agenda.account.provider === 'GOOGLE' &&
        agenda.googleCalendarId &&
        (name !== undefined || color !== undefined)
      ) {
        await updateRemoteCalendar(
          agenda.account,
          agenda.googleCalendarId,
          {
            ...(name !== undefined ? { name: name.trim() } : {}),
            // Google has no notion of "lime": what goes over the wire is the
            // hex the palette key stands for. See toHex.
            ...(color !== undefined ? { color: toHex(color) } : {}),
          },
          (error) => request.log.warn({ err: error }, 'calendarList.patch failed'),
        );
      }

      return toAgendaDto(updated);
    },
  );

  /**
   * "Mostrar apenas esta" — hide every other agenda in one press.
   *
   * A route of its own rather than the client PATCHing each agenda: it is one
   * intent, and doing it client-side would fire a dozen requests whose partial
   * failure leaves the list in a state the user didn't ask for.
   */
  app.post<{ Params: { id: string } }>('/:id/only', async (request, reply) => {
    const agenda = await ownedAgenda(request.params.id, request.authUser.id);
    if (!agenda) return reply.code(404).send({ error: 'Agenda não encontrada' });

    await prisma.$transaction([
      prisma.agenda.updateMany({
        where: { userId: request.authUser.id, removedAt: null },
        data: { isHidden: true },
      }),
      prisma.agenda.update({ where: { id: agenda.id }, data: { isHidden: false } }),
    ]);

    return reply.code(204).send();
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const agenda = await ownedAgenda(request.params.id, request.authUser.id);
    if (!agenda) return reply.code(404).send({ error: 'Agenda não encontrada' });

    if (agenda.isSharedInbox) {
      return reply.code(400).send({ error: 'Esta agenda não pode ser removida' });
    }

    // The default is protected exactly like the inbox is. It used to be
    // deletable, with the role quietly handed to whichever agenda happened to
    // sort first — so removing one agenda silently changed where every future
    // event would land, somewhere the user never chose. Making them name the
    // replacement first turns that into a decision instead of a side effect.
    if (agenda.isDefault) {
      return reply
        .code(400)
        .send({ error: 'Defina outra agenda como padrão antes de remover esta' });
    }

    if (agenda.account.provider === 'GOOGLE') {
      // Removing a Google calendar is a Gloo-side act only: nothing changes in
      // the user's Google account, and the mirrored rows go because they can be
      // imported again if the calendar is re-added there. removedAt is what
      // stops the next sync walking it straight back in.
      await prisma.$transaction([
        prisma.calendarEvent.deleteMany({ where: { agendaId: agenda.id } }),
        prisma.agenda.update({ where: { id: agenda.id }, data: { removedAt: new Date() } }),
      ]);
      return reply.code(204).send();
    }

    // Where this agenda's events go. Guaranteed to exist and to be a different
    // row: the default is what they move to, and the default cannot be the
    // agenda being deleted — that was refused above.
    const target = await defaultAgendaFor(request.authUser.id);
    if (!target) {
      return reply.code(400).send({ error: 'É preciso ter outra agenda antes de remover esta' });
    }

    await prisma.$transaction([
      prisma.calendarEvent.updateMany({
        where: { agendaId: agenda.id },
        data: { agendaId: target.id },
      }),
      prisma.agenda.delete({ where: { id: agenda.id } }),
    ]);

    return reply.code(204).send();
  });

  /** How many events would move if this agenda were deleted — for the modal. */
  app.get<{ Params: { id: string } }>('/:id/event-count', async (request, reply) => {
    const agenda = await ownedAgenda(request.params.id, request.authUser.id);
    if (!agenda) return reply.code(404).send({ error: 'Agenda não encontrada' });

    const count = await prisma.calendarEvent.count({ where: { agendaId: agenda.id } });
    return { count };
  });
}
