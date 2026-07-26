import type { FastifyInstance } from 'fastify';

import type { CreateRoutineInput, RoutineDto, UpdateRoutineInput, UserDto } from '@gloo/shared';

import { canMutate } from '../../lib/authorize';
import { prisma } from '../../lib/prisma';
import { isCurrentlyDone } from './reset';

const routineInclude = { assignee: true } as const;

type RoutineWithAssignee = {
  id: string;
  description: string;
  recurrence: 'WEEKLY' | 'MONTHLY';
  weekday: number | null;
  dayOfMonth: number | null;
  done: boolean;
  lastCompletedAt: Date | null;
  createdById: string;
  assignee: { id: string; email: string; name: string; role: string; avatarUrl: string | null };
};

function toRoutineDto(routine: RoutineWithAssignee): RoutineDto {
  return {
    id: routine.id,
    description: routine.description,
    recurrence: routine.recurrence,
    weekday: routine.weekday,
    dayOfMonth: routine.dayOfMonth,
    // Effective state for "now", not the stored flag — see reset.ts.
    done: isCurrentlyDone(routine),
    assignee: {
      id: routine.assignee.id,
      email: routine.assignee.email,
      name: routine.assignee.name,
      role: routine.assignee.role as UserDto['role'],
      avatarUrl: routine.assignee.avatarUrl,
    },
    createdById: routine.createdById,
  };
}

async function loadRoutineOrThrow(id: string) {
  const routine = await prisma.routine.findUnique({ where: { id }, include: routineInclude });
  if (!routine) {
    const error = new Error('Routine not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return routine;
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
      where: assigneeId ? { assigneeId } : {},
      include: routineInclude,
      orderBy: { createdAt: 'asc' },
    });

    return routines.map(toRoutineDto);
  });

  app.post<{ Body: CreateRoutineInput }>('/', async (request, reply) => {
    const { description, recurrence, weekday, dayOfMonth, assigneeId } = request.body;

    if (!description || !recurrence || !assigneeId) {
      return reply
        .code(400)
        .send({ error: 'description, recurrence e assigneeId são obrigatórios' });
    }
    const invalid = validateRecurrenceFields(recurrence, weekday, dayOfMonth);
    if (invalid) return reply.code(400).send({ error: invalid });

    const routine = await prisma.routine.create({
      data: {
        description,
        recurrence,
        weekday: recurrence === 'WEEKLY' ? (weekday ?? null) : null,
        dayOfMonth: recurrence === 'MONTHLY' ? (dayOfMonth ?? null) : null,
        assigneeId,
        createdById: request.authUser.id,
      },
      include: routineInclude,
    });

    return reply.code(201).send(toRoutineDto(routine));
  });

  app.patch<{ Body: UpdateRoutineInput; Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const existing = await loadRoutineOrThrow(request.params.id);

      if (
        !canMutate(request.authUser, {
          createdById: existing.createdById,
          assigneeIds: [existing.assigneeId],
        })
      ) {
        return reply.code(403).send({ error: 'Sem permissão para editar esta rotina' });
      }

      const { description, recurrence, weekday, dayOfMonth, assigneeId } = request.body;
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
          ...(assigneeId !== undefined ? { assigneeId } : {}),
          ...(recurrence !== undefined ? { recurrence } : {}),
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

      if (
        !canMutate(request.authUser, {
          createdById: existing.createdById,
          assigneeIds: [existing.assigneeId],
        })
      ) {
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

    if (
      !canMutate(request.authUser, {
        createdById: existing.createdById,
        assigneeIds: [existing.assigneeId],
      })
    ) {
      return reply.code(403).send({ error: 'Sem permissão para excluir esta rotina' });
    }

    await prisma.routine.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });
}
