import type { FastifyInstance } from 'fastify';

import { canMutate } from '../../lib/authorize';
import { prisma } from '../../lib/prisma';
import { taskInclude, toTaskDetailDto } from '../tasks/mapper';

async function loadSubtaskWithTaskOrThrow(id: string) {
  const subtask = await prisma.subtask.findUnique({
    where: { id },
    include: { task: { include: taskInclude } },
  });
  if (!subtask) {
    const error = new Error('Subtask not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return subtask;
}

export async function subtaskRoutes(app: FastifyInstance) {
  app.patch<{ Body: { text?: string; done?: boolean }; Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;
      const subtask = await loadSubtaskWithTaskOrThrow(id);

      if (
        !canMutate(request.authUser, {
          createdById: subtask.task.createdById,
          assigneeIds: subtask.task.assignees.map((a) => a.userId),
        })
      ) {
        return reply.code(403).send({ error: 'Sem permissão para editar esta subtarefa' });
      }

      const { text, done } = request.body;
      await prisma.subtask.update({
        where: { id },
        data: {
          ...(text !== undefined ? { text } : {}),
          ...(done !== undefined ? { done } : {}),
        },
      });

      const task = await prisma.task.findUniqueOrThrow({
        where: { id: subtask.taskId },
        include: taskInclude,
      });
      return toTaskDetailDto(task);
    },
  );

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const subtask = await loadSubtaskWithTaskOrThrow(id);

    if (
      !canMutate(request.authUser, {
        createdById: subtask.task.createdById,
        assigneeIds: subtask.task.assignees.map((a) => a.userId),
      })
    ) {
      return reply.code(403).send({ error: 'Sem permissão para excluir esta subtarefa' });
    }

    await prisma.subtask.delete({ where: { id } });

    const task = await prisma.task.findUniqueOrThrow({
      where: { id: subtask.taskId },
      include: taskInclude,
    });
    return toTaskDetailDto(task);
  });
}
