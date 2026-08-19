import type { FastifyInstance } from 'fastify';

import {
  endOfDayInZone,
  expandEvents,
  isEventRecurrence,
  isPaletteColor,
  type CalendarEventDto,
  type CreateEventInput,
  type RecurrenceMaster,
  type UpdateEventInput,
} from '@gloo/shared';

import { prisma } from '../../lib/prisma';
import { sanitizeNotes } from '../../lib/sanitizeHtml';
import { deleteRemoteEvent, pushEvent, setRemoteTaskStatus } from './google/push';
import { eventInclude, toCalendarEventDto } from './mapper';
import { defaultAgendaFor, ensureCalendarProvisioned } from './provision';

/** A window wider than this is a client bug, and expanding it is expensive. */
const MAX_RANGE_DAYS = 400;

/**
 * Whether this write should email the event's attendees.
 *
 * Opt-in, and absent means no: an email to somebody's inbox is not a default a
 * missing query parameter should be able to trigger. The client asks the user
 * and says so explicitly — see ConfirmEventChangeModal — and the push layer
 * still refuses to send when the only person on the event is its creator.
 */
function wantsNotify(query: { notify?: string }): boolean {
  return query.notify === 'true';
}

/**
 * The agendas a user can see, plus the id of the row that stands in for events
 * somebody else owns.
 */
async function visibleAgendas(userId: string) {
  const agendas = await prisma.agenda.findMany({
    where: { userId, removedAt: null },
    select: { id: true, isSharedInbox: true },
  });

  return {
    ownIds: agendas.filter((agenda) => !agenda.isSharedInbox).map((agenda) => agenda.id),
    sharedInboxId: agendas.find((agenda) => agenda.isSharedInbox)?.id ?? null,
  };
}

/**
 * An event is visible to whoever owns the agenda it sits on, and to anyone
 * assigned to it.
 *
 * The second half is what makes personal agendas workable: a meeting created on
 * a colleague's agenda still has to reach the people it is for. Those events are
 * re-tagged onto the viewer's shared inbox on the way out — see remapAgenda —
 * so they take a colour and answer an eye icon like anything else on the grid.
 */
function visibilityWhere(userId: string, ownAgendaIds: string[]) {
  return {
    OR: [{ agendaId: { in: ownAgendaIds } }, { assignees: { some: { userId } } }],
  };
}

/**
 * Events on someone else's agenda are shown under the viewer's shared inbox.
 *
 * Without this the DTO would name an agenda the viewer has no row for, and the
 * grid would fail to find a colour for it and drop it from every filter.
 */
function remapAgenda(
  dto: CalendarEventDto,
  ownAgendaIds: string[],
  sharedInboxId: string | null,
): CalendarEventDto {
  if (ownAgendaIds.includes(dto.agendaId) || !sharedInboxId) return dto;
  // Someone else's agenda is not ours to edit through, whatever our rights on
  // the event itself.
  return { ...dto, agendaId: sharedInboxId, isReadOnly: true };
}

/**
 * Re-read an event after it has been mirrored to Google.
 *
 * pushEvent writes `googleEventId`, `googleEtag` and `lastSyncedAt` onto the
 * row, so a response built from the snapshot taken *before* the push reports an
 * event that has no Google mirror — which is what `isFromGoogle` is derived
 * from. The client then caches a DTO that contradicts the database until
 * something else happens to invalidate it.
 */
async function reread(id: string) {
  return prisma.calendarEvent.findUniqueOrThrow({ where: { id }, include: eventInclude });
}

/** Load an event the caller is allowed to change, or null. */
async function mutableEvent(id: string, userId: string, ownAgendaIds: string[]) {
  const event = await prisma.calendarEvent.findFirst({
    where: { id, ...visibilityWhere(userId, ownAgendaIds) },
    include: { ...eventInclude, agenda: { select: { isReadOnly: true, googleCalendarId: true } } },
  });

  if (!event) return null;
  // A read-only Google calendar rejects writes at the far end, so refusing here
  // keeps our copy from drifting out of step with it.
  if (event.agenda.isReadOnly) return null;
  return event;
}

export async function calendarEventRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply): Promise<CalendarEventDto[] | undefined> => {
    await ensureCalendarProvisioned(request.authUser.id);

    const { from, to } = request.query as { from?: string; to?: string };
    if (!from || !to) return reply.code(400).send({ error: 'from e to são obrigatórios' });

    const windowStart = new Date(from);
    const windowEnd = new Date(to);
    if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
      return reply.code(400).send({ error: 'from e to precisam ser datas válidas' });
    }
    if (windowEnd.getTime() - windowStart.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      return reply.code(400).send({ error: 'Intervalo muito longo' });
    }

    const { ownIds, sharedInboxId } = await visibleAgendas(request.authUser.id);
    const visible = visibilityWhere(request.authUser.id, ownIds);

    const [singles, masters, exceptions] = await Promise.all([
      // One-off events: neither a series nor an override of one.
      prisma.calendarEvent.findMany({
        where: {
          ...visible,
          recurrence: null,
          recurringEventId: null,
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        include: eventInclude,
      }),
      // Series whose run could reach into the window. No upper bound on
      // startsAt beyond the window's end, and no lower bound at all — a weekly
      // event started two years ago is still running today.
      prisma.calendarEvent.findMany({
        where: {
          ...visible,
          recurrence: { not: null },
          recurringEventId: null,
          startsAt: { lt: windowEnd },
          // A null until is a series with no end, which every window reaches.
          OR: [{ recurrenceUntil: null }, { recurrenceUntil: { gte: windowStart } }],
        },
        include: eventInclude,
      }),
      // Every override of those series, in the window or not: one outside it
      // still has to suppress the slot it replaces.
      prisma.calendarEvent.findMany({
        where: { ...visible, recurringEventId: { not: null } },
        include: eventInclude,
      }),
    ]);

    const masterById = new Map(masters.map((master) => [master.id, master]));

    const instances = expandEvents(
      masters.map(
        (master): RecurrenceMaster => ({
          id: master.id,
          startsAt: master.startsAt.toISOString(),
          endsAt: master.endsAt.toISOString(),
          recurrence: isEventRecurrence(master.recurrence) ? master.recurrence : null,
          recurrenceUntil: master.recurrenceUntil?.toISOString() ?? null,
          byWeekdays: master.byWeekdays,
          timeZone: master.timeZone,
        }),
      ),
      exceptions.map((exception) => ({
        recurringEventId: exception.recurringEventId!,
        originalStart: exception.originalStart!.toISOString(),
      })),
      windowStart,
      windowEnd,
    );

    const generated = instances.flatMap((instance) => {
      const master = masterById.get(instance.masterId);
      if (!master) return [];
      return [
        toCalendarEventDto(master, {
          startsAt: instance.startsAt,
          endsAt: instance.endsAt,
          originalStart: instance.originalStart,
          recurringEventId: master.id,
        }),
      ];
    });

    // A cancelled override is a deleted occurrence: it has done its job by
    // suppressing the generated slot above, and must not appear itself.
    const editedInstances = exceptions
      .filter(
        (exception) =>
          !exception.isCancelled &&
          exception.startsAt < windowEnd &&
          exception.endsAt > windowStart,
      )
      .map((exception) => toCalendarEventDto(exception));

    return [...singles.map((event) => toCalendarEventDto(event)), ...generated, ...editedInstances]
      .map((dto) => remapAgenda(dto, ownIds, sharedInboxId))
      .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt));
  });

  app.post<{ Body: CreateEventInput; Querystring: { notify?: string } }>('/', async (request, reply) => {
    await ensureCalendarProvisioned(request.authUser.id);
    const body = request.body ?? ({} as CreateEventInput);

    if (!body.title?.trim()) return reply.code(400).send({ error: 'title é obrigatório' });
    if (!body.startsAt || !body.endsAt) {
      return reply.code(400).send({ error: 'startsAt e endsAt são obrigatórios' });
    }
    if (new Date(body.endsAt) < new Date(body.startsAt)) {
      return reply.code(400).send({ error: 'O fim precisa ser depois do início' });
    }
    if (body.recurrence !== undefined && body.recurrence !== null) {
      if (!isEventRecurrence(body.recurrence)) {
        return reply.code(400).send({ error: 'Recorrência inválida' });
      }
    }
    if (body.color !== undefined && body.color !== null && !isPaletteColor(body.color)) {
      return reply.code(400).send({ error: 'color inválida' });
    }

    // An agenda the caller owns and can write to, or their default. Checked
    // rather than trusted: the id arrives from the client.
    const agenda = body.agendaId
      ? await prisma.agenda.findFirst({
          where: {
            id: body.agendaId,
            userId: request.authUser.id,
            removedAt: null,
            isSharedInbox: false,
            isReadOnly: false,
          },
        })
      : await defaultAgendaFor(request.authUser.id);

    if (!agenda) return reply.code(400).send({ error: 'Agenda inválida' });

    const timeZone = body.timeZone || 'UTC';

    const event = await prisma.calendarEvent.create({
      data: {
        agendaId: agenda.id,
        createdById: request.authUser.id,
        title: body.title.trim(),
        // Through the sanitiser like a task's description: the same rich-text
        // editor writes it, so it arrives as markup.
        description: sanitizeNotes(body.description),
        location: body.location?.trim() || null,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        isAllDay: body.isAllDay ?? false,
        timeZone,
        recurrence: body.recurrence ?? null,
        // The user picks a day; the series has to include all of it. Left null
        // when they chose no end date at all.
        recurrenceUntil: body.recurrenceUntil
          ? new Date(endOfDayInZone(body.recurrenceUntil, timeZone))
          : null,
        byWeekdays: body.byWeekdays ?? [],
        // Null and absent are the same answer here: no colour of its own, so
        // the block wears its agenda's.
        color: body.color ?? null,
        assignees: { create: (body.assigneeIds ?? []).map((userId) => ({ userId })) },
      },
      include: eventInclude,
    });

    // Mirrored to Google after our own write, and awaited so the response
    // carries the googleEventId — a create that returned before the push would
    // let an immediate edit push a second copy instead of updating the first.
    // A failure only costs the mirror; see pushEvent.
    await pushEvent(
      event.id,
      (error) => request.log.warn({ err: error }, 'Google push failed'),
      wantsNotify(request.query),
    );

    return reply.code(201).send(toCalendarEventDto(await reread(event.id)));
  });

  app.patch<{
    Body: UpdateEventInput;
    Params: { id: string };
    Querystring: { scope?: string; originalStart?: string; notify?: string };
  }>('/:id', async (request, reply) => {
    const { ownIds } = await visibleAgendas(request.authUser.id);
    const existing = await mutableEvent(request.params.id, request.authUser.id, ownIds);
    if (!existing) return reply.code(404).send({ error: 'Evento não encontrado' });

    const body = request.body ?? {};
    if (body.title !== undefined && !body.title.trim()) {
      return reply.code(400).send({ error: 'title é obrigatório' });
    }
    if (body.startsAt && body.endsAt && new Date(body.endsAt) < new Date(body.startsAt)) {
      return reply.code(400).send({ error: 'O fim precisa ser depois do início' });
    }
    if (body.color !== undefined && body.color !== null && !isPaletteColor(body.color)) {
      return reply.code(400).send({ error: 'color inválida' });
    }

    const timeZone = body.timeZone ?? existing.timeZone;

    const data = {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined
        ? { description: sanitizeNotes(body.description) }
        : {}),
      ...(body.location !== undefined ? { location: body.location?.trim() || null } : {}),
      ...(body.startsAt !== undefined ? { startsAt: new Date(body.startsAt) } : {}),
      ...(body.endsAt !== undefined ? { endsAt: new Date(body.endsAt) } : {}),
      ...(body.isAllDay !== undefined ? { isAllDay: body.isAllDay } : {}),
      ...(body.timeZone !== undefined ? { timeZone } : {}),
      ...(body.byWeekdays !== undefined ? { byWeekdays: body.byWeekdays } : {}),
      // Unlike most fields here, null is a value rather than "leave it": it is
      // how "Padrão" in the colour panel puts the block back on its agenda.
      ...(body.color !== undefined ? { color: body.color } : {}),
      ...(body.assigneeIds !== undefined
        ? {
            assignees: {
              deleteMany: {},
              create: body.assigneeIds.map((userId) => ({ userId })),
            },
          }
        : {}),
    };

    // Editing one occurrence of a series writes an exception row keyed on the
    // slot it replaces, which is exactly how Google models it. `originalStart`
    // says which slot; without one there is nothing to key on and the edit can
    // only mean the whole series.
    const isSingleOccurrence =
      request.query.scope === 'THIS' &&
      existing.recurrence !== null &&
      Boolean(request.query.originalStart);

    if (isSingleOccurrence) {
      const originalStart = new Date(request.query.originalStart!);

      const exception = await prisma.calendarEvent.upsert({
        where: {
          recurringEventId_originalStart: { recurringEventId: existing.id, originalStart },
        },
        create: {
          agendaId: existing.agendaId,
          createdById: existing.createdById,
          title: body.title?.trim() ?? existing.title,
          description:
            body.description !== undefined
              ? sanitizeNotes(body.description)
              : existing.description,
          location: body.location !== undefined ? body.location?.trim() || null : existing.location,
          startsAt: body.startsAt ? new Date(body.startsAt) : originalStart,
          endsAt: body.endsAt
            ? new Date(body.endsAt)
            : new Date(
                originalStart.getTime() +
                  (existing.endsAt.getTime() - existing.startsAt.getTime()),
              ),
          isAllDay: body.isAllDay ?? existing.isAllDay,
          timeZone,
          color: body.color !== undefined ? body.color : existing.color,
          recurringEventId: existing.id,
          originalStart,
          assignees: {
            create: (body.assigneeIds ?? existing.assignees.map((link) => link.userId)).map(
              (userId) => ({ userId }),
            ),
          },
        },
        // The occurrence already had an exception — a second edit just updates
        // it rather than stacking another row on the same slot.
        update: data,
        include: eventInclude,
      });

      await pushEvent(
        exception.id,
        (error) => request.log.warn({ err: error }, 'Google push failed'),
        wantsNotify(request.query),
      );

      return toCalendarEventDto(await reread(exception.id));
    }

    // Changing the rule re-bases the whole series, so the until has to be
    // re-derived in whatever zone the event now claims.
    const recurrenceData =
      body.recurrence !== undefined || body.recurrenceUntil !== undefined
        ? {
            recurrence: body.recurrence ?? existing.recurrence,
            recurrenceUntil: body.recurrenceUntil
              ? new Date(endOfDayInZone(body.recurrenceUntil, timeZone))
              : body.recurrence === null
                ? null
                : existing.recurrenceUntil,
          }
        : {};

    const updated = await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: { ...data, ...recurrenceData },
      include: eventInclude,
    });

    // Tasks are a one-way street: they arrive from Google Tasks and nothing
    // about them is written back except the tick — see POST /:id/done. Editing
    // one here changes the Gloo copy alone, which is deliberate, because the
    // hour a task is given is a thing Google has no field for (its `due` is a
    // date; the API discards the time) and a half-mirrored task would be worse
    // than an unmirrored one. pushEvent already ignores them — a task list has
    // no googleCalendarId — so this only has to not add a second write.
    if (!updated.googleTaskId) {
      await pushEvent(
        updated.id,
        (error) => request.log.warn({ err: error }, 'Google push failed'),
        wantsNotify(request.query),
      );
    }

    return toCalendarEventDto(await reread(updated.id));
  });

  /**
   * Tick a Google task off, or put it back.
   *
   * Its own route rather than a field on PATCH /:id, because a task is not an
   * event being edited: nothing about it moves, and the write that matters
   * happens in Google Tasks — a different API, addressed by list + task id.
   *
   * Google first. If that write fails the row is left alone, so the tick a user
   * sees is never one that only exists here: the two would then disagree for as
   * long as the task lived.
   */
  app.post<{ Params: { id: string }; Body: { done?: boolean } }>(
    '/:id/done',
    async (request, reply) => {
      const { ownIds } = await visibleAgendas(request.authUser.id);

      const event = await prisma.calendarEvent.findFirst({
        where: { id: request.params.id, agendaId: { in: ownIds } },
        include: { agenda: { select: { account: { select: { id: true } } } } },
      });

      if (!event) return reply.code(404).send({ error: 'Item não encontrado' });
      if (event.kind !== 'TASK' || !event.googleTaskId || !event.googleTaskListId) {
        return reply.code(400).send({ error: 'Só uma tarefa pode ser concluída' });
      }

      const done = request.body?.done ?? true;

      try {
        await setRemoteTaskStatus(event.agenda.account.id, event.googleTaskListId, event.googleTaskId, done);
      } catch (caught) {
        request.log.warn({ err: caught }, 'Google task update failed');
        return reply.code(502).send({ error: 'Não foi possível atualizar no Google' });
      }

      const updated = await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { isDone: done },
      });

      return toCalendarEventDto(await reread(updated.id));
    },
  );

  app.delete<{
    Params: { id: string };
    Querystring: { scope?: string; originalStart?: string; notify?: string };
  }>(
    '/:id',
    async (request, reply) => {
      const { ownIds } = await visibleAgendas(request.authUser.id);
      const existing = await mutableEvent(request.params.id, request.authUser.id, ownIds);
      if (!existing) return reply.code(404).send({ error: 'Evento não encontrado' });

      const isSingleOccurrence =
        request.query.scope === 'THIS' &&
        existing.recurrence !== null &&
        Boolean(request.query.originalStart);

      if (isSingleOccurrence) {
        const originalStart = new Date(request.query.originalStart!);

        // A tombstone rather than a delete: expansion has no other way to know
        // the slot is gone, and Google needs the same row to cancel its own
        // instance when this syncs.
        await prisma.calendarEvent.upsert({
          where: {
            recurringEventId_originalStart: { recurringEventId: existing.id, originalStart },
          },
          create: {
            agendaId: existing.agendaId,
            createdById: existing.createdById,
            title: existing.title,
            startsAt: originalStart,
            endsAt: new Date(
              originalStart.getTime() + (existing.endsAt.getTime() - existing.startsAt.getTime()),
            ),
            timeZone: existing.timeZone,
            recurringEventId: existing.id,
            originalStart,
            isCancelled: true,
          },
          update: { isCancelled: true },
        });

        return reply.code(204).send();
      }

      // Google first, while the row is still here to say which remote event it
      // mirrors — afterwards there would be nothing left to look that up from.
      await deleteRemoteEvent(
        existing.id,
        (error) => request.log.warn({ err: error }, 'Google delete failed'),
        wantsNotify(request.query),
      );

      // Deleting a master takes its exceptions with it, by the cascade on the
      // self-relation — an override of a series that no longer exists is not
      // something anything could render.
      await prisma.calendarEvent.delete({ where: { id: existing.id } });
      return reply.code(204).send();
    },
  );
}
