import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';

const MAX_BYTES = 2 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function avatarRoutes(app: FastifyInstance) {
  app.post('/me/avatar', async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_BYTES } });
    if (!file) {
      return reply.code(400).send({ error: 'Nenhum arquivo enviado' });
    }

    const extension = EXTENSION_BY_MIME[file.mimetype];
    if (!extension) {
      return reply.code(400).send({ error: 'Formato inválido. Use PNG, JPEG ou WebP.' });
    }

    await mkdir(env.UPLOADS_DIR, { recursive: true });

    const filename = `${randomUUID()}.${extension}`;
    const destination = path.join(env.UPLOADS_DIR, filename);
    await pipeline(file.file, createWriteStream(destination));

    // @fastify/multipart flags truncation rather than throwing, so an
    // over-limit upload has to be rejected (and cleaned up) explicitly.
    if (file.file.truncated) {
      await unlink(destination).catch(() => {});
      return reply.code(413).send({ error: 'Imagem muito grande (máx. 2MB)' });
    }

    const previous = await prisma.user.findUnique({
      where: { id: request.authUser.id },
      select: { avatarUrl: true },
    });

    const user = await prisma.user.update({
      where: { id: request.authUser.id },
      data: { avatarUrl: `/uploads/${filename}` },
    });

    // Best-effort cleanup of the replaced file; failure here must not fail the
    // request, since the new avatar is already saved.
    if (previous?.avatarUrl) {
      await unlink(path.join(env.UPLOADS_DIR, path.basename(previous.avatarUrl))).catch(() => {});
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  });
}
