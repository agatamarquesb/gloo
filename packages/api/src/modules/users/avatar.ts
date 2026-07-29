import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyInstance } from 'fastify';

import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { toUserDto } from '../../lib/userDto';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function avatarRoutes(app: FastifyInstance) {
  app.post('/me/avatar', async (request, reply) => {
    // No size cap, by product decision: users pick straight from a phone
    // camera roll. `Infinity` is set explicitly rather than omitted, because
    // @fastify/multipart would otherwise apply its own default limit and
    // silently truncate the file. Internal app, ≤3 accounts, so the upload is
    // trusted; revisit if this ever faces a wider audience.
    const file = await request.file({ limits: { fileSize: Infinity } });
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

    return toUserDto(user);
  });
}
