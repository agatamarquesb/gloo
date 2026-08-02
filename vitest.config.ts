import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * One runner for the whole workspace, split into projects so each package keeps
 * its own resolution rules — `pnpm test` at the root covers all three.
 *
 * Every project runs in the `node` environment: what we test is pure logic
 * (recurrence expansion, event layout, the Google mappers), none of which
 * touches a DOM. Testing a React component later means adding jsdom and an
 * environment override on the web project, not changing anything here.
 *
 * Tests live beside the code they cover as `*.test.ts`, rather than in a
 * separate tree — the pure modules they exercise are small and the pairing is
 * what makes an untested one obvious.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: fileURLToPath(new URL('./packages/shared', import.meta.url)),
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'api',
          root: fileURLToPath(new URL('./packages/api', import.meta.url)),
          include: ['src/**/*.test.ts'],
        },
      },
      {
        // The web package's own alias, repeated rather than imported from
        // vite.config.ts: that config also loads the React and Tailwind
        // plugins, which cost startup time and buy a node-environment test
        // nothing.
        resolve: {
          alias: {
            '@': fileURLToPath(new URL('./packages/web/src', import.meta.url)),
          },
        },
        test: {
          name: 'web',
          root: fileURLToPath(new URL('./packages/web', import.meta.url)),
          include: ['src/**/*.test.ts'],
        },
      },
    ],
  },
});
