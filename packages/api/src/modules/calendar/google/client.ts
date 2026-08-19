import { env } from '../../../config/env';
import { decryptToken, encryptToken } from '../../../lib/tokenCrypto';
import { prisma } from '../../../lib/prisma';

/**
 * Talking to Google.
 *
 * Global `fetch` rather than the googleapis SDK: what we need is four REST
 * calls and a token refresh, and the SDK is a large dependency carrying every
 * other Google product with it. README §1.4 says to ask before adding one, and
 * there was nothing here worth asking for.
 */

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
export const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/** Tasks is its own service on its own host — see GOOGLE_TASKS_SCOPE. */
export const TASKS_API = 'https://tasks.googleapis.com/tasks/v1';

/**
 * What we ask the user for.
 *
 * `calendar.calendarlist` to see which calendars they have *and* to write back
 * the two things this app lets them change about one — its name and its colour;
 * `calendar.events` to read and write events on them; and `calendar.calendars`
 * so "Nova agenda" can create a real calendar on their side. `openid email` is
 * what identifies the account being linked.
 *
 * The calendar-list scope was the `.readonly` variant until recolouring an
 * agenda started reaching Google. Both the colour and the display name live on
 * the *calendarList* entry rather than on the calendar — a calendar has no
 * colour at all, and its `summary` is what everyone it is shared with sees — so
 * `calendar.calendars` does not cover either of them, and the read-only variant
 * came back 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT. See updateRemoteCalendar, which
 * is what marks an account linked under the old scope as needing to be
 * reconnected.
 *
 * Deliberately still not the blanket `calendar` scope: these three say exactly
 * what the integration does, and the consent screen the user reads is the list
 * of scopes we ask for.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.calendarlist',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendars',
  // Google Tasks is a separate product with a separate API, and this is what
  // lets a task appear on the grid beside the events of the same day — and be
  // ticked off from there. Read *and* write: the tick has to reach Google, or
  // the two would disagree the moment it was used.
  'https://www.googleapis.com/auth/tasks',
];

/**
 * The scopes an account linked before Tasks existed will not have.
 *
 * Their absence is not an error — the calendar half works perfectly without
 * them — so the task sync checks for this and skips rather than failing the
 * whole run, and the account is only flagged for re-consent by the ordinary
 * `needsReauth` path when Google actually rejects a call.
 */
export const GOOGLE_TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

/** Refresh this long before the token actually expires, to avoid a race. */
const EXPIRY_SKEW_MS = 60_000;

export class GoogleAuthError extends Error {}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
}

/** Exchange the authorization code, proving possession of the PKCE verifier. */
export async function exchangeCode(code: string, codeVerifier: string): Promise<TokenResponse> {
  const response = await postForm(OAUTH_TOKEN_URL, {
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  if (!response.ok) {
    throw new GoogleAuthError(`Token exchange failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as TokenResponse;
}

/**
 * Verify the id_token and read the account it identifies.
 *
 * Through Google's own tokeninfo endpoint rather than by checking the JWT
 * signature here, which would need a JWKS client and so a new dependency. The
 * checks that matter are the same either way, and they are made explicitly
 * below rather than assumed: an id_token is only meaningful if it was issued by
 * Google, *for us*, and has not expired. Skipping the `aud` check in particular
 * would let a token minted for any other Google app be replayed at us.
 */
export async function verifyIdToken(idToken: string): Promise<{ sub: string; email: string }> {
  const response = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) throw new GoogleAuthError('id_token rejected by Google');

  const payload = (await response.json()) as {
    aud?: string;
    sub?: string;
    email?: string;
    exp?: string;
    iss?: string;
  };

  if (payload.aud !== env.GOOGLE_CLIENT_ID) {
    throw new GoogleAuthError('id_token was not issued for this application');
  }
  if (payload.iss && !/^(https:\/\/)?accounts\.google\.com$/.test(payload.iss)) {
    throw new GoogleAuthError('id_token has an unexpected issuer');
  }
  if (payload.exp && Number(payload.exp) * 1000 < Date.now()) {
    throw new GoogleAuthError('id_token has expired');
  }
  if (!payload.sub) throw new GoogleAuthError('id_token carries no subject');

  return { sub: payload.sub, email: payload.email ?? '' };
}

/** Everything we asked for must have been granted, or the integration half-works. */
export function assertScopesGranted(granted: string): void {
  const got = new Set(granted.split(' '));
  const missing = GOOGLE_SCOPES.filter(
    (scope) => scope !== 'openid' && scope !== 'email' && !got.has(scope),
  );
  if (missing.length > 0) {
    throw new GoogleAuthError(`Missing scopes: ${missing.join(', ')}`);
  }
}

export async function revokeToken(token: string): Promise<void> {
  // Best effort: a token Google has already forgotten answers 400, and that is
  // not a reason to refuse to unlink the account on our side.
  await postForm(OAUTH_REVOKE_URL, { token }).catch(() => undefined);
}

interface AccountTokens {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}

/**
 * A usable access token for an account, refreshing it first if it is due.
 *
 * Marks the account `needsReauth` and throws when the refresh token is no
 * longer accepted — revoked access, a changed password, or the seven-day expiry
 * that applies while the OAuth consent screen is unverified. The UI reads that
 * flag and offers "Reconectar" rather than showing stale agendas as live.
 */
export async function accessTokenFor(account: AccountTokens): Promise<string> {
  const stillValid =
    account.accessToken &&
    account.tokenExpiresAt &&
    account.tokenExpiresAt.getTime() - EXPIRY_SKEW_MS > Date.now();

  if (stillValid) return decryptToken(account.accessToken!);

  if (!account.refreshToken) {
    await prisma.calendarAccount.update({
      where: { id: account.id },
      data: { needsReauth: true },
    });
    throw new GoogleAuthError('No refresh token for this account');
  }

  const response = await postForm(OAUTH_TOKEN_URL, {
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: decryptToken(account.refreshToken),
    grant_type: 'refresh_token',
  });

  if (!response.ok) {
    await prisma.calendarAccount.update({
      where: { id: account.id },
      data: { needsReauth: true },
    });
    throw new GoogleAuthError(`Refresh failed: ${response.status}`);
  }

  const tokens = (await response.json()) as TokenResponse;

  await prisma.calendarAccount.update({
    where: { id: account.id },
    data: {
      accessToken: encryptToken(tokens.access_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      needsReauth: false,
    },
  });

  return tokens.access_token;
}

/** A Calendar API call with the account's token, refreshed as needed. */
export async function googleFetch(
  account: AccountTokens,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return googleApiFetch(CALENDAR_API, account, path, init);
}

/** The same, against the Tasks service. */
export async function googleTasksFetch(
  account: AccountTokens,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return googleApiFetch(TASKS_API, account, path, init);
}

async function googleApiFetch(
  base: string,
  account: AccountTokens,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const token = await accessTokenFor(account);

  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
