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
};
