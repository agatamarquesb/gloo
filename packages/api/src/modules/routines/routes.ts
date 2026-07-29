import type { FastifyInstance } from 'fastify';

import type { CreateRoutineInput, UpdateRoutineInput } from '@gloo/shared';

import { canMutate } from '../../lib/authorize';
import { prisma } from '../../lib/prisma';
import { sanitizeNotes } from '../../lib/sanitizeHtml';

import {
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

function validateRecurrenceFields(
  recurrence: string | undefined,
  weekday: number | null | undefined,
  dayOfMonth: number | null | undefined,
): string | null {
  if (recurrence === 'WEEKLY' && (weekday === undefined || weekday === null)) {
    return 'weekday é obrigatório para rotinas semanais';
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
      where: assigneeId ? { assignees: { some: { userId: assigneeId } } } : {},
      include: routineInclude,
      orderBy: { createdAt: 'asc' },
    });

    return routines.map(toRoutineDto);
  });

  app.post<{ Body: CreateRoutineInput }>('/', async (request, reply) => {
    const {
      description,
      recurrence,
      weekday,
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
    const invalid = validateRecurrenceFields(recurrence, weekday, dayOfMonth);
    if (invalid) return reply.code(400).send({ error: invalid });

    const routine = await prisma.routine.create({
      data: {
        description,
        recurrence,
        weekday: recurrence === 'WEEKLY' ? (weekday ?? null) : null,
        dayOfMonth: recurrence === 'MONTHLY' ? (dayOfMonth ?? null) : null,
        notes: sanitizeNotes(notes),
        checklists: toJsonChecklists(checklists),
        attachments: toJsonAttachments(attachments),
        createdById: request.authUser.id,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
        labels: { create: (labelIds ?? []).map((labelId) => ({ labelId })) },
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
      const invalid = validateRecurrenceFields(
        nextRecurrence,
        weekday ?? existing.weekday,
        dayOfMonth ?? existing.dayOfMonth,
      );
      if (invalid) return reply.code(400).send({ error: invalid });

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
            ? { labels: { deleteMany: {}, create: labelIds.map((labelId) => ({ labelId })) } }
            : {}),
          // Keep the unused cadence field null so a switched routine can't keep
          // a stale weekday/day-of-month around.
          ...(recurrence !== undefined || weekday !== undefined || dayOfMonth !== undefined
            ? {
                weekday: nextRecurrence === 'WEEKLY' ? (weekday ?? existing.weekday) : null,
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

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const existing = await loadRoutineOrThrow(request.params.id);

    if (!canMutate(request.authUser, mutationSubject(existing))) {
      return reply.code(403).send({ error: 'Sem permissão para excluir esta rotina' });
    }

    await prisma.routine.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });
}
