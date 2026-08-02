import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env';

/**
 * Encryption at rest for third-party OAuth tokens.
 *
 * A Google refresh token is a long-lived key to somebody's calendar, and unlike
 * a password we have to be able to read it back — so bcrypt (lib/hash.ts) is
 * the wrong tool and this is a separate concern rather than an extension of it.
 *
 * AES-256-GCM: authenticated, so a tampered ciphertext fails to decrypt instead
 * of yielding rubbish that gets sent to Google as a bearer credential. The key
 * comes from GOOGLE_TOKEN_KEY and never appears in the database, so a dump of
 * the table on its own is not enough to act as any user.
 */

/** 96 bits is the size GCM is specified for and the only one it is fastest at. */
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ALGORITHM = 'aes-256-gcm';

let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;

  const decoded = Buffer.from(env.GOOGLE_TOKEN_KEY, 'base64');
  if (decoded.length !== KEY_BYTES) {
    // Loud rather than silently padding: a short key would "work" while giving
    // far less protection than the algorithm's name implies.
    throw new Error(
      `GOOGLE_TOKEN_KEY must decode to ${KEY_BYTES} bytes (got ${decoded.length}). ` +
        'Generate one with: openssl rand -base64 32',
    );
  }

  cachedKey = decoded;
  return cachedKey;
}

/**
 * Ciphertext as `iv.tag.payload`, all base64url.
 *
 * Self-describing so the IV — which is random per call, and must be, or two
 * tokens encrypted under one key leak their relationship — travels with what it
 * encrypted instead of needing a column of its own.
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptToken(ciphertext: string): string {
  // Checked by shape rather than by truthiness: encrypting an empty string
  // yields an empty payload segment, and a `!payload` guard would reject a
  // perfectly valid ciphertext it had just produced itself.
  const parts = ciphertext.split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted token');
  const [iv, tag, payload] = parts;

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(payload, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Constant-time string comparison, for the OAuth `state`.
 *
 * `===` on a secret leaks how much of it was right through how long the
 * comparison took. The length check first is not a leak: the length of a state
 * we generated is not secret.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
