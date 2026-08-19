import type { FastifyInstance } from 'fastify';

import { isTaskStatus, LabelScope } from '@gloo/shared';
import type { CreateTaskInput, TaskBySectorDto, TaskSummaryDto, UpdateTaskInput } from '@gloo/shared';

import { canMutate } from '../../lib/authorize';
import { labelIdsInScope } from '../../lib/labelScope';
import { prisma } from '../../lib/prisma';
import { sanitizeNotes } from '../../lib/sanitizeHtml';
import { toJsonAttachments } from '../routines/mapper';
import type { Prisma } from '../../../generated/prisma/client';
import { taskInclude, toTaskDetailDto, toTaskListItemDto } from './mapper';

function buildWhere(query: Record<string, string | undefined>): Prisma.TaskWhereInput {
  const { search, status, sectorId, assigneeId, dueDateFrom, dueDateTo } = query;
  const where: Prisma.TaskWhereInput = {};

  if (search) where.title = { contains: search, mode: 'insensitive' };
  if (sectorId) where.sectorId = sectorId;
  if (assigneeId) where.assignees = { some: { userId: assigneeId } };

  const dueDateFilter: Prisma.DateTimeNullableFilter = {};
  if (dueDateFrom) dueDateFilter.gte = new Date(dueDateFrom);
  if (dueDateTo) dueDateFilter.lte = new Date(dueDateTo);

  if (status === 'OVERDUE') {
    // Both kinds of late — the status somebody set, and the due date that ran
    // out on an unfinished task. The date bound goes inside the OR rather than
    // on `where.dueDate`, because a task marked late by hand may have no due
    // date at all and must still be in the answer.
    where.OR = [
      { status: 'OVERDUE' },
      { status: { notIn: ['DONE', 'OVERDUE'] }, dueDate: { lt: new Date() } },
    ];
  } else if (status && status !== 'ALL') {
    where.status = status as Prisma.EnumTaskStatusFilter['equals'];
  }

  if (Object.keys(dueDateFilter).length > 0) where.dueDate = dueDateFilter;

  return where;
}

const PRIORITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function sortTasks<T extends { dueDate: string | null; priority: string; progress: number }>(
  tasks: T[],
  sortBy: string | undefined,
  sortDir: string | undefined,
): T[] {
  if (!sortBy) return tasks;
  const dir = sortDir === 'DESC' ? -1 : 1;

  const value = (task: T): number => {
    if (sortBy === 'PRIORITY') return PRIORITY_RANK[task.priority] ?? 0;
    if (sortBy === 'PROGRESS') return task.progress;
    if (sortBy === 'DUE_DATE') return task.dueDate ? new Date(task.dueDate).getTime() : Infinity;
    return 0;
  };

  return tasks.toSorted((a, b) => (value(a) - value(b)) * dir);
}

/**
 * What a status change does to the task's clock — the one the productivity
 * chart will read. Nothing about it is shown while it runs: moving a task to
 * "Em andamento" starts it silently, and moving it off stops it.
 *
 * Written as a transition rather than a duration computed at the end, because a
 * task is not worked on in one sitting: it can be started, put back, and picked
 * up again days later, and only the stretches it actually spent in progress
 * should count. `startedAt` is the stretch in flight; `workedMs` is what the
 * finished ones came to.
 */
function timeTracking(
  existing: { status: string; workedMs: number; startedAt: Date | null },
  next: string,
): { workedMs?: number; startedAt?: Date | null; completedAt?: Date | null } {
  if (next === existing.status) return {};

  const now = new Date();
  const wasRunning = existing.status === 'IN_PROGRESS' && existing.startedAt !== null;
  // Guarded against a clock that went backwards between the two writes: a
  // negative stretch would eat time the task had genuinely spent.
  const stretch = wasRunning ? Math.max(0, now.getTime() - existing.startedAt!.getTime()) : 0;

  return {
    // Starting: the clock runs from now. Anything else: it stops, and whatever
    // it measured is banked.
    startedAt: next === 'IN_PROGRESS' ? now : null,
    ...(stretch > 0 ? { workedMs: existing.workedMs + stretch } : {}),
    // Cleared when a finished task is reopened, so the field never claims a
    // completion that was undone.
    completedAt: next === 'DONE' ? now : null,
  };
}

async function loadTaskOrThrow(id: string) {
  const task = await prisma.task.findUnique({ where: { id }, include: taskInclude });
  if (!task) {
    const error = new Error('Task not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return task;
}

export async function taskRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const where = buildWhere(query);

    const tasks = await prisma.task.findMany({ where, include: taskInclude });
    const dtos = tasks.map(toTaskListItemDto);

    return sortTasks(dtos, query.sortBy, query.sortDir);
  });

  app.get('/summary', async (request): Promise<TaskSummaryDto> => {
    const query = request.query as Record<string, string | undefined>;
    // Every filter the list itself takes *except* the status, through the same
    // builder the list uses. The figure on a filter has to be what pressing that
    // filter would show, so a summary that ignored the sector, the person or the
    // day picked on the month would have contradicted the rows underneath it.
    // The status is what each count supplies for itself below.
    const base = buildWhere({ ...query, status: undefined });
    const now = new Date();

    const [upcoming, inProgress, completed, overdue, total] = await Promise.all([
      prisma.task.count({ where: { ...base, status: 'TODO' } }),
      prisma.task.count({ where: { ...base, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...base, status: 'DONE' } }),
      prisma.task.count({
        // Same two kinds of late as the "Atrasada" filter — see buildWhere. The
        // OR is free to be set here because `base` was built without a status,
        // which is the only thing that would have claimed it.
        where: {
          ...base,
          OR: [
            { status: 'OVERDUE' },
            { status: { notIn: ['DONE', 'OVERDUE'] }, dueDate: { lt: now } },
          ],
        },
      }),
      // Its own count rather than the sum of the four: overdue overlaps TODO and
      // IN_PROGRESS, so adding them would over-report the whole list.
      prisma.task.count({ where: base }),
    ]);

    return { upcoming, inProgress, completed, overdue, total };
  });

  app.get('/by-sector', async (): Promise<TaskBySectorDto[]> => {
    const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } });
    // Every task, in every state. No `where` at all: the chart is the volume of
    // work each sector carries, and a finished task is still work that sector
    // did — see TaskBySectorDto. Filtering out DONE made a sector that had
    // cleared its list indistinguishable from one that never had anything.
    const counts = await prisma.task.groupBy({ by: ['sectorId'], _count: true });
    const countBySector = new Map(counts.map((c) => [c.sectorId, c._count]));

    return sectors.map((sector) => ({
      sector: { id: sector.id, name: sector.name },
      totalCount: countBySector.get(sector.id) ?? 0,
    }));
  });

  app.get('/calendar', async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const where: Prisma.TaskWhereInput = { dueDate: { not: null } };
    if (from || to) {
      where.dueDate = {
        not: null,
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const tasks = await prisma.task.findMany({ where, select: { dueDate: true, sectorId: true } });

    const byDate = new Map<string, Set<string>>();
    for (const task of tasks) {
      const dateKey = task.dueDate!.toISOString().slice(0, 10);
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Set());
      byDate.get(dateKey)!.add(task.sectorId);
    }

    return Array.from(byDate.entries()).map(([date, sectorIds]) => ({
      date,
      sectorIds: Array.from(sectorIds),
    }));
  });

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const task = await loadTaskOrThrow(id);
    return toTaskDetailDto(task);
  });

  app.post<{ Body: CreateTaskInput }>('/', async (request, reply) => {
    const { title, description, priority, dueDate, sectorId, assigneeIds, attachments, labelIds } =
      request.body;

    if (!title || !priority || !sectorId) {
      return reply.code(400).send({ error: 'title, priority e sectorId são obrigatórios' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        // Through the sanitiser like a routine's notes: the task modal writes
        // this field with the same rich-text editor, so it arrives as markup.
        description: sanitizeNotes(description),
        attachments: toJsonAttachments(attachments),
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        sectorId,
        createdById: request.authUser.id,
        assignees: { create: (assigneeIds ?? []).map((userId) => ({ userId })) },
        // Only ids from the task pool — see labelIdsInScope.
        labels: {
          create: (await labelIdsInScope(labelIds ?? [], LabelScope.TASK)).map((labelId) => ({
            labelId,
          })),
        },
      },
      include: taskInclude,
    });

    return reply.code(201).send(toTaskDetailDto(task));
  });

  app.patch<{ Body: UpdateTaskInput; Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = await loadTaskOrThrow(id);

    if (!canMutate(request.authUser, { createdById: existing.createdById, assigneeIds: existing.assignees.map((a) => a.userId) })) {
      return reply.code(403).send({ error: 'Sem permissão para editar esta tarefa' });
    }

    const { title, description, priority, dueDate, sectorId, assigneeIds, attachments, labelIds } =
      request.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description: sanitizeNotes(description) } : {}),
        ...(attachments !== undefined ? { attachments: toJsonAttachments(attachments) } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(sectorId !== undefined ? { sectorId } : {}),
        ...(assigneeIds !== undefined
          ? { assignees: { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) } }
          : {}),
        // Replaced wholesale, like the assignees: the modal sends the set it
        // wants, not a diff. Filtered to this pool, as on create.
        ...(labelIds !== undefined
          ? {
              labels: {
                deleteMany: {},
                create: (await labelIdsInScope(labelIds, LabelScope.TASK)).map((labelId) => ({
                  labelId,
                })),
              },
            }
          : {}),
      },
      include: taskInclude,
    });

    return toTaskDetailDto(task);
  });

  app.patch<{ Body: { status: string }; Params: { id: string } }>('/:id/status', async (request, reply) => {
    const { id } = request.params;
    const existing = await loadTaskOrThrow(id);

    if (!canMutate(request.authUser, { createdById: existing.createdById, assigneeIds: existing.assignees.map((a) => a.userId) })) {
      return reply.code(403).send({ error: 'Sem permissão para editar esta tarefa' });
    }

    // Checked rather than cast straight through: an unknown status used to reach
    // Postgres and come back as a 500, which said "we broke" about a request that
    // was simply wrong. IN_REVIEW made this real — it was a valid status once, so
    // anything still asking for it deserves a straight answer.
    if (!isTaskStatus(request.body.status)) {
      return reply.code(400).send({ error: 'Status inválido' });
    }

    const task = await prisma.task.update({
      where: { id },
      data: { status: request.body.status, ...timeTracking(existing, request.body.status) },
      include: taskInclude,
    });

    return toTaskDetailDto(task);
  });

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = await loadTaskOrThrow(id);

    if (!canMutate(request.authUser, { createdById: existing.createdById, assigneeIds: existing.assignees.map((a) => a.userId) })) {
      return reply.code(403).send({ error: 'Sem permissão para excluir esta tarefa' });
    }

    await prisma.task.delete({ where: { id } });
    return reply.code(204).send();
  });

  app.post<{ Body: { text: string }; Params: { taskId: string } }>(
    '/:taskId/subtasks',
    async (request, reply) => {
      const { taskId } = request.params;
      const existing = await loadTaskOrThrow(taskId);

      if (
        !canMutate(request.authUser, {
          createdById: existing.createdById,
          assigneeIds: existing.assignees.map((a) => a.userId),
        })
      ) {
        return reply.code(403).send({ error: 'Sem permissão para editar esta tarefa' });
      }

      const { text } = request.body;
      if (!text) {
        return reply.code(400).send({ error: 'text é obrigatório' });
      }

      const task = await prisma.task.update({
        where: { id: taskId },
        data: {
          subtasks: { create: { text, order: existing.subtasks.length } },
        },
        include: taskInclude,
      });

      return reply.code(201).send(toTaskDetailDto(task));
    },
  );
}
