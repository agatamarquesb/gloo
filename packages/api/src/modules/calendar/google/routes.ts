import { createHash, randomBytes } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import { env, isGoogleConfigured } from '../../../config/env';
import { prisma } from '../../../lib/prisma';
import { decryptToken, encryptToken, safeEqual } from '../../../lib/tokenCrypto';
import {
  assertScopesGranted,
  AUTHORIZE_URL,
  exchangeCode,
  GOOGLE_SCOPES,
  revokeToken,
  verifyIdToken,
} from './client';
import { syncUserCalendars } from './sync';

/** An authorization has ten minutes to come back before its state is useless. */
const STATE_TTL_MS = 10 * 60 * 1000;

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

/** PKCE: a high-entropy verifier, and the S256 challenge derived from it. */
function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export async function googleCalendarRoutes(app: FastifyInstance) {
  /**
   * Pull everything new from Google.
   *
   * A POST because it writes, and the page calls it on mount, on an interval
   * while it is open, and from the refresh button — there being no cron to do
   * it on a schedule.
   */
  app.post('/sync', async (request) =>
    syncUserCalendars(request.authUser.id, (error, context) =>
      request.log.error({ err: error }, `Google sync failed: ${context}`),
    ),
  );

  /**
   * Start the flow. Authenticated, so the state row can be bound to the user
   * who asked — the callback must never take an identity from its own query.
   */
  app.get('/connect', async (request, reply) => {
    if (!isGoogleConfigured()) {
      return reply.code(503).send({ error: 'Integração com o Google não está configurada' });
    }

    const state = randomBytes(32).toString('base64url');
    const { verifier, challenge } = createPkcePair();

    await prisma.googleOAuthState.create({
      data: {
        state,
        codeVerifier: verifier,
        userId: request.authUser.id,
        expiresAt: new Date(Date.now() + STATE_TTL_MS),
      },
    });

    // Housekeeping: nothing else deletes states that were started and
    // abandoned, and there is no cron to do it on a schedule.
    await prisma.googleOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      // offline + consent is what actually yields a refresh token: without
      // prompt=consent Google omits it on every authorization after the first,
      // and the integration would work until the first access token expired.
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    return { authUrl: `${AUTHORIZE_URL}?${params.toString()}` };
  });

  /**
   * Google's redirect. Public, because it arrives as a top-level navigation
   * from accounts.google.com and carries no promise of our cookie.
   *
   * Everything that makes this safe is below: the state is looked up, compared
   * in constant time, and deleted before anything else happens, so a replayed
   * callback URL finds nothing. The user comes from that row, never the query.
   */
  app.get('/callback', { config: { public: true } }, async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const fail = (reason: string) =>
      reply.redirect(`${WEB_ORIGIN}/calendar?calendarError=${encodeURIComponent(reason)}`);

    // The user pressed "Cancelar" on Google's consent screen.
    if (error) return fail(error);
    if (!code || !state) return fail('missing_code');

    const stored = await prisma.googleOAuthState.findUnique({ where: { state } });
    if (!stored) return fail('unknown_state');

    // Single use. Deleted before the exchange, so replaying this URL — from a
    // browser history, a referrer log, a shoulder — cannot start a second one.
    await prisma.googleOAuthState.delete({ where: { state: stored.state } });

    if (!safeEqual(stored.state, state)) return fail('bad_state');
    if (stored.expiresAt.getTime() < Date.now()) return fail('expired_state');

    try {
      const tokens = await exchangeCode(code, stored.codeVerifier);
      // A partial grant is refused rather than half-configured: the user
      // unticking "manage calendars" would otherwise surface much later as an
      // unexplained failure when they tried to make an agenda.
      assertScopesGranted(tokens.scope);

      if (!tokens.id_token) return fail('no_id_token');
      const identity = await verifyIdToken(tokens.id_token);

      const encryptedRefresh = tokens.refresh_token
        ? encryptToken(tokens.refresh_token)
        : undefined;

      await prisma.calendarAccount.upsert({
        where: {
          userId_provider_googleSub: {
            userId: stored.userId,
            provider: 'GOOGLE',
            googleSub: identity.sub,
          },
        },
        create: {
          userId: stored.userId,
          provider: 'GOOGLE',
          displayName: identity.email || 'Google',
          googleSub: identity.sub,
          googleEmail: identity.email,
          accessToken: encryptToken(tokens.access_token),
          refreshToken: encryptedRefresh,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          grantedScope: tokens.scope,
        },
        update: {
          googleEmail: identity.email,
          accessToken: encryptToken(tokens.access_token),
          // Google only returns a refresh token when it issues a new one;
          // keeping the old one on re-link is what stops a re-authorization
          // from leaving the account unable to refresh.
          ...(encryptedRefresh ? { refreshToken: encryptedRefresh } : {}),
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          grantedScope: tokens.scope,
          needsReauth: false,
        },
      });

      return reply.redirect(`${WEB_ORIGIN}/calendar?linked=1`);
    } catch (caught) {
      request.log.error({ err: caught }, 'Google OAuth callback failed');
      // The reason goes to the log, not the URL: it can carry Google's own
      // error text, and that lands in browser history.
      return fail('link_failed');
    }
  });

}

/**
 * Give up our grant on the user's Google account.
 *
 * Called by DELETE /calendar/accounts/:id rather than living behind a Google
 * route of its own — "desconectar" is one action wherever the account came
 * from, and two endpoints for it would be two places to forget the revocation.
 *
 * Best effort by design: a token Google has already forgotten answers 400, and
 * that must not stop us forgetting it too, or the row becomes undeletable.
 */
export async function revokeGoogleGrant(
  account: { refreshToken: string | null; accessToken: string | null },
  onError: (error: unknown) => void,
): Promise<void> {
  const token = account.refreshToken ?? account.accessToken;
  if (!token) return;

  try {
    await revokeToken(decryptToken(token));
  } catch (caught) {
    onError(caught);
  }
}
