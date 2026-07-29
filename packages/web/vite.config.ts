import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      // Docker Desktop's bind mounts don't deliver reliable inotify events on
      // macOS, and Vite silently missed edits to packages/shared — serving a
      // stale transform of a module whose exports had changed, which surfaces
      // as a blank page ("does not provide an export named …") rather than as a
      // build error. Polling costs a little CPU and removes the whole class of
      // problem; see the same flag on the api service in docker-compose.yml.
      usePolling: true,
    },
  },
});
