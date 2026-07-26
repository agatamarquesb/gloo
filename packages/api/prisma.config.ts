import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Loads the monorepo root .env (used for docker-compose substitution) so
// Prisma CLI commands also work when run locally outside Docker. A no-op if
// DATABASE_URL is already set in the environment (e.g. inside the container).
config({ path: '../../.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
