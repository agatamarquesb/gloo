import type { FastifyInstance } from 'fastify';

import { LabelScope } from '@gloo/shared';
import type { CreateRoutineInput, UpdateRoutineInput } from '@gloo/shared';

import { canMutate } from '../../lib/authorize';
import { labelIdsInScope } from '../../lib/labelScope';
import { prisma } from '../../lib/prisma';
import { sanitizeNotes } from '../../lib/sanitizeHtml';

import {
  normaliseWeekdays,
  routineInclude,
  toJsonAttachments,
  toJsonChecklists,
  toRoutineDto,
  type RoutineWithRelations,
} from './mapper';
import { isCurrentlyDone } from './reset';

async function loadRoutineOrThrow(id: string): Promise<RoutineWithRelations> {
  const routine = await prisma.routine.findUnique({ where: { id }, include: routineInclude });
  if (!routine) {
    const error = new Error('Routine not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return routine;
}

/** The shape `canMutate` expects, from a routine's join rows. */
function mutationSubject(routine: RoutineWithRelations) {
  return {
    createdById: routine.createdById,
    assigneeIds: routine.assignees.map(({ userId }) => userId),
  };
}

/**
 * What a weekly routine's cadence comes down to on the way into the database.
 *
 * A custom schedule is the set; an ordinary one is the single day. Either way
 * `weekday` ends up holding the earliest day in the set, so the two columns can
 * never tell different stories about the same routine — see the schema.
 */
function weeklyCadence(
  weekday: number | null | undefined,
  weekdays: number[] | undefined,
): { weekday: number | null; weekdays: number[] } {
  const set = normaliseWeekdays(weekdays);
  if (set.length > 0) return { weekday: set[0], weekdays: set };
  return { weekday: weekday ?? null, weekdays: [] };
}

function validateRecurrenceFields(
  recurrence: string | undefined,
  weekday: number | null | undefined,
  dayOfMonth: number | null | undefined,
  weekdays: number[] | undefined,
): string | null {
  if (
    recurrence === 'WEEKLY' &&
    (weekday === undefined || weekday === null) &&
    normaliseWeekdays(weekdays).length === 0
  ) {
    return 'weekday é obrigatório para rotinas semanais';
  }
  // Only when something was actually sent: an array that survives normalising
  // as empty is either "no custom schedule" or a list of nothing but rubbish,
  // and silently accepting the second would store a weekly routine with no day.
  if (Array.isArray(weekdays) && weekdays.length > 0 && normaliseWeekdays(weekdays).length === 0) {
    return 'weekdays deve conter dias entre 0 e 6';
  }
  if (recurrence === 'MONTHLY' && (dayOfMonth === undefined || dayOfMonth === null)) {
    return 'dayOfMonth é obrigatório para rotinas mensais';
  }
  if (weekday !== undefined && weekday !== null && (weekday < 0 || weekday > 6)) {
    return 'weekday deve estar entre 0 e 6';
  }
  if (dayOfMonth !== undefined && dayOfMonth !== null && (dayOfMonth < 1 || dayOfMonth > 31)) {
    return 'dayOfMonth deve estar entre 1 e 31';
  }
  return null;
}

export async function routineRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const { assigneeId } = request.query as { assigneeId?: string };

    const routines = await prisma.routine.findMany({
      // Trashed routines are still rows — see `deletedAt` in the schema — so
      // every list of live ones has to say so.
      where: {
        deletedAt: null,
        ...(assigneeId ? { assignees: { some: { userId: assigneeId } } } : {}),
      },
      include: routineInclude,
      orderBy: { createdAt: 'asc' },
    });

    return routines.map(toRoutineDto);
  });

  /**
   * The trash, newest first — what you just deleted is what you are most likely
   * to want back. Company-wide rather than scoped to the caller, like the
   * Routines card itself: a routine is shared, so anyone who could delete it can
   * see it sitting in the bin.
   */
  app.get('/deleted', async () => {
    const routines = await prisma.routine.findMany({
      where: { deletedAt: { not: null } },
      include: routineInclude,
      orderBy: { deletedAt: 'desc' },
    });

    return routines.map(toRoutineDto);
  });

  /**
   * Empties the trash for good — all of it, or just the `ids` the caller names.
   *
   * Guarded per routine rather than wholesale either way: a user clears the ones
   * they could have deleted themselves and leaves anyone else's where they are,
   * so one person's tidying can never destroy another's work. Naming ids that
   * are live, absent, or someone else's is not an error; they are simply not
   * among the ones deleted, and the count says so.
   */
  app.delete<{ Body?: { ids?: string[] } }>('/deleted', async (request) => {
    const ids = request.body?.ids;

    const trashed = await prisma.routine.findMany({
      where: {
        deletedAt: { not: null },
        ...(Array.isArray(ids) ? { id: { in: ids } } : {}),
      },
      include: routineInclude,
    });

    const removable = trashed
      .filter((routine) => canMutate(request.authUser, mutationSubject(routine)))
      .map(({ id }) => id);

    if (removable.length > 0) {
      await prisma.routine.deleteMany({ where: { id: { in: removable } } });
    }

    return { deleted: removable.length };
  });

  app.post<{ Body: CreateRoutineInput }>('/', async (request, reply) => {
    const {
      description,
      recurrence,
      weekday,
      weekdays,
      dayOfMonth,
      notes,
      checklists,
      attachments,
      labelIds,
      assigneeIds,
    } = request.body;

    if (!description || !recurrence || !assigneeIds?.length) {
      return reply
        .code(400)
        .send({ error: 'description, recurrence e assigneeIds são obrigatórios' });
    }
    const invalid = validateRecurrenceFields(recurrence, weekday, dayOfMonth, weekdays);
    if (invalid) return reply.code(400).send({ error: invalid });

    const weekly = weeklyCadence(weekday, weekdays);

    const routine = await prisma.routine.create({
      data: {
        description,
        recurrence,
        weekday: recurrence === 'WEEKLY' ? weekly.weekday : null,
        weekdays: recurrence === 'WEEKLY' ? weekly.weekdays : [],
        dayOfMonth: recurrence === 'MONTHLY' ? (dayOfMonth ?? null) : null,
        notes: sanitizeNotes(notes),
        checklists: toJsonChecklists(checklists),
        attachments: toJsonAttachments(attachments),
        createdById: request.authUser.id,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
        // Only ids from the routine pool — see labelIdsInScope.
        labels: {
          create: (await labelIdsInScope(labelIds ?? [], LabelScope.ROUTINE)).map((labelId) => ({
            labelId,
          })),
        },
      },
      include: routineInclude,
    });

    return reply.code(201).send(toRoutineDto(routine));
  });

  app.patch<{ Body: UpdateRoutineInput; Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const existing = await loadRoutineOrThrow(request.params.id);

      if (!canMutate(request.authUser, mutationSubject(existing))) {
        return reply.code(403).send({ error: 'Sem permissão para editar esta rotina' });
      }

      const {
        description,
        recurrence,
        weekday,
        weekdays,
        dayOfMonth,
        notes,
        checklists,
        attachments,
        labelIds,
        assigneeIds,
      } = request.body;

      if (assigneeIds !== undefined && assigneeIds.length === 0) {
        return reply.code(400).send({ error: 'A rotina precisa de ao menos um responsável' });
      }

      const nextRecurrence = recurrence ?? existing.recurrence;
      // A PATCH that names neither falls back to what is stored, so switching a
      // routine from monthly to weekly keeps the weekday it had. `weekdays` is
      // the exception: sending `[]` is how a custom schedule is turned back into
      // a single day, so an explicit empty array must not be read as "unchanged".
      const nextWeekdays = weekdays === undefined ? existing.weekdays : weekdays;
      const invalid = validateRecurrenceFields(
        nextRecurrence,
        weekday ?? existing.weekday,
        dayOfMonth ?? existing.dayOfMonth,
        nextWeekdays,
      );
      if (invalid) return reply.code(400).send({ error: invalid });

      const weekly = weeklyCadence(weekday ?? existing.weekday, nextWeekdays);

      const routine = await prisma.routine.update({
        where: { id: request.params.id },
        data: {
          ...(description !== undefined ? { description } : {}),
          ...(recurrence !== undefined ? { recurrence } : {}),
          ...(notes !== undefined ? { notes: sanitizeNotes(notes) } : {}),
          ...(checklists !== undefined ? { checklists: toJsonChecklists(checklists) } : {}),
          ...(attachments !== undefined ? { attachments: toJsonAttachments(attachments) } : {}),
          // Replace rather than merge: the modal always sends the full set, so
          // deleting the last assignee or label has to be expressible.
          ...(assigneeIds !== undefined
            ? { assignees: { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) } }
            : {}),
          ...(labelIds !== undefined
            ? {
                labels: {
                  deleteMany: {},
                  create: (await labelIdsInScope(labelIds, LabelScope.ROUTINE)).map((labelId) => ({
                    labelId,
                  })),
                },
              }
            : {}),
          // Keep the unused cadence field null so a switched routine can't keep
          // a stale weekday/day-of-month around.
          ...(recurrence !== undefined ||
          weekday !== undefined ||
          weekdays !== undefined ||
          dayOfMonth !== undefined
            ? {
                weekday: nextRecurrence === 'WEEKLY' ? weekly.weekday : null,
                weekdays: nextRecurrence === 'WEEKLY' ? weekly.weekdays : [],
                dayOfMonth:
                  nextRecurrence === 'MONTHLY' ? (dayOfMonth ?? existing.dayOfMonth) : null,
              }
            : {}),
        },
        include: routineInclude,
      });

      return toRoutineDto(routine);
    },
  );

  app.patch<{ Body: { done: boolean }; Params: { id: string } }>(
    '/:id/toggle',
    async (request, reply) => {
      const existing = await loadRoutineOrThrow(request.params.id);

      if (!canMutate(request.authUser, mutationSubject(existing))) {
        return reply.code(403).send({ error: 'Sem permissão para editar esta rotina' });
      }

      const done = request.body?.done ?? !isCurrentlyDone(existing);

      const routine = await prisma.routine.update({
        where: { id: request.params.id },
        data: { done, ...(done ? { lastCompletedAt: new Date() } : {}) },
        include: routineInclude,
      });

      return toRoutineDto(routine);
    },
  );

  /**
   * Destroys one routine outright, for the "Deletar permanente" in the trash.
   *
   * Its own route rather than a flag on DELETE /:id: that one is what the
   * Routines card calls, and the difference between the two is the difference
   * between reversible and not. Nothing that can destroy a routine should be
   * reachable by getting an argument wrong.
   */
  app.delete<{ Params: { id: string } }>('/:id/permanent', async (request, reply) => {
    const existing = await loadRoutineOrThrow(request.params.id);

    if (!canMutate(request.authUser, mutationSubject(existing))) {
      return reply.code(403).send({ error: 'Sem permissão para excluir esta rotina' });
    }

    await prisma.routine.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });

  /** Puts a trashed routine back. Same rule as deleting it in the first place. */
  app.post<{ Params: { id: string } }>('/:id/restore', async (request, reply) => {
    const existing = await loadRoutineOrThrow(request.params.id);

    if (!canMutate(request.authUser, mutationSubject(existing))) {
      return reply.code(403).send({ error: 'Sem permissão para editar esta rotina' });
    }

    const routine = await prisma.routine.update({
      where: { id: request.params.id },
      data: { deletedAt: null },
      include: routineInclude,
    });

    return toRoutineDto(routine);
  });

  // Reversible: this moves the routine to the trash rather than removing it.
  // DELETE /deleted above is the one that actually destroys anything.
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await loadRoutineOrThrow(request.params.id);

    if (!canMutate(request.authUser, mutationSubject(existing))) {
      return reply.code(403).send({ error: 'Sem permissão para excluir esta rotina' });
    }

    await prisma.routine.update({
      where: { id: request.params.id },
      data: { deletedAt: new Date() },
    });
    return reply.code(204).send();
  });
}
