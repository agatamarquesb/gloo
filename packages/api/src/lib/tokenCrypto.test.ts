import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';

// The module reads its key from env on first use, so the key has to exist
// before it is imported.
process.env.GOOGLE_TOKEN_KEY ??= randomBytes(32).toString('base64');
process.env.DATABASE_URL ??= 'postgresql://test/test';
process.env.JWT_SECRET ??= 'test-secret';

let encryptToken: typeof import('./tokenCrypto').encryptToken;
let decryptToken: typeof import('./tokenCrypto').decryptToken;
let safeEqual: typeof import('./tokenCrypto').safeEqual;

beforeAll(async () => {
  ({ encryptToken, decryptToken, safeEqual } = await import('./tokenCrypto'));
});

describe('token encryption', () => {
  it('round-trips a token', () => {
    const token = '1//0abcdefgHIJKLMNOP-refresh-token_value';
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it('round-trips non-ASCII and empty values', () => {
    expect(decryptToken(encryptToken('ação — ✓'))).toBe('ação — ✓');
    expect(decryptToken(encryptToken(''))).toBe('');
  });

  it('produces different ciphertext each time', () => {
    // A fixed IV would let anyone with the table see which users share a token
    // value, and would break GCM outright.
    const a = encryptToken('same');
    const b = encryptToken('same');
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(decryptToken(b));
  });

  it('never emits the plaintext in the ciphertext', () => {
    expect(encryptToken('super-secret-token')).not.toContain('super-secret-token');
  });

  it('rejects a tampered payload rather than returning rubbish', () => {
    // The whole point of an authenticated cipher: a mangled token must fail
    // loudly, not decrypt to garbage that gets sent to Google as a credential.
    const [iv, tag, payload] = encryptToken('token').split('.');
    const flipped = Buffer.from(payload, 'base64url');
    flipped[0] ^= 0xff;
    expect(() => decryptToken(`${iv}.${tag}.${flipped.toString('base64url')}`)).toThrow();
  });

  it('rejects a tampered auth tag', () => {
    const [iv, tag, payload] = encryptToken('token').split('.');
    const flipped = Buffer.from(tag, 'base64url');
    flipped[0] ^= 0xff;
    expect(() => decryptToken(`${iv}.${flipped.toString('base64url')}.${payload}`)).toThrow();
  });

  it('rejects a malformed ciphertext', () => {
    expect(() => decryptToken('not-a-ciphertext')).toThrow('Malformed encrypted token');
  });
});

describe('safeEqual', () => {
  it('is true for identical strings', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
  });

  it('is false for different strings of equal length', () => {
    expect(safeEqual('abc123', 'abc124')).toBe(false);
  });

  it('is false for different lengths without throwing', () => {
    // timingSafeEqual itself throws on a length mismatch, which would turn a
    // wrong state into a 500 instead of a rejection.
    expect(safeEqual('short', 'much-longer-value')).toBe(false);
  });

  it('is false when one side is empty', () => {
    expect(safeEqual('', 'x')).toBe(false);
  });
});
