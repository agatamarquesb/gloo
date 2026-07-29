import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Role } from '@gloo/shared';

import { env } from '../config/env';
import { prisma } from '../lib/prisma';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  jobTitle: string | null;
  avatarUrl: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
  }
  interface FastifyContextConfig {
    public?: boolean;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
  }
}

const COOKIE_NAME = 'token';
const TOKEN_TTL = '7d';
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const authPlugin = fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: COOKIE_NAME, signed: false },
    sign: { expiresIn: TOKEN_TTL },
  });

  app.decorate('signAuthCookie', async (reply: FastifyReply, userId: string) => {
    const token = await reply.jwtSign({ sub: userId });
    reply.setCookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
  });

  app.decorate('clearAuthCookie', (reply: FastifyReply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
  });

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // @fastify/static registers its own routes, so they can't carry the
    // `public` route config — match the prefix instead. Avatar files are
    // UUID-named and non-sensitive, and <img> can't send a bearer token.
    if (request.routeOptions.config?.public || request.url.startsWith('/uploads/')) {
      return;
    }

    await request.jwtVerify();

    const user = await prisma.user.findUnique({ where: { id: request.user.sub } });
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    request.authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      jobTitle: user.jobTitle,
      avatarUrl: user.avatarUrl,
    };
  });
});

declare module 'fastify' {
  interface FastifyInstance {
    signAuthCookie: (reply: FastifyReply, userId: string) => Promise<void>;
    clearAuthCookie: (reply: FastifyReply) => void;
  }
}
