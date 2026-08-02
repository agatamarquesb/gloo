function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 3001),
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? '/app/uploads',

  /**
   * Google Calendar OAuth. Optional, unlike everything above: the calendar
   * works without a linked Google account, and an installation that does not
   * want the integration should not be unable to boot for want of a client ID.
   * The connect route refuses politely when these are blank — see
   * isGoogleConfigured.
   */
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/calendar/google/callback',
  /** Base64 of 32 random bytes. Only read when a token is actually encrypted. */
  GOOGLE_TOKEN_KEY: process.env.GOOGLE_TOKEN_KEY ?? '',
};

/** Whether the Google integration can be offered at all. */
export function isGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_TOKEN_KEY);
}
