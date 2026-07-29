import type { FastifyInstance } from 'fastify';

import { DEFAULT_LABEL_COLOR, isLabelColor, type LabelDto, type LabelInput } from '@gloo/shared';

import { prisma } from '../../lib/prisma';

const MAX_NAME_LENGTH = 40;

function toLabelDto(label: { id: string; name: string; color: string }): LabelDto {
  return {
    id: label.id,
    name: label.name,
    // Stored as a plain string, so an unknown key (hand-edited row, retired
    // color) falls back rather than reaching the UI as an undefined class.
    color: isLabelColor(label.color) ? label.color : DEFAULT_LABEL_COLOR,
  };
}

function validate(body: Partial<LabelInput>): string | null {
  if (body.name !== undefined && !body.name.trim()) return 'name é obrigatório';
  if (body.name && body.name.trim().length > MAX_NAME_LENGTH) {
    return `Nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`;
  }
  if (body.color !== undefined && !isLabelColor(body.color)) return 'color inválida';
  return null;
}

/**
 * Labels are shared across routines rather than owned by one, so the picker can
 * list everything that exists and reuse it. That also means editing or deleting
 * one affects every routine wearing it — which is the intent.
 */
export async function labelRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const labels = await prisma.label.findMany({ orderBy: { createdAt: 'asc' } });
    return labels.map(toLabelDto);
  });

  app.post<{ Body: LabelInput }>('/', async (request, reply) => {
    const invalid = validate(request.body ?? {});
    if (invalid) return reply.code(400).send({ error: invalid });

    const label = await prisma.label.create({
      data: {
        name: request.body.name.trim(),
        color: request.body.color ?? DEFAULT_LABEL_COLOR,
      },
    });

    return reply.code(201).send(toLabelDto(label));
  });

  app.patch<{ Body: Partial<LabelInput>; Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const invalid = validate(request.body ?? {});
      if (invalid) return reply.code(400).send({ error: invalid });

      const label = await prisma.label.update({
        where: { id: request.params.id },
        data: {
          ...(request.body.name !== undefined ? { name: request.body.name.trim() } : {}),
          ...(request.body.color !== undefined ? { color: request.body.color } : {}),
        },
      });

      return toLabelDto(label);
    },
  );

  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // The join rows cascade, so deleting a label detaches it everywhere.
    await prisma.label.delete({ where: { id: request.params.id } });
    return reply.code(204).send();
  });
}
