import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { FastifyInstance } from 'fastify';

import type { UploadedFileDto } from '@gloo/shared';

import { env } from '../../config/env';

/**
 * Generic file sink for attachments. Separate from the avatar route because it
 * is content-agnostic (any file type) and, crucially, returns a URL without
 * touching a record — an attachment can therefore be added to a routine that
 * hasn't been saved yet.
 *
 * Stored names are UUIDs; the original name travels in the attachment's title,
 * so nothing user-supplied ever reaches the filesystem.
 */
export async function uploadRoutes(app: FastifyInstance) {
  app.post('/', async (request, reply): Promise<UploadedFileDto | undefined> => {
    // No size cap, matching the avatar route — same small, trusted audience.
    const file = await request.file({ limits: { fileSize: Infinity } });
    if (!file) {
      reply.code(400).send({ error: 'Nenhum arquivo enviado' });
      return undefined;
    }

    await mkdir(env.UPLOADS_DIR, { recursive: true });

    const extension = path.extname(file.filename).slice(0, 12);
    const stored = `${randomUUID()}${extension}`;
    await pipeline(file.file, createWriteStream(path.join(env.UPLOADS_DIR, stored)));

    return { url: `/uploads/${stored}`, filename: file.filename };
  });
}
