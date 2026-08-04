import type { FastifyInstance } from 'fastify';

import {
  DEFAULT_LABEL_COLOR,
  isLabelScope,
  isPaletteColor,
  LabelScope,
  type LabelDto,
  type LabelInput,
} from '@gloo/shared';

import { prisma } from '../../lib/prisma';

const MAX_NAME_LENGTH = 40;

function toLabelDto(label: { id: string; name: string; color: string }): LabelDto {
  return {
    id: label.id,
    name: label.name,
    // Stored as a plain string — one of the palette keys or a hex the user
    // mixed. Anything else (a hand-edited row, a retired key) falls back rather
    // than reaching the UI as a colour nothing can paint.
    color: isPaletteColor(label.color) ? label.color : DEFAULT_LABEL_COLOR,
  };
}

function validate(body: Partial<LabelInput>): string | null {
  if (body.name !== undefined && !body.name.trim()) return 'name é obrigatório';
  if (body.name && body.name.trim().length > MAX_NAME_LENGTH) {
    return `Nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres`;
  }
  if (body.color !== undefined && !isPaletteColor(body.color)) return 'color inválida';
  if (body.scope !== undefined && !isLabelScope(body.scope)) return 'scope inválido';
  return null;
}

/**
 * Labels are shared across the routines — or the tasks — that wear them, so the
 * picker can list everything in its pool and reuse it. Editing or deleting one
 * therefore affects every routine wearing it, which is the intent.
 *
 * The two pools never meet: every read filters on `scope`, and a write can only
 * reach a label the caller asked for by id, which came from a scoped list.
 */
export async function labelRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    // Unscoped requests are answered with the routine pool: that is what the
    // parameter defaulted to before it existed.
    const { scope } = request.query as { scope?: string };
    const labels = await prisma.label.findMany({
      where: { scope: isLabelScope(scope) ? scope : LabelScope.ROUTINE },
      orderBy: { createdAt: 'asc' },
    });
    return labels.map(toLabelDto);
  });

  app.post<{ Body: LabelInput }>('/', async (request, reply) => {
    const invalid = validate(request.body ?? {});
    if (invalid) return reply.code(400).send({ error: invalid });

    const label = await prisma.label.create({
      data: {
        name: request.body.name.trim(),
        color: request.body.color ?? DEFAULT_LABEL_COLOR,
        scope: request.body.scope ?? LabelScope.ROUTINE,
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
