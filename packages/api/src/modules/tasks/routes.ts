import type { FastifyInstance } from 'fastify';

import { isTaskStatus } from '@gloo/shared';
import type { CreateTaskInput, TaskBySectorDto, TaskSummaryDto, UpdateTaskInput } from '@gloo/shared';

import { canMutate } from '../../lib/authorize';
import { prisma } from '../../lib/prisma';
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
    dueDateFilter.lt = new Date();
    where.status = { not: 'DONE' };
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
    const query = request.query as { assigneeId?: string };
    const assigneeFilter = query.assigneeId ? { assignees: { some: { userId: query.assigneeId } } } : {};
    const now = new Date();

    const [upcoming, inProgress, completed, overdue] = await Promise.all([
      prisma.task.count({ where: { ...assigneeFilter, status: 'TODO' } }),
      prisma.task.count({ where: { ...assigneeFilter, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { ...assigneeFilter, status: 'DONE' } }),
      prisma.task.count({
        where: { ...assigneeFilter, status: { not: 'DONE' }, dueDate: { lt: now } },
      }),
    ]);

    return { upcoming, inProgress, completed, overdue };
  });

  app.get('/by-sector', async (): Promise<TaskBySectorDto[]> => {
    const sectors = await prisma.sector.findMany({ orderBy: { name: 'asc' } });
    const counts = await prisma.task.groupBy({
      by: ['sectorId'],
      where: { status: { not: 'DONE' } },
      _count: true,
    });
    const countBySector = new Map(counts.map((c) => [c.sectorId, c._count]));

    return sectors.map((sector) => ({
      sector: { id: sector.id, name: sector.name },
      pendingCount: countBySector.get(sector.id) ?? 0,
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
    const { title, description, priority, dueDate, sectorId, assigneeIds } = request.body;

    if (!title || !priority || !sectorId) {
      return reply.code(400).send({ error: 'title, priority e sectorId são obrigatórios' });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        sectorId,
        createdById: request.authUser.id,
        assignees: { create: (assigneeIds ?? []).map((userId) => ({ userId })) },
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

    const { title, description, priority, dueDate, sectorId, assigneeIds } = request.body;

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(sectorId !== undefined ? { sectorId } : {}),
        ...(assigneeIds !== undefined
          ? { assignees: { deleteMany: {}, create: assigneeIds.map((userId) => ({ userId })) } }
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
      data: { status: request.body.status },
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
